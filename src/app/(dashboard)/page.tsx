import { createAdminClient } from '@/lib/supabase/admin';

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'brand' | 'red';
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-white p-5 shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        <div className={`h-2 w-2 rounded-full ${accent === 'red' ? 'bg-red-500' : 'bg-brand-500'}`} />
      </div>
      <p className="mt-2 text-2xl font-extrabold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate">{hint}</p>}
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
    { count: activeTrips },
    { count: totalBookings },
    { count: confirmedBookings },
    { count: pendingReports },
    { count: openTickets },
  ] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', startOfToday),
    admin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', startOfWeek),
    admin
      .from('trips')
      .select('id', { count: 'exact', head: true })
      .neq('travel_status', 'arrived')
      .gte('departure_date', todayDate),
    admin.from('bookings').select('id', { count: 'exact', head: true }),
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
    admin.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
  ]);

  return (
    <div>
      <h1 className="text-xl font-extrabold tracking-tight text-ink">Tableau de bord</h1>
      <p className="mt-1 text-sm text-slate">Vue d’ensemble de FlyBaze Express.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Utilisateurs inscrits" value={totalUsers ?? 0} />
        <StatCard label="Nouveaux aujourd’hui" value={newToday ?? 0} />
        <StatCard label="Nouveaux cette semaine" value={newThisWeek ?? 0} />
        <StatCard label="Trajets actifs" value={activeTrips ?? 0} />
        <StatCard
          label="Colis échangés"
          value={totalBookings ?? 0}
          hint={`${confirmedBookings ?? 0} confirmés`}
        />
        <StatCard label="Signalements en attente" value={pendingReports ?? 0} accent={(pendingReports ?? 0) > 0 ? 'red' : 'brand'} />
        <StatCard label="Tickets support ouverts" value={openTickets ?? 0} accent={(openTickets ?? 0) > 0 ? 'red' : 'brand'} />
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
