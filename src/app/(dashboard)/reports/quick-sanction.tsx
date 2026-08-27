'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { banUser, suspendUser, warnUser, type ActionResult } from '../users/actions';

/**
 * Sanction appliquée directement depuis la file de modération, sans quitter
 * l'écran. Le motif reprend celui du signalement, et la sanction reste
 * rattachée à ce signalement dans l'historique.
 */
export function QuickSanction({
  userId,
  reportId,
  reason,
}: {
  userId: string;
  reportId: string;
  reason: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [amount, setAmount] = useState('0');
  const [open, setOpen] = useState(false);

  const run = (fn: () => Promise<ActionResult>, label: string) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(label);
      setOpen(false);
      router.refresh();
    });
  };

  const amountCents = Math.round((Number(amount.replace(',', '.')) || 0) * 100);
  const base = { reason, reportId, notifyUser: true, amountCents };

  if (done) {
    return <span className="text-xs font-semibold text-emerald-600">{done} appliqué.</span>;
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={pending}
          onClick={() => run(() => warnUser(userId, { ...base, amountCents: 0 }), 'Avertissement')}
          className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
        >
          Avertir
        </button>
        <button
          disabled={pending}
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
        >
          Suspendre…
        </button>
        <button
          disabled={pending}
          onClick={() => {
            if (!confirm('Bannir définitivement ce compte ?')) return;
            run(() => banUser(userId, base), 'Bannissement');
          }}
          className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          Bannir
        </button>
      </div>

      {open && (
        <div className="flex flex-wrap items-end justify-end gap-2 rounded-xl bg-brand-mist p-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate">Montant de réactivation (€)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-28 rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>
          {[3, 7, 30].map((days) => (
            <button
              key={days}
              disabled={pending}
              onClick={() => run(() => suspendUser(userId, { ...base, days }), `Suspension ${days} j`)}
              className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
            >
              {days} jours
            </button>
          ))}
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-700">{error}</p>}
    </div>
  );
}
