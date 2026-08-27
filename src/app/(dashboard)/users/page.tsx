import { BadgeCheck, ShieldAlert, ShieldOff, UserCheck } from 'lucide-react';
import Link from 'next/link';

import {
  ACCOUNT_STATUS_LABEL,
  ACCOUNT_STATUS_TINT,
  accountStatus,
  formatDate,
  listAllAuthUsers,
  type AccountStatus,
} from '@/lib/admin-data';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  Avatar,
  Badge,
  EmptyRow,
  FilterPill,
  PageHeader,
  Panel,
  StatTile,
  Table,
  inputClass,
  submitClass,
} from '@/components/ui';

const PER_PAGE = 50;

type SearchParams = {
  q?: string;
  status?: string;
  verification?: string;
  country?: string;
  city?: string;
  from?: string;
  to?: string;
  minReports?: string;
  page?: string;
};

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'Tous' },
  { key: 'active', label: 'Actifs' },
  { key: 'pending', label: 'En attente de vérification' },
  { key: 'suspended', label: 'Suspendus' },
  { key: 'banned', label: 'Bannis' },
];

const VERIFICATION_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'Toutes' },
  { key: 'full', label: 'Identité vérifiée' },
  { key: 'awaiting', label: 'Pièce à valider' },
  { key: 'none', label: 'Aucune vérification' },
];

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { q, status, verification, country, city, from, to, minReports } = sp;
  const page = Math.max(1, Number(sp.page) || 1);

  const admin = createAdminClient();

  let profileQuery = admin
    .from('profiles')
    .select(
      'id, full_name, avatar_url, phone, country, residence_city, created_at, phone_verified, id_verified, face_verified, id_type, rating, reviews_count, completed_trips',
    )
    .order('created_at', { ascending: false })
    .limit(2000);

  if (from) profileQuery = profileQuery.gte('created_at', from);
  if (to) profileQuery = profileQuery.lte('created_at', `${to}T23:59:59`);
  if (country) profileQuery = profileQuery.ilike('country', `%${country}%`);
  if (city) profileQuery = profileQuery.ilike('residence_city', `%${city}%`);

  const [{ data: profiles }, authById, { data: reportRows }, { data: tripRows }, { data: bookingRows }, { data: sanctionRows }] =
    await Promise.all([
      profileQuery,
      listAllAuthUsers(admin),
      admin.from('reports').select('reported_user_id'),
      admin.from('trips').select('traveler_id'),
      admin.from('bookings').select('sender_id'),
      admin.from('sanctions').select('user_id, kind, lifted_at, reinstatement_amount_cents, reinstatement_paid_at'),
    ]);

  const tally = <T,>(rows: T[] | null, key: (row: T) => string) => {
    const counts = new Map<string, number>();
    for (const row of rows ?? []) {
      const k = key(row);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  };

  const reportCounts = tally(reportRows, (r) => r.reported_user_id);
  const tripCounts = tally(tripRows, (t) => t.traveler_id);
  const bookingCounts = tally(bookingRows, (b) => b.sender_id);
  const sanctionCounts = tally(sanctionRows, (s) => s.user_id);
  const unpaidDues = new Set(
    (sanctionRows ?? [])
      .filter((s) => !s.lifted_at && s.reinstatement_amount_cents > 0 && !s.reinstatement_paid_at)
      .map((s) => s.user_id),
  );

  const minReportsNum = Number(minReports) || 0;
  const needle = q?.trim().toLowerCase() ?? '';

  const allRows = (profiles ?? []).map((p) => {
    const authUser = authById.get(p.id);
    return {
      ...p,
      email: authUser?.email ?? null,
      lastSignInAt: authUser?.last_sign_in_at ?? null,
      status: accountStatus(authUser, p),
      reportCount: reportCounts.get(p.id) ?? 0,
      tripCount: tripCounts.get(p.id) ?? 0,
      bookingCount: bookingCounts.get(p.id) ?? 0,
      sanctionCount: sanctionCounts.get(p.id) ?? 0,
      owesMoney: unpaidDues.has(p.id),
    };
  });

  const rows = allRows.filter((r) => {
    if (r.reportCount < minReportsNum) return false;
    if (status && r.status !== status) return false;

    if (verification === 'full' && !r.id_verified) return false;
    if (verification === 'awaiting' && !(r.id_type && !r.id_verified)) return false;
    if (verification === 'none' && (r.id_verified || r.phone_verified || r.face_verified)) return false;

    if (needle) {
      const haystack = [r.full_name, r.email, r.phone, r.residence_city, r.country]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  // Compteurs de statut : calculés avant le filtre de statut pour rester stables.
  const statusTotals = allRows.reduce(
    (acc, r) => {
      acc[r.status] += 1;
      return acc;
    },
    { active: 0, pending: 0, suspended: 0, banned: 0 } as Record<AccountStatus, number>,
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const buildHref = (patch: Partial<SearchParams>) => {
    const params = new URLSearchParams();
    const merged = { ...sp, ...patch };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `/users?${qs}` : '/users';
  };

  const hasFilters = Boolean(q || status || verification || country || city || from || to || minReports);

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        subtitle={`${rows.length} résultat(s) sur ${allRows.length} compte(s)`}
      />

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Comptes actifs" value={statusTotals.active} icon={UserCheck} accent="emerald" />
        <StatTile
          label="En attente de vérification"
          value={statusTotals.pending}
          hint="Pièce d’identité ou e-mail à valider"
          icon={BadgeCheck}
        />
        <StatTile
          label="Suspendus"
          value={statusTotals.suspended}
          hint={unpaidDues.size > 0 ? `${unpaidDues.size} avec un montant à régler` : undefined}
          icon={ShieldAlert}
          accent={statusTotals.suspended > 0 ? 'amber' : 'brand'}
        />
        <StatTile label="Bannis" value={statusTotals.banned} icon={ShieldOff} accent={statusTotals.banned > 0 ? 'red' : 'brand'} />
      </div>

      <form className="mt-6 rounded-2xl border border-hairline bg-white p-4 shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
        {/* Les filtres actifs voyagent avec la recherche pour ne pas être perdus. */}
        {status && <input type="hidden" name="status" value={status} />}
        {verification && <input type="hidden" name="verification" value={verification} />}

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-semibold text-slate">Recherche</label>
            <input
              name="q"
              defaultValue={q}
              placeholder="Nom, e-mail, téléphone, ville…"
              className={`w-full ${inputClass}`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate">Pays</label>
            <input name="country" defaultValue={country} placeholder="Ex : Algérie" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate">Ville</label>
            <input name="city" defaultValue={city} placeholder="Ex : Alger" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate">Inscrit depuis</label>
            <input name="from" type="date" defaultValue={from} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate">Jusqu’à</label>
            <input name="to" type="date" defaultValue={to} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate">Signalements min.</label>
            <input name="minReports" type="number" min={0} defaultValue={minReports} className={`w-24 ${inputClass}`} />
          </div>
          <button type="submit" className={submitClass}>Filtrer</button>
          {hasFilters && (
            <Link href="/users" className="text-sm font-medium text-slate hover:underline">
              Réinitialiser
            </Link>
          )}
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted">Statut</span>
        {STATUS_FILTERS.map((f) => (
          <FilterPill key={f.key || 'all'} href={buildHref({ status: f.key, page: '' })} active={(status ?? '') === f.key}>
            {f.label}
          </FilterPill>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted">Vérification</span>
        {VERIFICATION_FILTERS.map((f) => (
          <FilterPill
            key={f.key || 'all'}
            href={buildHref({ verification: f.key, page: '' })}
            active={(verification ?? '') === f.key}
          >
            {f.label}
          </FilterPill>
        ))}
      </div>

      <Panel className="mt-6">
        <Table
          head={
            <>
              <th className="px-4 py-3">Utilisateur</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Localisation</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Vérification</th>
              <th className="px-4 py-3">Note</th>
              <th className="px-4 py-3">Activité</th>
              <th className="px-4 py-3">Signalements</th>
              <th className="px-4 py-3">Inscrit le</th>
              <th className="px-4 py-3"></th>
            </>
          }
        >
          {pageRows.map((r) => (
            <tr key={r.id} className="border-b border-hairline last:border-0 hover:bg-brand-mist/40">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={r.full_name} url={r.avatar_url} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{r.full_name || 'Sans nom'}</p>
                    {r.sanctionCount > 0 && (
                      <p className="text-[11px] font-medium text-amber-600">
                        {r.sanctionCount} sanction{r.sanctionCount > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <p className="text-slate">{r.email ?? '—'}</p>
                <p className="text-xs text-muted">{r.phone || '—'}</p>
              </td>
              <td className="px-4 py-3 text-slate">
                {[r.country, r.residence_city].filter(Boolean).join(' · ') || '—'}
              </td>
              <td className="px-4 py-3">
                <Badge tint={ACCOUNT_STATUS_TINT[r.status]}>{ACCOUNT_STATUS_LABEL[r.status]}</Badge>
                {r.owesMoney && (
                  <p className="mt-1 text-[11px] font-semibold text-red-600">Montant à régler</p>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <VerifDot on={r.id_verified} label="Pièce d’identité" letter="ID" />
                  <VerifDot on={r.phone_verified} label="Téléphone" letter="TEL" />
                  <VerifDot on={r.face_verified} label="Selfie" letter="BIO" />
                </div>
              </td>
              <td className="px-4 py-3 text-slate">
                {r.reviews_count > 0 ? (
                  <span className="font-semibold text-ink">
                    {r.rating.toFixed(1)} <span className="text-xs font-normal text-muted">({r.reviews_count})</span>
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-slate">
                {r.tripCount} trajet{r.tripCount > 1 ? 's' : ''}
                <br />
                {r.bookingCount} colis
              </td>
              <td className="px-4 py-3">
                {r.reportCount > 0 ? (
                  <Badge tint="bg-red-100 text-red-700">{r.reportCount}</Badge>
                ) : (
                  <span className="text-muted">0</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate">{formatDate(r.created_at)}</td>
              <td className="px-4 py-3">
                <Link href={`/users/${r.id}`} className="font-semibold text-brand-600 hover:underline">
                  Voir
                </Link>
              </td>
            </tr>
          ))}
          {pageRows.length === 0 && <EmptyRow colSpan={10}>Aucun utilisateur ne correspond à ces critères.</EmptyRow>}
        </Table>
      </Panel>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate">
            Page {currentPage} sur {totalPages}
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link href={buildHref({ page: String(currentPage - 1) })} className="rounded-lg border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-slate hover:bg-brand-mist">
                Précédent
              </Link>
            )}
            {currentPage < totalPages && (
              <Link href={buildHref({ page: String(currentPage + 1) })} className="rounded-lg border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-slate hover:bg-brand-mist">
                Suivant
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function VerifDot({ on, label, letter }: { on: boolean; label: string; letter: string }) {
  return (
    <span
      title={`${label} — ${on ? 'vérifié' : 'non vérifié'}`}
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
        on ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-mist text-muted'
      }`}
    >
      {letter}
    </span>
  );
}
