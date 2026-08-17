'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { banUser, disableTripVisibility, suspendUser, unbanUser } from '../actions';

export function UserActionsPanel({ userId, banned }: { userId: string; banned: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<void>, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {banned ? (
        <button
          disabled={pending}
          onClick={() => run(() => unbanUser(userId))}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Réactiver le compte
        </button>
      ) : (
        <>
          <button
            disabled={pending}
            onClick={() => run(() => suspendUser(userId, 7), 'Suspendre ce compte pendant 7 jours ?')}
            className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
          >
            Suspendre 7 jours
          </button>
          <button
            disabled={pending}
            onClick={() => run(() => banUser(userId), 'Bannir définitivement ce compte ? Cette action est difficile à annuler.')}
            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            Bannir définitivement
          </button>
        </>
      )}
    </div>
  );
}

export function DisableVisibilityButton({ tripId, userId }: { tripId: string; userId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await disableTripVisibility(tripId, userId);
          router.refresh();
        })
      }
      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
    >
      Désactiver la mise en avant
    </button>
  );
}
