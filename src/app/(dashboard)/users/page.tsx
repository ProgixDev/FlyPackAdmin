import Link from 'next/link';

import { createAdminClient } from '@/lib/supabase/admin';

type SearchParams = { from?: string; to?: string; country?: string; minReports?: string };

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { from, to, country, minReports } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from('profiles')
    .select('id, full_name, country, residence_city, created_at, phone_verified, id_verified')
    .order('created_at', { ascending: false })
    .limit(200);

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', `${to}T23:59:59`);
  if (country) query = query.ilike('country', `%${country}%`);

  const { data: profiles } = await query;

  // Auth metadata (email, ban status) — fetched once and joined in memory.
  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const authById = new Map(authList?.users.map((u) => [u.id, u]) ?? []);

  // Report counts per user.
  const { data: reportRows } = await admin.from('reports').select('reported_user_id');
  const reportCounts = new Map<string, number>();
  for (const r of reportRows ?? []) {
    reportCounts.set(r.reported_user_id, (reportCounts.get(r.reported_user_id) ?? 0) + 1);
  }

  const minReportsNum = minReports ? Number(minReports) : 0;

  const rows = (profiles ?? [])
    .map((p) => ({
      ...p,
      email: authById.get(p.id)?.email ?? '—',
      bannedUntil: authById.get(p.id)?.banned_until ?? null,
      reportCount: reportCounts.get(p.id) ?? 0,
    }))
    .filter((r) => r.reportCount >= minReportsNum);

  const inputClass =
    'rounded-xl border border-hairline bg-brand-mist/60 px-3 py-1.5 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-200';

  return (
    <div>
      <h1 className="text-xl font-extrabold tracking-tight text-ink">Utilisateurs</h1>
      <p className="mt-1 text-sm text-slate">{rows.length} résultat(s)</p>

      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-hairline bg-white p-4 shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate">Inscrit depuis</label>
          <input name="from" type="date" defaultValue={from} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate">Inscrit jusqu’à</label>
          <input name="to" type="date" defaultValue={to} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate">Pays</label>
          <input name="country" defaultValue={country} placeholder="Ex: Algérie" className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate">Signalements min.</label>
          <input name="minReports" type="number" min={0} defaultValue={minReports} className={`w-28 ${inputClass}`} />
        </div>
        <button
          type="submit"
          className="rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white shadow-[0_10px_25px_-10px_rgba(53,184,252,0.7)] transition hover:bg-brand-600"
        >
          Filtrer
        </button>
        {(from || to || country || minReports) && (
          <Link href="/users" className="text-sm font-medium text-slate hover:underline">
            Réinitialiser
          </Link>
        )}
      </form>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-hairline bg-white shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-brand-mist text-xs font-semibold uppercase text-slate">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Pays / ville</th>
              <th className="px-4 py-3">Inscrit le</th>
              <th className="px-4 py-3">Signalements</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const banned = r.bannedUntil && new Date(r.bannedUntil) > new Date();
              return (
                <tr key={r.id} className="border-b border-hairline last:border-0 hover:bg-brand-mist/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-tint text-xs font-bold text-brand-700">
                        {(r.full_name || '?').trim().charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-ink">{r.full_name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate">{r.email}</td>
                  <td className="px-4 py-3 text-slate">
                    {[r.country, r.residence_city].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate">{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3">
                    {r.reportCount > 0 ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        {r.reportCount}
                      </span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {banned ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Banni</span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Actif
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/users/${r.id}`} className="font-semibold text-brand-600 hover:underline">
                      Voir
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
