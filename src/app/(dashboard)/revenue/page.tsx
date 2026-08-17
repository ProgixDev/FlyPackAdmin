import { CreditCard, TrendingUp, Users as UsersIcon } from 'lucide-react';
import Link from 'next/link';

import { createAdminClient } from '@/lib/supabase/admin';

function centsToAmount(cents: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

export default async function RevenuePage() {
  const admin = createAdminClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();

  const [
    { data: succeededPayments },
    { data: monthPayments },
    { data: activeSubs },
    { count: activeSubsCount },
  ] = await Promise.all([
    admin.from('payments').select('amount_cents, currency, created_at').eq('status', 'succeeded').gte('created_at', twelveMonthsAgo),
    admin.from('payments').select('amount_cents, currency').eq('status', 'succeeded').gte('created_at', startOfMonth),
    admin
      .from('subscriptions')
      .select('user_id, status, current_period_end, profiles(full_name)')
      .eq('status', 'active')
      .order('current_period_end', { ascending: true })
      .limit(100),
    admin.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ]);

  const currency = succeededPayments?.[0]?.currency ?? 'usd';
  const totalCents = (succeededPayments ?? []).reduce((sum, p) => sum + p.amount_cents, 0);
  const monthCents = (monthPayments ?? []).reduce((sum, p) => sum + p.amount_cents, 0);

  const byMonth = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    byMonth.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 0);
  }
  for (const p of succeededPayments ?? []) {
    const d = new Date(p.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (byMonth.has(key)) byMonth.set(key, (byMonth.get(key) ?? 0) + p.amount_cents);
  }
  const monthly = Array.from(byMonth.entries());
  const maxMonthCents = Math.max(1, ...monthly.map(([, c]) => c));

  const noStripeYet = (succeededPayments ?? []).length === 0 && (activeSubsCount ?? 0) === 0;

  return (
    <div>
      <h1 className="text-xl font-extrabold tracking-tight text-ink">Revenus</h1>
      <p className="mt-1 text-sm text-slate">Chiffre d’affaires et abonnés premium.</p>

      {noStripeYet && (
        <div className="mt-6 rounded-2xl border border-dashed border-brand-200 bg-brand-mist p-5 text-sm text-slate">
          <p className="font-semibold text-brand-700">En attente de connexion Stripe</p>
          <p className="mt-1">
            Cette page est branchée sur les vraies tables <code className="rounded bg-white px-1 py-0.5 text-xs">payments</code> et{' '}
            <code className="rounded bg-white px-1 py-0.5 text-xs">subscriptions</code> — dès que les paiements Stripe seront
            configurés, les chiffres ci-dessous s’activeront automatiquement, sans rien reconstruire ici.
          </p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-hairline bg-white p-5 shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-tint text-brand-600">
            <TrendingUp size={19} />
          </div>
          <p className="mt-3 text-2xl font-extrabold text-ink">{centsToAmount(totalCents, currency)}</p>
          <p className="mt-0.5 text-xs font-semibold text-muted">CA total (12 derniers mois)</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-white p-5 shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <CreditCard size={19} />
          </div>
          <p className="mt-3 text-2xl font-extrabold text-ink">{centsToAmount(monthCents, currency)}</p>
          <p className="mt-0.5 text-xs font-semibold text-muted">CA ce mois-ci</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-white p-5 shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <UsersIcon size={19} />
          </div>
          <p className="mt-3 text-2xl font-extrabold text-ink">{activeSubsCount ?? 0}</p>
          <p className="mt-0.5 text-xs font-semibold text-muted">Abonnés premium actifs</p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-hairline bg-white p-5 shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">CA par mois</p>
        <div className="mt-4 flex items-end gap-2" style={{ height: 140 }}>
          {monthly.map(([key, cents]) => {
            const [y, m] = key.split('-');
            const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'short' });
            const heightPct = Math.max(2, (cents / maxMonthCents) * 100);
            return (
              <div key={key} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full rounded-t-md bg-brand-500" style={{ height: `${heightPct}%` }} />
                </div>
                <span className="text-[10px] font-medium text-muted">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-hairline bg-white shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
        <div className="border-b border-hairline px-5 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Abonnés actifs</p>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-hairline bg-brand-mist text-xs font-semibold uppercase text-slate">
            <tr>
              <th className="px-4 py-2.5">Utilisateur</th>
              <th className="px-4 py-2.5">Expire le</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {(activeSubs ?? []).map((s) => {
              const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
              return (
                <tr key={s.user_id} className="border-b border-hairline last:border-0 hover:bg-brand-mist/40">
                  <td className="px-4 py-3 font-semibold text-ink">{profile?.full_name || 'Utilisateur'}</td>
                  <td className="px-4 py-3 text-slate">
                    {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/users/${s.user_id}`} className="font-semibold text-brand-600 hover:underline">
                      Voir
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(!activeSubs || activeSubs.length === 0) && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted">
                  Aucun abonné actif pour l’instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
