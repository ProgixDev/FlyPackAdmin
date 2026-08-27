import { CheckCircle2, PlaneTakeoff, TrendingDown, XCircle } from 'lucide-react';
import Link from 'next/link';

import {
  BOOKING_STATUS_LABEL,
  TRIP_STATUS_HEX,
  TRIP_STATUS_LABEL,
  TRIP_STATUS_TINT,
  deriveBookingStatus,
  deriveTripStatus,
  formatDate,
  type BookingStatus,
  type TripStatus,
} from '@/lib/admin-data';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  Badge,
  EmptyRow,
  FilterPill,
  PageHeader,
  Panel,
  PanelHeader,
  StatTile,
  Table,
  inputClass,
  submitClass,
} from '@/components/ui';

const PER_PAGE = 60;

type SearchParams = { status?: string; q?: string; from?: string; to?: string; page?: string };

export default async function TripsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const { status, q, from, to } = sp;
  const page = Math.max(1, Number(sp.page) || 1);

  const admin = createAdminClient();

  let tripQuery = admin
    .from('trips')
    .select('id, traveler_id, from_city, to_city, departure_date, kilos_max, travel_status, visibility_paid, created_at')
    .order('departure_date', { ascending: false })
    .limit(2000);

  if (from) tripQuery = tripQuery.gte('departure_date', from);
  if (to) tripQuery = tripQuery.lte('departure_date', to);

  const [{ data: trips }, { data: availability }, { data: bookings }] = await Promise.all([
    tripQuery,
    admin.from('trip_availability').select('trip_id, kilos_available, kilos_booked'),
    admin.from('bookings').select('id, trip_id, status'),
  ]);

  const travelerIds = Array.from(new Set((trips ?? []).map((t) => t.traveler_id)));
  const { data: travelers } = travelerIds.length
    ? await admin.from('profiles').select('id, full_name').in('id', travelerIds)
    : { data: [] };
  const nameById = new Map((travelers ?? []).map((p) => [p.id, p.full_name || 'Sans nom']));

  const availabilityByTrip = new Map(
    (availability ?? []).filter((a) => a.trip_id).map((a) => [a.trip_id as string, a]),
  );

  const bookingsByTrip = new Map<string, BookingStatus[]>();
  for (const b of bookings ?? []) {
    const list = bookingsByTrip.get(b.trip_id) ?? [];
    list.push(deriveBookingStatus(b.status));
    bookingsByTrip.set(b.trip_id, list);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allRows = (trips ?? []).map((t) => {
    const avail = availabilityByTrip.get(t.id);
    const derived = deriveTripStatus(t, avail);
    const tripBookings = bookingsByTrip.get(t.id) ?? [];
    // Sans champ « no-show » en base, on approxime : trajet passé dont des colis
    // restent en attente ou confirmés, jamais marqués livrés.
    const presumedNoShow =
      new Date(t.departure_date) < today &&
      tripBookings.some((s) => s === 'pending' || s === 'confirmed');

    return {
      ...t,
      derived,
      travelerName: nameById.get(t.traveler_id) ?? 'Voyageur',
      booked: avail?.kilos_booked ?? 0,
      bookingCount: tripBookings.length,
      presumedNoShow,
    };
  });

  const statusCounts = allRows.reduce(
    (acc, t) => {
      acc[t.derived] += 1;
      return acc;
    },
    { available: 0, full: 0, completed: 0, cancelled: 0 } as Record<TripStatus, number>,
  );

  const closed = statusCounts.completed + statusCounts.cancelled;
  const completionRate = closed > 0 ? Math.round((statusCounts.completed / closed) * 100) : null;
  const cancellationRate = allRows.length > 0 ? Math.round((statusCounts.cancelled / allRows.length) * 100) : 0;
  const noShowCount = allRows.filter((t) => t.presumedNoShow).length;

  const needle = q?.trim().toLowerCase() ?? '';
  const rows = allRows.filter((t) => {
    if (status && t.derived !== status) return false;
    if (needle) {
      const haystack = `${t.from_city} ${t.to_city} ${t.travelerName}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const buildHref = (patch: Partial<SearchParams>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...sp, ...patch })) {
      if (value) params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `/trips?${qs}` : '/trips';
  };

  const maxStatus = Math.max(1, ...Object.values(statusCounts));

  return (
    <div>
      <PageHeader
        title="Trajets"
        subtitle={`${rows.length} trajet(s) affiché(s) sur ${allRows.length}`}
      />

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Trajets ouverts"
          value={statusCounts.available + statusCounts.full}
          hint={`${statusCounts.available} disponibles · ${statusCounts.full} complets`}
          icon={PlaneTakeoff}
        />
        <StatTile
          label="Taux de complétion"
          value={completionRate === null ? '—' : `${completionRate} %`}
          hint={closed > 0 ? `sur ${closed} trajet(s) clos` : 'Aucun trajet clos'}
          icon={CheckCircle2}
          accent={completionRate !== null && completionRate < 70 ? 'red' : 'emerald'}
        />
        <StatTile
          label="Taux d’annulation"
          value={`${cancellationRate} %`}
          hint={`${statusCounts.cancelled} trajet(s) annulé(s)`}
          icon={XCircle}
          accent={cancellationRate > 15 ? 'red' : 'brand'}
        />
        <StatTile
          label="No-show présumés"
          value={noShowCount}
          hint="Trajets passés, colis jamais livrés"
          icon={TrendingDown}
          accent={noShowCount > 0 ? 'amber' : 'brand'}
        />
      </div>

      <Panel className="mt-6 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Répartition par statut</p>
        <div className="mt-4 flex flex-col gap-2.5">
          {(Object.keys(TRIP_STATUS_LABEL) as TripStatus[]).map((key) => (
            <div key={key} className="flex items-center gap-3">
              <span className="w-24 flex-shrink-0 text-xs font-semibold text-slate">{TRIP_STATUS_LABEL[key]}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-brand-mist">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(statusCounts[key] / maxStatus) * 100}%`,
                    backgroundColor: TRIP_STATUS_HEX[key],
                  }}
                />
              </div>
              <span className="w-10 flex-shrink-0 text-right text-sm font-bold text-ink">{statusCounts[key]}</span>
            </div>
          ))}
        </div>
      </Panel>

      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-hairline bg-white p-4 shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-semibold text-slate">Recherche</label>
          <input name="q" defaultValue={q} placeholder="Ville de départ, d’arrivée ou voyageur…" className={`w-full ${inputClass}`} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate">Départ à partir du</label>
          <input name="from" type="date" defaultValue={from} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate">Jusqu’au</label>
          <input name="to" type="date" defaultValue={to} className={inputClass} />
        </div>
        <button type="submit" className={submitClass}>Filtrer</button>
        {(q || from || to || status) && (
          <Link href="/trips" className="text-sm font-medium text-slate hover:underline">
            Réinitialiser
          </Link>
        )}
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <FilterPill href={buildHref({ status: '', page: '' })} active={!status}>Tous</FilterPill>
        {(Object.keys(TRIP_STATUS_LABEL) as TripStatus[]).map((key) => (
          <FilterPill key={key} href={buildHref({ status: key, page: '' })} active={status === key}>
            {TRIP_STATUS_LABEL[key]} ({statusCounts[key]})
          </FilterPill>
        ))}
      </div>

      <Panel className="mt-6">
        <PanelHeader
          title="Liste des trajets"
          hint="Le statut est déduit de l’état renvoyé par l’app, de la date de départ et des kilos restants."
        />
        <Table
          head={
            <>
              <th className="px-4 py-3">Trajet</th>
              <th className="px-4 py-3">Voyageur</th>
              <th className="px-4 py-3">Départ</th>
              <th className="px-4 py-3">Kilos</th>
              <th className="px-4 py-3">Colis</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Alerte</th>
            </>
          }
        >
          {pageRows.map((t) => (
            <tr key={t.id} className="border-b border-hairline last:border-0 hover:bg-brand-mist/40">
              <td className="px-4 py-3 font-medium text-ink">{t.from_city} → {t.to_city}</td>
              <td className="px-4 py-3">
                <Link href={`/users/${t.traveler_id}`} className="font-semibold text-brand-600 hover:underline">
                  {t.travelerName}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate">{formatDate(t.departure_date)}</td>
              <td className="px-4 py-3 text-slate">{t.booked} / {t.kilos_max} kg</td>
              <td className="px-4 py-3 text-slate">{t.bookingCount}</td>
              <td className="px-4 py-3">
                <Badge tint={TRIP_STATUS_TINT[t.derived]}>{TRIP_STATUS_LABEL[t.derived]}</Badge>
              </td>
              <td className="px-4 py-3">
                {t.presumedNoShow ? (
                  <Badge tint="bg-amber-100 text-amber-700">No-show présumé</Badge>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
            </tr>
          ))}
          {pageRows.length === 0 && <EmptyRow colSpan={7}>Aucun trajet ne correspond à ces critères.</EmptyRow>}
        </Table>
      </Panel>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate">Page {currentPage} sur {totalPages}</span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link href={buildHref({ page: String(currentPage - 1) })} className="rounded-lg border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-slate hover:bg-brand-mist">
                Précédent
              </Link>
            )}
            {currentPage < totalPages && (
              <Link href={buildHref({ page: String(currentPage + 1) })} className="rounded-lg border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-slate hover:bg-brand-mist">
                Suivant
              </Link>
            )}
          </div>
        </div>
      )}

      <p className="mt-6 text-xs text-muted">
        Les statuts de colis reconnus sont : {Object.values(BOOKING_STATUS_LABEL).join(', ').toLowerCase()}.
      </p>
    </div>
  );
}
