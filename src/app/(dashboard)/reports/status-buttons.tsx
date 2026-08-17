'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { setReportStatus } from './actions';

export function ReportStatusButtons({ reportId, status }: { reportId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const set = (s: 'reviewed' | 'resolved' | 'dismissed') =>
    startTransition(async () => {
      await setReportStatus(reportId, s);
      router.refresh();
    });

  if (status !== 'pending' && status !== 'reviewed') return null;

  return (
    <div className="flex flex-wrap gap-2">
      {status === 'pending' && (
        <button
          disabled={pending}
          onClick={() => set('reviewed')}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          Marquer en cours d’examen
        </button>
      )}
      <button
        disabled={pending}
        onClick={() => set('resolved')}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        Résolu
      </button>
      <button
        disabled={pending}
        onClick={() => set('dismissed')}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
      >
        Rejeter
      </button>
    </div>
  );
}
