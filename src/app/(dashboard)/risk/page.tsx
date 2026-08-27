import { Fingerprint, Network, UserX, Zap } from 'lucide-react';
import Link from 'next/link';

import { accountStatus, formatDate, formatDateTime, listAllAuthUsers } from '@/lib/admin-data';
import { createAdminClient } from '@/lib/supabase/admin';
import { Avatar, Badge, EmptyRow, PageHeader, Panel, PanelHeader, StatTile, Table } from '@/components/ui';

/** Au-delà de ce nombre d'inscriptions dans la même heure, on lève une alerte. */
const BURST_THRESHOLD = 5;
/** Nombre de comptes partageant une IP à partir duquel le groupe devient suspect. */
const IP_CLUSTER_THRESHOLD = 2;

type Signal = { label: string; weight: number };

export default async function RiskPage() {
  const admin = createAdminClient();

  const [{ data: profiles }, authById, { data: reportRows }, { data: tripRows }, { data: bookingRows }, ipResult] =
    await Promise.all([
      admin
        .from('profiles')
        .select('id, full_name, avatar_url, phone, country, residence_city, created_at, phone_verified, id_verified, face_verified, id_type')
        .order('created_at', { ascending: false })
        .limit(2000),
      listAllAuthUsers(admin),
      admin.from('reports').select('reported_user_id'),
      admin.from('trips').select('traveler_id'),
      admin.from('bookings').select('sender_id'),
      admin.rpc('admin_user_ips'),
    ]);

  const ipRows = ipResult.data ?? [];
  const ipUnavailable = Boolean(ipResult.error);

  const countBy = <T,>(rows: T[] | null, key: (row: T) => string) => {
    const counts = new Map<string, number>();
    for (const row of rows ?? []) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
    return counts;
  };

  const reportCounts = countBy(reportRows, (r) => r.reported_user_id);
  const tripCounts = countBy(tripRows, (t) => t.traveler_id);
  const bookingCounts = countBy(bookingRows, (b) => b.sender_id);

  // --- Groupes d'IP partagées ------------------------------------------------
  const usersByIp = new Map<string, string[]>();
  for (const row of ipRows) {
    const list = usersByIp.get(row.ip) ?? [];
    if (!list.includes(row.user_id)) list.push(row.user_id);
    usersByIp.set(row.ip, list);
  }

  const knownProfileIds = new Set((profiles ?? []).map((p) => p.id));
  const ipClusters = Array.from(usersByIp.entries())
    .map(([ip, userIds]) => ({ ip, users: userIds.filter((userId) => knownProfileIds.has(userId)) }))
    .filter((c) => c.users.length >= IP_CLUSTER_THRESHOLD)
    .sort((a, b) => b.users.length - a.users.length);

  const sharedIpUsers = new Set(ipClusters.flatMap((c) => c.users));

  // --- Doublons de nom et de téléphone ---------------------------------------
  const normalize = (value: string | null) => (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const nameCounts = countBy(profiles, (p) => normalize(p.full_name));
  const phoneCounts = countBy(
    (profiles ?? []).filter((p) => p.phone?.trim()),
    (p) => normalize(p.phone),
  );

  // --- Pics de création de comptes -------------------------------------------
  const signupsByHour = new Map<string, string[]>();
  for (const p of profiles ?? []) {
    const key = p.created_at.slice(0, 13); // AAAA-MM-JJTHH
    const list = signupsByHour.get(key) ?? [];
    list.push(p.id);
    signupsByHour.set(key, list);
  }
  const bursts = Array.from(signupsByHour.entries())
    .filter(([, ids]) => ids.length >= BURST_THRESHOLD)
    .sort((a, b) => b[0].localeCompare(a[0]));
  const burstUsers = new Set(bursts.flatMap(([, ids]) => ids));

  // --- Score de risque -------------------------------------------------------
  const now = new Date().getTime();
  const scored = (profiles ?? [])
    .map((p) => {
      const authUser = authById.get(p.id);
      const signals: Signal[] = [];

      const noVerification = !p.id_verified && !p.phone_verified && !p.face_verified;
      if (noVerification) signals.push({ label: 'Aucune vérification', weight: 2 });
      if (!authUser?.email_confirmed_at) signals.push({ label: 'E-mail non confirmé', weight: 1 });
      if (!p.avatar_url) signals.push({ label: 'Pas de photo de profil', weight: 1 });

      const ageDays = (now - new Date(p.created_at).getTime()) / 86_400_000;
      const inactive = (tripCounts.get(p.id) ?? 0) === 0 && (bookingCounts.get(p.id) ?? 0) === 0;
      if (inactive && ageDays > 7) signals.push({ label: 'Aucune activité depuis 7 j', weight: 1 });
      if (!authUser?.last_sign_in_at) signals.push({ label: 'Jamais connecté', weight: 1 });

      const reports = reportCounts.get(p.id) ?? 0;
      if (reports > 0) signals.push({ label: `${reports} signalement(s)`, weight: Math.min(3, reports + 1) });

      if (nameCounts.get(normalize(p.full_name))! > 1 && normalize(p.full_name)) {
        signals.push({ label: 'Nom identique à un autre compte', weight: 2 });
      }
      if (p.phone?.trim() && phoneCounts.get(normalize(p.phone))! > 1) {
        signals.push({ label: 'Téléphone partagé', weight: 3 });
      }
      if (sharedIpUsers.has(p.id)) signals.push({ label: 'IP partagée avec un autre compte', weight: 2 });
      if (burstUsers.has(p.id)) signals.push({ label: 'Créé pendant un pic d’inscriptions', weight: 2 });

      const score = signals.reduce((sum, s) => sum + s.weight, 0);
      return { profile: p, authUser, signals, score, status: accountStatus(authUser, p) };
    })
    .filter((r) => r.score >= 3)
    .sort((a, b) => b.score - a.score);

  const highRisk = scored.filter((r) => r.score >= 6);

  return (
    <div>
      <PageHeader
        title="Comptes à risque"
        subtitle="Signaux faibles agrégés — à confirmer manuellement avant toute sanction."
      />

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Comptes à risque élevé"
          value={highRisk.length}
          hint="Score ≥ 6"
          icon={UserX}
          accent={highRisk.length > 0 ? 'red' : 'emerald'}
        />
        <StatTile label="Comptes à surveiller" value={scored.length} hint="Score ≥ 3" icon={Fingerprint} accent="amber" />
        <StatTile
          label="Groupes d’IP partagées"
          value={ipUnavailable ? '—' : ipClusters.length}
          hint={`${sharedIpUsers.size} compte(s) concerné(s)`}
          icon={Network}
        />
        <StatTile
          label="Pics d’inscriptions"
          value={bursts.length}
          hint={`≥ ${BURST_THRESHOLD} comptes dans la même heure`}
          icon={Zap}
          accent={bursts.length > 0 ? 'amber' : 'brand'}
        />
      </div>

      {ipUnavailable && (
        <div className="mt-6 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-5 text-sm text-amber-800">
          <p className="font-semibold">Détection par IP indisponible</p>
          <p className="mt-1">
            La fonction <code className="rounded bg-white px-1 py-0.5 text-xs">admin_user_ips()</code> n’a pas
            répondu. Appliquez la migration{' '}
            <code className="rounded bg-white px-1 py-0.5 text-xs">supabase/migrations/0001_admin_moderation.sql</code>{' '}
            dans le SQL Editor Supabase pour activer ce signal. Les autres indicateurs de cette page fonctionnent
            sans elle.
          </p>
        </div>
      )}

      {/* --- Comptes suspects --------------------------------------------------- */}
      <Panel className="mt-6">
        <PanelHeader
          title={`Comptes suspects (${scored.length})`}
          hint="Le score additionne des signaux indépendants. Il ne prouve rien à lui seul."
        />
        <Table
          head={
            <>
              <th className="px-4 py-3">Compte</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Signaux</th>
              <th className="px-4 py-3">Inscrit le</th>
              <th className="px-4 py-3"></th>
            </>
          }
        >
          {scored.slice(0, 100).map(({ profile, signals, score, status }) => (
            <tr key={profile.id} className="border-b border-hairline last:border-0 hover:bg-brand-mist/40">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={profile.full_name} url={profile.avatar_url} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{profile.full_name || 'Sans nom'}</p>
                    <p className="truncate text-xs text-muted">
                      {[profile.country, profile.residence_city].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge tint={score >= 6 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>{score}</Badge>
                {status !== 'active' && <p className="mt-1 text-[11px] text-muted">{status}</p>}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {signals.map((s) => (
                    <span key={s.label} className="rounded-full bg-brand-mist px-2 py-0.5 text-[11px] font-medium text-slate">
                      {s.label}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-slate">{formatDate(profile.created_at)}</td>
              <td className="px-4 py-3">
                <Link href={`/users/${profile.id}`} className="font-semibold text-brand-600 hover:underline">
                  Examiner
                </Link>
              </td>
            </tr>
          ))}
          {scored.length === 0 && <EmptyRow colSpan={5}>Aucun compte ne dépasse le seuil de vigilance.</EmptyRow>}
        </Table>
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* --- Groupes d'IP -------------------------------------------------- */}
        <Panel>
          <PanelHeader
            title={`Comptes partageant une IP (${ipClusters.length})`}
            hint="Un réseau familial ou un wifi public produit le même signal — à recouper."
          />
          <div className="divide-y divide-hairline">
            {ipClusters.slice(0, 25).map((cluster) => (
              <div key={cluster.ip} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <code className="rounded bg-brand-mist px-2 py-0.5 text-xs font-semibold text-brand-700">{cluster.ip}</code>
                  <Badge tint={cluster.users.length >= 4 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                    {cluster.users.length} comptes
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {cluster.users.map((userId) => {
                    const p = (profiles ?? []).find((x) => x.id === userId);
                    return (
                      <Link
                        key={userId}
                        href={`/users/${userId}`}
                        className="rounded-full border border-hairline px-2.5 py-1 text-xs font-semibold text-slate transition hover:bg-brand-mist hover:text-ink"
                      >
                        {p?.full_name || 'Sans nom'}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            {ipClusters.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-muted">
                {ipUnavailable ? 'Signal indisponible.' : 'Aucune IP partagée détectée.'}
              </p>
            )}
          </div>
        </Panel>

        {/* --- Pics d'inscriptions ------------------------------------------- */}
        <Panel>
          <PanelHeader
            title={`Pics de création de comptes (${bursts.length})`}
            hint={`Heures ayant vu au moins ${BURST_THRESHOLD} inscriptions.`}
          />
          <div className="divide-y divide-hairline">
            {bursts.slice(0, 25).map(([hour, ids]) => (
              <div key={hour} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{formatDateTime(`${hour}:00:00Z`)}</span>
                  <Badge tint={ids.length >= BURST_THRESHOLD * 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                    {ids.length} inscriptions
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ids.slice(0, 12).map((userId) => {
                    const p = (profiles ?? []).find((x) => x.id === userId);
                    return (
                      <Link
                        key={userId}
                        href={`/users/${userId}`}
                        className="rounded-full border border-hairline px-2.5 py-1 text-xs font-semibold text-slate transition hover:bg-brand-mist hover:text-ink"
                      >
                        {p?.full_name || 'Sans nom'}
                      </Link>
                    );
                  })}
                  {ids.length > 12 && <span className="self-center text-xs text-muted">+{ids.length - 12}</span>}
                </div>
              </div>
            ))}
            {bursts.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-muted">Aucun pic d’inscription détecté.</p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
