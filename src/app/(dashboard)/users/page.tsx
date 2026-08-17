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

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">Utilisateurs</h1>
      <p className="mt-1 text-sm text-slate-500">{rows.length} résultat(s)</p>

      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Inscrit depuis</label>
          <input name="from" type="date" defaultValue={from} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Inscrit jusqu’à</label>
          <input name="to" type="date" defaultValue={to} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Pays</label>
          <input
            name="country"
            defaultValue={country}
            placeholder="Ex: Algérie"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Signalements min.</label>
          <input
            name="minReports"
            type="number"
            min={0}
            defaultValue={minReports}
            className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Filtrer
        </button>
        {(from || to || country || minReports) && (
          <Link href="/users" className="text-sm font-medium text-slate-500 hover:underline">
            Réinitialiser
          </Link>
        )}
      </form>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
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
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.full_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.email}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {[r.country, r.residence_city].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3">
                    {r.reportCount > 0 ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        {r.reportCount}
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
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
                    <Link href={`/users/${r.id}`} className="font-medium text-blue-600 hover:underline">
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
