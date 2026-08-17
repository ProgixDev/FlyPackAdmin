import Link from 'next/link';
import { notFound } from 'next/navigation';

import { createAdminClient } from '@/lib/supabase/admin';

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: conversation } = await admin
    .from('conversations')
    .select(
      'id, trip_id, traveler_id, sender_id, trips(from_city, to_city, departure_date), traveler:profiles!traveler_id(id, full_name), sender:profiles!sender_id(id, full_name)',
    )
    .eq('id', id)
    .maybeSingle();

  if (!conversation) notFound();

  const { data: messages } = await admin
    .from('messages')
    .select('id, sender_id, body, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });

  const trip = Array.isArray(conversation.trips) ? conversation.trips[0] : conversation.trips;
  const traveler = Array.isArray(conversation.traveler) ? conversation.traveler[0] : conversation.traveler;
  const sender = Array.isArray(conversation.sender) ? conversation.sender[0] : conversation.sender;

  const nameOf = (userId: string) => (userId === conversation.traveler_id ? traveler?.full_name : sender?.full_name) || 'Utilisateur';

  return (
    <div>
      <Link href="/conversations" className="text-sm font-medium text-brand-600 hover:underline">
        ← Conversations
      </Link>

      <h1 className="mt-3 text-xl font-extrabold tracking-tight text-ink">Conversation</h1>
      <p className="mt-1 text-sm text-slate">
        <Link href={`/users/${conversation.traveler_id}`} className="font-semibold text-brand-600 hover:underline">
          {traveler?.full_name || 'Voyageur'}
        </Link>{' '}
        (voyageur) ↔{' '}
        <Link href={`/users/${conversation.sender_id}`} className="font-semibold text-brand-600 hover:underline">
          {sender?.full_name || 'Expéditeur'}
        </Link>{' '}
        (expéditeur)
        {trip && (
          <>
            {' '}
            · Trajet {trip.from_city} → {trip.to_city} le {new Date(trip.departure_date).toLocaleDateString('fr-FR')}
          </>
        )}
      </p>

      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-hairline bg-white p-5 shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
        {(messages ?? []).map((m) => {
          const fromTraveler = m.sender_id === conversation.traveler_id;
          return (
            <div key={m.id} className={`flex flex-col ${fromTraveler ? 'items-start' : 'items-end'}`}>
              <span className="mb-1 text-[11px] font-semibold text-muted">{nameOf(m.sender_id)}</span>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                  fromTraveler ? 'bg-brand-mist text-ink' : 'bg-brand-500 text-white'
                }`}
              >
                {m.body}
              </div>
              <span className="mt-1 text-[10px] text-muted">{new Date(m.created_at).toLocaleString('fr-FR')}</span>
            </div>
          );
        })}
        {(!messages || messages.length === 0) && <p className="text-sm text-muted">Aucun message dans cette conversation.</p>}
      </div>
    </div>
  );
}
