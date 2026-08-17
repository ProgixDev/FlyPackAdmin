'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { closeTicket, replyToTicket } from './actions';

export function TicketReply({ ticketId, status }: { ticketId: string; status: string }) {
  const router = useRouter();
  const [reply, setReply] = useState('');
  const [pending, startTransition] = useTransition();

  if (status === 'closed') return null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder="Répondre à cet utilisateur…"
        rows={2}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      <div className="flex gap-2">
        <button
          disabled={pending || !reply.trim()}
          onClick={() =>
            startTransition(async () => {
              await replyToTicket(ticketId, reply.trim());
              setReply('');
              router.refresh();
            })
          }
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Envoyer la réponse
        </button>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await closeTicket(ticketId);
              router.refresh();
            })
          }
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
        >
          Fermer le ticket
        </button>
      </div>
    </div>
  );
}
