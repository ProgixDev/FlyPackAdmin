import Link from 'next/link';

import { createAdminClient } from '@/lib/supabase/admin';

import { ReportStatusButtons } from './status-buttons';

const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  reviewed: 'En cours d’examen',
  resolved: 'Résolu',
  dismissed: 'Rejeté',
};

const STATUS_TINT: Record<string, string> = {
  pending: 'bg-red-100 text-red-700',
  reviewed: 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  dismissed: 'bg-brand-mist text-slate',
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from('reports')
    .select('id, reason, description, status, created_at, trip_id, reporter_id, reported_user_id')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status) query = query.eq('status', status);

  const { data: reports } = await query;

  const userIds = Array.from(
    new Set((reports ?? []).flatMap((r) => [r.reporter_id, r.reported_user_id])),
  );
  const { data: profiles } = userIds.length
    ? await admin.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name || 'Sans nom']));

  return (
    <div>
      <h1 className="text-xl font-extrabold tracking-tight text-ink">Signalements</h1>
      <p className="mt-1 text-sm text-slate">{reports?.length ?? 0} résultat(s)</p>

      <div className="mt-4 flex gap-2">
        {['', 'pending', 'reviewed', 'resolved', 'dismissed'].map((s) => (
          <Link
            key={s || 'all'}
            href={s ? `/reports?status=${s}` : '/reports'}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              (status ?? '') === s ? 'bg-brand-500 text-white' : 'bg-white text-slate border border-hairline'
            }`}
          >
            {s ? STATUS_LABEL[s] : 'Tous'}
          </Link>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {(reports ?? []).map((r) => (
          <div key={r.id} className="rounded-2xl border border-hairline bg-white p-5 shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">{r.reason}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TINT[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate">
                  <Link href={`/users/${r.reporter_id}`} className="font-medium text-brand-600 hover:underline">
                    {nameById.get(r.reporter_id) ?? 'Utilisateur'}
                  </Link>{' '}
                  a signalé{' '}
                  <Link href={`/users/${r.reported_user_id}`} className="font-medium text-brand-600 hover:underline">
                    {nameById.get(r.reported_user_id) ?? 'Utilisateur'}
                  </Link>{' '}
                  · {new Date(r.created_at).toLocaleString('fr-FR')}
                </p>
              </div>
              <ReportStatusButtons reportId={r.id} status={r.status} />
            </div>
            {r.description && <p className="mt-3 text-sm text-slate">{r.description}</p>}
          </div>
        ))}
        {(!reports || reports.length === 0) && (
          <p className="text-sm text-muted">Aucun signalement.</p>
        )}
      </div>
    </div>
  );
}
