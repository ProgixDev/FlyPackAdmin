import Link from 'next/link';

import { createAdminClient } from '@/lib/supabase/admin';

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from('conversations')
    .select(
      'id, trip_id, traveler_id, sender_id, created_at, trips(from_city, to_city), traveler:profiles!traveler_id(full_name), sender:profiles!sender_id(full_name)',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const conversations = await Promise.all(
    (rows ?? []).map(async (r) => {
      const traveler = Array.isArray(r.traveler) ? r.traveler[0] : r.traveler;
      const sender = Array.isArray(r.sender) ? r.sender[0] : r.sender;
      const trip = Array.isArray(r.trips) ? r.trips[0] : r.trips;

      const [{ data: last }, { count: messageCount }] = await Promise.all([
        admin
          .from('messages')
          .select('body, created_at')
          .eq('conversation_id', r.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', r.id),
      ]);

      return {
        id: r.id,
        travelerName: traveler?.full_name || 'Voyageur',
        senderName: sender?.full_name || 'Expéditeur',
        route: trip ? `${trip.from_city} → ${trip.to_city}` : '—',
        lastMessage: last?.body ?? null,
        lastAt: last?.created_at ?? r.created_at,
        messageCount: messageCount ?? 0,
      };
    }),
  );

  conversations.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());

  const filtered = q
    ? conversations.filter(
        (c) =>
          c.travelerName.toLowerCase().includes(q.toLowerCase()) ||
          c.senderName.toLowerCase().includes(q.toLowerCase()) ||
          c.route.toLowerCase().includes(q.toLowerCase()),
      )
    : conversations;

  return (
    <div>
      <h1 className="text-xl font-extrabold tracking-tight text-ink">Conversations</h1>
      <p className="mt-1 text-sm text-slate">{filtered.length} conversation(s) — consultez n’importe quel échange entre deux utilisateurs.</p>

      <form className="mt-6 flex gap-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Rechercher par nom ou trajet…"
          className="w-full max-w-sm rounded-xl border border-hairline bg-brand-mist/60 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-200"
        />
        <button type="submit" className="rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white shadow-[0_10px_25px_-10px_rgba(53,184,252,0.7)] transition hover:bg-brand-600">
          Rechercher
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-hairline bg-white shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-brand-mist text-xs font-semibold uppercase text-slate">
            <tr>
              <th className="px-4 py-3">Voyageur</th>
              <th className="px-4 py-3">Expéditeur</th>
              <th className="px-4 py-3">Trajet</th>
              <th className="px-4 py-3">Dernier message</th>
              <th className="px-4 py-3">Messages</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-hairline last:border-0 hover:bg-brand-mist/40">
                <td className="px-4 py-3 font-semibold text-ink">{c.travelerName}</td>
                <td className="px-4 py-3 font-semibold text-ink">{c.senderName}</td>
                <td className="px-4 py-3 text-slate">{c.route}</td>
                <td className="max-w-[240px] truncate px-4 py-3 text-slate">{c.lastMessage || '—'}</td>
                <td className="px-4 py-3 text-slate">{c.messageCount}</td>
                <td className="px-4 py-3">
                  <Link href={`/conversations/${c.id}`} className="font-semibold text-brand-600 hover:underline">
                    Voir
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  Aucune conversation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
