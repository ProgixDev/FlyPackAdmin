import {
  AlertTriangle,
  LifeBuoy,
  Package,
  PlaneTakeoff,
  ShieldCheck,
  ShieldOff,
  Star,
  UserPlus,
  Users,
  Weight,
} from 'lucide-react';

import { createAdminClient } from '@/lib/supabase/admin';

import { BarChart, DoughnutChart, LineChart } from './charts';

const ACCENT_HEX: Record<'brand' | 'red' | 'emerald' | 'amber', string> = {
  brand: '#35B8FC',
  red: '#EF4444',
  emerald: '#10B981',
  amber: '#F59E0B',
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'brand',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent?: 'brand' | 'red' | 'emerald' | 'amber';
}) {
  const tint = {
    brand: 'bg-brand-tint text-brand-600',
    red: 'bg-red-100 text-red-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
  }[accent];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-hairline bg-white p-5 shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)] transition hover:shadow-[0_14px_30px_-16px_rgba(32,94,131,0.45)]">
      {/* Decorative geometry — purely visual, sits behind the content. */}
      <div
        className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-[0.08]"
        style={{ backgroundColor: ACCENT_HEX[accent] }}
      />
      <div
        className="pointer-events-none absolute -right-2 -top-2 h-10 w-10 rotate-12 rounded-lg opacity-[0.10]"
        style={{ backgroundColor: ACCENT_HEX[accent] }}
      />

      <div className="relative">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint}`}>
          <Icon size={19} />
        </div>
        <p className="mt-3 text-2xl font-extrabold text-ink">{value}</p>
        <p className="mt-0.5 text-xs font-semibold text-muted">{label}</p>
        {hint && <p className="mt-1 text-xs text-slate">{hint}</p>}
      </div>
    </div>
  );
}

function RingStat({
  label,
  hint,
  percent,
  icon: Icon,
  accent = 'brand',
}: {
  label: string;
  hint?: string;
  percent: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent?: 'brand' | 'red' | 'emerald' | 'amber';
}) {
  const size = 68;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;
  const color = ACCENT_HEX[accent];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-hairline bg-white p-5 shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)] transition hover:shadow-[0_14px_30px_-16px_rgba(32,94,131,0.45)]">
      <div
        className="pointer-events-none absolute -right-8 -bottom-8 h-28 w-28 rounded-full opacity-[0.07]"
        style={{ backgroundColor: color }}
      />
      <div className="relative flex items-center gap-4">
        <div className="relative flex h-[68px] w-[68px] flex-shrink-0 items-center justify-center">
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1FAFF" strokeWidth={stroke} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute text-sm font-extrabold text-ink">{Math.round(clamped)}%</span>
        </div>
        <div>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${color}1A`, color }}
          >
            <Icon size={16} />
          </div>
          <p className="mt-2 text-xs font-semibold text-muted">{label}</p>
          {hint && <p className="mt-0.5 text-xs text-slate">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const admin = createAdminClient();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfWeek = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const todayDate = startOfToday.slice(0, 10);

  const [
    { count: totalUsers },
    { count: newToday },
    { count: newThisWeek },
    { count: verifiedUsers },
    { data: activeTripsRows },
    { count: totalBookings },
    { count: confirmedBookings },
    { count: pendingReports },
    { count: openTickets },
    { data: authList },
    { data: ratedProfiles },
    { data: destinationRows },
    { data: recentUsers },
    { data: signupRows },
    { data: allReportStatuses },
  ] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', startOfToday),
    admin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', startOfWeek),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('id_verified', true),
    admin
      .from('trips')
      .select('id, kilos_max, to_city')
      .neq('travel_status', 'arrived')
      .gte('departure_date', todayDate),
    admin.from('bookings').select('id', { count: 'exact', head: true }),
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
    admin.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('profiles').select('rating').gt('rating', 0),
    admin.from('trips').select('to_city'),
    admin.from('profiles').select('full_name, created_at').order('created_at', { ascending: false }).limit(5),
    admin
      .from('profiles')
      .select('created_at')
      .gte('created_at', new Date(now.getTime() - 29 * 86_400_000).toISOString()),
    admin.from('reports').select('status'),
  ]);

  const bannedCount = (authList?.users ?? []).filter(
    (u) => u.banned_until && new Date(u.banned_until) > now,
  ).length;

  const avgRating = ratedProfiles?.length
    ? ratedProfiles.reduce((sum, p) => sum + (p.rating ?? 0), 0) / ratedProfiles.length
    : 0;

  const kilosAvailable = (activeTripsRows ?? []).reduce((sum, t) => sum + Number(t.kilos_max ?? 0), 0);
  const activeTrips = activeTripsRows?.length ?? 0;

  const destinationCounts = new Map<string, number>();
  for (const t of destinationRows ?? []) {
    destinationCounts.set(t.to_city, (destinationCounts.get(t.to_city) ?? 0) + 1);
  }
  const topDestinations = Array.from(destinationCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const verifiedPct = totalUsers ? Math.round(((verifiedUsers ?? 0) / totalUsers) * 100) : 0;

  const signupsByDay = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    signupsByDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of signupRows ?? []) {
    const key = row.created_at.slice(0, 10);
    if (signupsByDay.has(key)) signupsByDay.set(key, (signupsByDay.get(key) ?? 0) + 1);
  }
  const signupSeries = Array.from(signupsByDay.entries()).map(([key, value]) => ({
    label: new Date(key).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    value,
  }));

  const REPORT_STATUS_META: Record<string, { label: string; color: string }> = {
    pending: { label: 'En attente', color: '#EF4444' },
    reviewed: { label: 'En cours', color: '#F59E0B' },
    resolved: { label: 'Résolu', color: '#10B981' },
    dismissed: { label: 'Rejeté', color: '#94A3B8' },
  };
  const reportStatusCounts = new Map<string, number>();
  for (const r of allReportStatuses ?? []) {
    reportStatusCounts.set(r.status, (reportStatusCounts.get(r.status) ?? 0) + 1);
  }
  const reportStatusSeries = Object.entries(REPORT_STATUS_META).map(([key, meta]) => ({
    label: meta.label,
    value: reportStatusCounts.get(key) ?? 0,
    color: meta.color,
  }));

  return (
    <div>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 p-6 text-white shadow-[0_20px_45px_-20px_rgba(32,94,131,0.55)]">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border-[16px] border-white/10" />
        <div className="pointer-events-none absolute -right-24 bottom-[-70px] h-40 w-40 rotate-12 rounded-[28%] bg-white/10" />
        <div className="pointer-events-none absolute right-16 top-6 h-10 w-10 rounded-xl bg-white/10" />

        <p className="relative text-xs font-semibold uppercase tracking-wide text-white/70">
          {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="relative mt-1 text-2xl font-extrabold tracking-tight">Tableau de bord</h1>
        <p className="relative mt-1 text-sm text-white/80">Vue d’ensemble de FlyBaze Express.</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Utilisateurs inscrits" value={totalUsers ?? 0} icon={Users} />
        <StatCard label="Nouveaux aujourd’hui" value={newToday ?? 0} icon={UserPlus} accent="emerald" />
        <StatCard label="Nouveaux cette semaine" value={newThisWeek ?? 0} icon={UserPlus} accent="emerald" />
        <StatCard label="Trajets actifs" value={activeTrips} hint={`${kilosAvailable} kg disponibles`} icon={PlaneTakeoff} />
        <StatCard label="Colis échangés" value={totalBookings ?? 0} hint={`${confirmedBookings ?? 0} confirmés`} icon={Package} />
        <StatCard
          label="Signalements en attente"
          value={pendingReports ?? 0}
          icon={AlertTriangle}
          accent={(pendingReports ?? 0) > 0 ? 'red' : 'emerald'}
        />
        <StatCard
          label="Tickets support ouverts"
          value={openTickets ?? 0}
          icon={LifeBuoy}
          accent={(openTickets ?? 0) > 0 ? 'amber' : 'emerald'}
        />
        <StatCard label="Comptes bannis / suspendus" value={bannedCount} icon={ShieldOff} accent={bannedCount > 0 ? 'red' : 'emerald'} />
      </div>

      <p className="mt-8 text-xs font-bold uppercase tracking-wide text-muted">Santé de la plateforme</p>
      <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <RingStat label="Comptes vérifiés" percent={verifiedPct} hint={`${verifiedUsers ?? 0} sur ${totalUsers ?? 0}`} icon={ShieldCheck} accent="emerald" />
        <StatCard label="Note moyenne" value={avgRating.toFixed(1)} hint="Sur les profils notés" icon={Star} accent="amber" />
        <StatCard label="Kilos disponibles" value={kilosAvailable} hint="Sur les trajets actifs" icon={Weight} />
      </div>

      <div className="mt-8 rounded-2xl border border-hairline bg-white p-5 shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Nouvelles inscriptions (30 derniers jours)</p>
        <div className="mt-4">
          <LineChart data={signupSeries} />
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-hairline bg-white p-5 shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Destinations les plus demandées</p>
          <div className="mt-4">
            <BarChart data={topDestinations.map(([label, value]) => ({ label, value }))} />
          </div>
        </div>

        <div className="rounded-2xl border border-hairline bg-white p-5 shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Signalements par statut</p>
          <div className="mt-4">
            <DoughnutChart data={reportStatusSeries} />
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-hairline bg-white p-5 shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Derniers inscrits</p>
        <div className="mt-4 flex flex-col gap-3">
          {(recentUsers ?? []).map((u, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="font-semibold text-ink">{u.full_name || 'Sans nom'}</span>
              <span className="text-xs text-muted">{new Date(u.created_at).toLocaleDateString('fr-FR')}</span>
            </div>
          ))}
          {(!recentUsers || recentUsers.length === 0) && <p className="text-sm text-muted">Aucun inscrit.</p>}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-brand-200 bg-brand-mist p-5 text-sm text-slate">
        <p className="font-semibold text-brand-700">Pas encore disponible</p>
        <p className="mt-1">
          Chiffre d’affaires, abonnés premium et taux de conversion nécessitent un vrai système de paiement /
          d’abonnement côté app mobile, qui n’existe pas encore. Ces indicateurs seront ajoutés une fois les
          paiements réels branchés.
        </p>
      </div>
    </div>
  );
}
