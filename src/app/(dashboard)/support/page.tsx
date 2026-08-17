import Link from 'next/link';

import { createAdminClient } from '@/lib/supabase/admin';

import { TicketReply } from './ticket-reply';

const STATUS_LABEL: Record<string, string> = { open: 'En attente', answered: 'Répondu', closed: 'Fermé' };
const STATUS_TINT: Record<string, string> = {
  open: 'bg-red-100 text-red-700',
  answered: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-slate-100 text-slate-500',
};

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from('support_tickets')
    .select('id, subject, message, status, admin_reply, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status) query = query.eq('status', status);

  const { data: tickets } = await query;

  const userIds = Array.from(new Set((tickets ?? []).map((t) => t.user_id)));
  const { data: profiles } = userIds.length
    ? await admin.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name || 'Sans nom']));

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">Support</h1>
      <p className="mt-1 text-sm text-slate-500">{tickets?.length ?? 0} ticket(s)</p>

      <div className="mt-4 flex gap-2">
        {['', 'open', 'answered', 'closed'].map((s) => (
          <Link
            key={s || 'all'}
            href={s ? `/support?status=${s}` : '/support'}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              (status ?? '') === s ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-300'
            }`}
          >
            {s ? STATUS_LABEL[s] : 'Tous'}
          </Link>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {(tickets ?? []).map((t) => (
          <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{t.subject}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TINT[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  <Link href={`/users/${t.user_id}`} className="font-medium text-blue-600 hover:underline">
                    {nameById.get(t.user_id) ?? 'Utilisateur'}
                  </Link>{' '}
                  · {new Date(t.created_at).toLocaleString('fr-FR')}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">{t.message}</p>
            {t.admin_reply && (
              <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                <span className="font-semibold">Réponse envoyée : </span>
                {t.admin_reply}
              </div>
            )}
            <TicketReply ticketId={t.id} status={t.status} />
          </div>
        ))}
        {(!tickets || tickets.length === 0) && <p className="text-sm text-slate-400">Aucun ticket.</p>}
      </div>
    </div>
  );
}
