import { AlertTriangle, Package, PlaneTakeoff, Star, Wallet } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  ACCOUNT_STATUS_LABEL,
  ACCOUNT_STATUS_TINT,
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_TINT,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TINT,
  SANCTION_LABEL,
  SANCTION_TINT,
  TRIP_STATUS_LABEL,
  TRIP_STATUS_TINT,
  accountStatus,
  deriveBookingStatus,
  derivePaymentStatus,
  deriveTripStatus,
  formatCents,
  formatDate,
  formatDateTime,
  type PaymentStatus,
  type SanctionKind,
  type TripStatus,
} from '@/lib/admin-data';
import { createAdminClient } from '@/lib/supabase/admin';
import { Avatar, Badge, EmptyRow, Panel, PanelHeader, StatTile, Stars, TabBar, Table } from '@/components/ui';

import {
  AdminMessageComposer,
  DisableVisibilityButton,
  ReinstatementControls,
  UserActionsPanel,
  VerificationToggle,
} from './actions-panel';

const TABS = [
  'apercu',
  'trajets',
  'colis',
  'avis',
  'transactions',
  'sanctions',
  'signalements',
  'messages',
  'support',
] as const;
type Tab = (typeof TABS)[number];

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : 'apercu';

  const admin = createAdminClient();

  const [
    { data: profile },
    { data: authUser },
    { data: trips },
    { data: sentBookings },
    { data: reportsAgainst },
    { data: reportsMade },
    { data: reviewsReceived },
    { data: reviewsGiven },
    { data: payments },
    { data: sanctions },
    { data: adminMessages },
    { data: tickets },
  ] = await Promise.all([
    admin.from('profiles').select('*').eq('id', id).maybeSingle(),
    admin.auth.admin.getUserById(id),
    admin
      .from('trips')
      .select('id, from_city, to_city, departure_date, kilos_max, price_per_kg, currency, visibility_paid, travel_status, created_at')
      .eq('traveler_id', id)
      .order('departure_date', { ascending: false }),
    admin
      .from('bookings')
      .select('id, kilos, status, created_at, trip_id, trips(from_city, to_city, departure_date, traveler_id)')
      .eq('sender_id', id)
      .order('created_at', { ascending: false }),
    admin
      .from('reports')
      .select('id, reason, description, status, created_at, reporter_id, trip_id, target_type')
      .eq('reported_user_id', id)
      .order('created_at', { ascending: false }),
    admin
      .from('reports')
      .select('id, reason, description, status, created_at, reported_user_id, target_type')
      .eq('reporter_id', id)
      .order('created_at', { ascending: false }),
    admin
      .from('reviews')
      .select('id, rating, comment, tags, created_at, reviewer_id')
      .eq('reviewee_id', id)
      .order('created_at', { ascending: false }),
    admin
      .from('reviews')
      .select('id, rating, comment, tags, created_at, reviewee_id')
      .eq('reviewer_id', id)
      .order('created_at', { ascending: false }),
    admin
      .from('payments')
      .select('id, amount_cents, currency, kind, status, stripe_payment_intent_id, trip_id, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
    admin
      .from('sanctions')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
    admin
      .from('admin_messages')
      .select('id, subject, body, read_at, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
    admin
      .from('support_tickets')
      .select('id, subject, message, status, admin_reply, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (!profile) notFound();

  const tripIds = (trips ?? []).map((t) => t.id);

  // Ces deux requêtes dépendent des trajets de l'utilisateur.
  const [{ data: availability }, { data: receivedBookings }] = await Promise.all([
    tripIds.length
      ? admin.from('trip_availability').select('trip_id, kilos_available, kilos_booked, kilos_max').in('trip_id', tripIds)
      : Promise.resolve({ data: [] as { trip_id: string | null; kilos_available: number | null; kilos_booked: number | null; kilos_max: number | null }[] }),
    tripIds.length
      ? admin
          .from('bookings')
          .select('id, kilos, status, created_at, sender_id, trip_id')
          .in('trip_id', tripIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as { id: string; kilos: number; status: string; created_at: string; sender_id: string; trip_id: string }[] }),
  ]);

  // Noms affichés pour tous les tiers référencés sur la page.
  const relatedIds = Array.from(
    new Set([
      ...(reportsAgainst ?? []).map((r) => r.reporter_id),
      ...(reportsMade ?? []).map((r) => r.reported_user_id),
      ...(reviewsReceived ?? []).map((r) => r.reviewer_id),
      ...(reviewsGiven ?? []).map((r) => r.reviewee_id),
      ...(receivedBookings ?? []).map((b) => b.sender_id),
    ]),
  ).filter((v) => v && v !== id);

  const { data: relatedProfiles } = relatedIds.length
    ? await admin.from('profiles').select('id, full_name').in('id', relatedIds)
    : { data: [] };
  const nameById = new Map((relatedProfiles ?? []).map((p) => [p.id, p.full_name || 'Sans nom']));
  const nameOf = (userId: string) => nameById.get(userId) ?? 'Utilisateur';

  // --- Statut du compte ------------------------------------------------------
  const user = authUser?.user;
  const status = accountStatus(user ?? undefined, profile);
  const openSanctions = (sanctions ?? []).filter((s) => !s.lifted_at && s.kind !== 'warning');
  const unpaidSanctions = openSanctions.filter(
    (s) => s.reinstatement_amount_cents > 0 && !s.reinstatement_paid_at,
  );
  const dueCents = unpaidSanctions.reduce((sum, s) => sum + s.reinstatement_amount_cents, 0);
  const dueCurrency = unpaidSanctions[0]?.reinstatement_currency ?? 'eur';

  // --- Trajets ---------------------------------------------------------------
  const availabilityByTrip = new Map(
    (availability ?? []).filter((a) => a.trip_id).map((a) => [a.trip_id as string, a]),
  );
  const tripsWithStatus = (trips ?? []).map((t) => ({
    ...t,
    derived: deriveTripStatus(t, availabilityByTrip.get(t.id)),
    booked: availabilityByTrip.get(t.id)?.kilos_booked ?? 0,
  }));
  const tripStatusCounts = tripsWithStatus.reduce(
    (acc, t) => {
      acc[t.derived] += 1;
      return acc;
    },
    { available: 0, full: 0, completed: 0, cancelled: 0 } as Record<TripStatus, number>,
  );
  const finishedTrips = tripStatusCounts.completed + tripStatusCounts.cancelled;
  const completionRate = finishedTrips > 0 ? Math.round((tripStatusCounts.completed / finishedTrips) * 100) : null;

  // --- Colis -----------------------------------------------------------------
  const sentWithStatus = (sentBookings ?? []).map((b) => ({
    ...b,
    trip: Array.isArray(b.trips) ? b.trips[0] : b.trips,
    derived: deriveBookingStatus(b.status),
  }));
  const receivedWithStatus = (receivedBookings ?? []).map((b) => ({
    ...b,
    derived: deriveBookingStatus(b.status),
  }));
  const cancelledBookings = [...sentWithStatus, ...receivedWithStatus].filter((b) => b.derived === 'cancelled').length;

  // Aucun champ « no-show » n'existe : on approxime par les colis restés en
  // attente/confirmés sur un trajet dont la date de départ est passée.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tripDateById = new Map(tripsWithStatus.map((t) => [t.id, t.departure_date]));
  const presumedNoShow = receivedWithStatus.filter((b) => {
    const date = tripDateById.get(b.trip_id);
    return date && new Date(date) < today && (b.derived === 'pending' || b.derived === 'confirmed');
  }).length;

  // --- Transactions ----------------------------------------------------------
  const paymentsWithStatus = (payments ?? []).map((p) => ({ ...p, derived: derivePaymentStatus(p.status) }));
  const paymentTotals = paymentsWithStatus.reduce(
    (acc, p) => {
      acc[p.derived] += p.amount_cents;
      return acc;
    },
    { succeeded: 0, refunded: 0, disputed: 0, failed: 0, pending: 0 } as Record<PaymentStatus, number>,
  );
  const paymentCurrency = paymentsWithStatus[0]?.currency ?? 'eur';

  const tabHref = (key: string) => `/users/${id}?tab=${key}`;

  return (
    <div>
      <Link href="/users" className="text-sm font-medium text-brand-600 hover:underline">
        ← Utilisateurs
      </Link>

      {/* --- En-tête ---------------------------------------------------------- */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar name={profile.full_name} url={profile.avatar_url} size={56} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-ink">{profile.full_name || 'Sans nom'}</h1>
              <Badge tint={ACCOUNT_STATUS_TINT[status]}>{ACCOUNT_STATUS_LABEL[status]}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate">
              {user?.email ?? '—'} · {profile.phone || 'Sans téléphone'}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {[profile.country, profile.residence_city].filter(Boolean).join(' · ') || 'Localisation inconnue'} ·
              Inscrit le {formatDate(profile.created_at)} · Dernière connexion {formatDate(user?.last_sign_in_at)}
            </p>
            {profile.reviews_count > 0 && (
              <div className="mt-2">
                <Stars rating={profile.rating} count={profile.reviews_count} />
              </div>
            )}
          </div>
        </div>
        <UserActionsPanel userId={id} status={status} hasUnpaidReinstatement={unpaidSanctions.length > 0} />
      </div>

      {(status === 'suspended' || status === 'banned') && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">
            {status === 'banned' ? 'Compte banni' : 'Compte suspendu'}
            {user?.banned_until && status === 'suspended' && ` jusqu’au ${formatDateTime(user.banned_until)}`}
          </p>
          {openSanctions[0] && <p className="mt-0.5">Motif : {openSanctions[0].reason}</p>}
          {dueCents > 0 && (
            <p className="mt-1 font-semibold">
              Réactivation conditionnée au règlement de {formatCents(dueCents, dueCurrency)}.
            </p>
          )}
        </div>
      )}

      {/* --- Onglets ---------------------------------------------------------- */}
      <div className="mt-6">
        <TabBar
          current={tab}
          hrefFor={tabHref}
          tabs={[
            { key: 'apercu', label: 'Aperçu' },
            { key: 'trajets', label: 'Trajets', count: tripsWithStatus.length },
            { key: 'colis', label: 'Colis', count: sentWithStatus.length + receivedWithStatus.length },
            { key: 'avis', label: 'Avis', count: (reviewsReceived?.length ?? 0) + (reviewsGiven?.length ?? 0) },
            { key: 'transactions', label: 'Transactions', count: paymentsWithStatus.length },
            { key: 'sanctions', label: 'Sanctions', count: sanctions?.length ?? 0 },
            { key: 'signalements', label: 'Signalements', count: (reportsAgainst?.length ?? 0) + (reportsMade?.length ?? 0) },
            { key: 'messages', label: 'Messagerie', count: adminMessages?.length ?? 0 },
            { key: 'support', label: 'Support', count: tickets?.length ?? 0 },
          ]}
        />
      </div>

      {/* --- Aperçu ----------------------------------------------------------- */}
      {tab === 'apercu' && (
        <div className="mt-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Trajets publiés"
              value={tripsWithStatus.length}
              hint={`${tripStatusCounts.available} disponible(s) · ${tripStatusCounts.cancelled} annulé(s)`}
              icon={PlaneTakeoff}
            />
            <StatTile
              label="Taux de complétion"
              value={completionRate === null ? '—' : `${completionRate} %`}
              hint={finishedTrips > 0 ? `sur ${finishedTrips} trajet(s) clos` : 'Aucun trajet clos'}
              icon={Star}
              accent={completionRate !== null && completionRate < 70 ? 'red' : 'emerald'}
            />
            <StatTile
              label="Colis envoyés / reçus"
              value={`${sentWithStatus.length} / ${receivedWithStatus.length}`}
              hint={`${cancelledBookings} annulé(s)`}
              icon={Package}
            />
            <StatTile
              label="Total encaissé"
              value={formatCents(paymentTotals.succeeded, paymentCurrency)}
              hint={
                paymentTotals.disputed > 0
                  ? `${formatCents(paymentTotals.disputed, paymentCurrency)} en litige`
                  : `${formatCents(paymentTotals.refunded, paymentCurrency)} remboursé`
              }
              icon={Wallet}
              accent={paymentTotals.disputed > 0 ? 'red' : 'brand'}
            />
          </div>

          {presumedNoShow > 0 && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
              <p>
                <span className="font-semibold">{presumedNoShow} colis présumé(s) no-show.</span> Ces colis sont
                restés « en attente » ou « confirmé » sur un trajet dont la date de départ est passée. L’app ne
                stocke pas d’état no-show explicite — c’est une estimation à vérifier.
              </p>
            </div>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="Vérification d’identité" hint="Le socle de la confiance entre membres." />
              <div className="divide-y divide-hairline">
                <VerificationRow
                  userId={id}
                  field="id_verified"
                  title="Pièce d’identité"
                  detail={profile.id_type ? `Type déclaré : ${profile.id_type}` : 'Aucune pièce transmise'}
                  verified={profile.id_verified}
                />
                <VerificationRow
                  userId={id}
                  field="phone_verified"
                  title="Téléphone"
                  detail={profile.phone || 'Aucun numéro'}
                  verified={profile.phone_verified}
                />
                <VerificationRow
                  userId={id}
                  field="face_verified"
                  title="Selfie / biométrie"
                  detail={profile.avatar_url ? 'Photo de profil présente' : 'Aucune photo de profil'}
                  verified={profile.face_verified}
                />
                <div className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">Adresse e-mail</p>
                    <p className="text-xs text-slate">{user?.email ?? '—'}</p>
                  </div>
                  <Badge tint={user?.email_confirmed_at ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                    {user?.email_confirmed_at ? 'Confirmée' : 'Non confirmée'}
                  </Badge>
                </div>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Répartition des trajets" />
              <div className="divide-y divide-hairline">
                {(Object.keys(TRIP_STATUS_LABEL) as TripStatus[]).map((key) => (
                  <div key={key} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="text-slate">{TRIP_STATUS_LABEL[key]}</span>
                    <span className="font-bold text-ink">{tripStatusCounts[key]}</span>
                  </div>
                ))}
              </div>
              <PanelHeader title="Adresse déclarée" />
              <p className="px-5 py-3 text-sm text-slate">{profile.address || 'Non renseignée'}</p>
            </Panel>
          </div>
        </div>
      )}

      {/* --- Trajets ---------------------------------------------------------- */}
      {tab === 'trajets' && (
        <Panel className="mt-6">
          <PanelHeader title={`Trajets publiés (${tripsWithStatus.length})`} />
          <Table
            head={
              <>
                <th className="px-4 py-3">Trajet</th>
                <th className="px-4 py-3">Départ</th>
                <th className="px-4 py-3">Kilos</th>
                <th className="px-4 py-3">Prix / kg</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Mise en avant</th>
                <th className="px-4 py-3"></th>
              </>
            }
          >
            {tripsWithStatus.map((t) => (
              <tr key={t.id} className="border-b border-hairline last:border-0 hover:bg-brand-mist/40">
                <td className="px-4 py-3 font-medium text-ink">{t.from_city} → {t.to_city}</td>
                <td className="px-4 py-3 text-slate">{formatDate(t.departure_date)}</td>
                <td className="px-4 py-3 text-slate">{t.booked} / {t.kilos_max} kg</td>
                <td className="px-4 py-3 text-slate">{formatCents(t.price_per_kg * 100, t.currency)}</td>
                <td className="px-4 py-3">
                  <Badge tint={TRIP_STATUS_TINT[t.derived]}>{TRIP_STATUS_LABEL[t.derived]}</Badge>
                </td>
                <td className="px-4 py-3">
                  {t.visibility_paid ? <Badge tint="bg-brand-tint text-brand-700">Active</Badge> : <span className="text-muted">—</span>}
                </td>
                <td className="px-4 py-3">{t.visibility_paid && <DisableVisibilityButton tripId={t.id} userId={id} />}</td>
              </tr>
            ))}
            {tripsWithStatus.length === 0 && <EmptyRow colSpan={7}>Aucun trajet publié.</EmptyRow>}
          </Table>
        </Panel>
      )}

      {/* --- Colis ------------------------------------------------------------ */}
      {tab === 'colis' && (
        <div className="mt-6 flex flex-col gap-6">
          <Panel>
            <PanelHeader
              title={`Colis envoyés (${sentWithStatus.length})`}
              hint="Un volume anormalement élevé peut signaler un usage commercial déguisé."
            />
            <Table
              head={
                <>
                  <th className="px-4 py-3">Trajet</th>
                  <th className="px-4 py-3">Kilos</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Le</th>
                </>
              }
            >
              {sentWithStatus.map((b) => (
                <tr key={b.id} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-3 text-slate">{b.trip ? `${b.trip.from_city} → ${b.trip.to_city}` : '—'}</td>
                  <td className="px-4 py-3 text-slate">{b.kilos} kg</td>
                  <td className="px-4 py-3">
                    <Badge tint={BOOKING_STATUS_TINT[b.derived]}>{BOOKING_STATUS_LABEL[b.derived]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate">{formatDate(b.created_at)}</td>
                </tr>
              ))}
              {sentWithStatus.length === 0 && <EmptyRow colSpan={4}>Aucun colis envoyé.</EmptyRow>}
            </Table>
          </Panel>

          <Panel>
            <PanelHeader
              title={`Colis reçus à transporter (${receivedWithStatus.length})`}
              hint="Colis confiés à cet utilisateur sur ses propres trajets."
            />
            <Table
              head={
                <>
                  <th className="px-4 py-3">Expéditeur</th>
                  <th className="px-4 py-3">Trajet</th>
                  <th className="px-4 py-3">Kilos</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Le</th>
                </>
              }
            >
              {receivedWithStatus.map((b) => {
                const trip = tripsWithStatus.find((t) => t.id === b.trip_id);
                return (
                  <tr key={b.id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/users/${b.sender_id}`} className="font-semibold text-brand-600 hover:underline">
                        {nameOf(b.sender_id)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate">{trip ? `${trip.from_city} → ${trip.to_city}` : '—'}</td>
                    <td className="px-4 py-3 text-slate">{b.kilos} kg</td>
                    <td className="px-4 py-3">
                      <Badge tint={BOOKING_STATUS_TINT[b.derived]}>{BOOKING_STATUS_LABEL[b.derived]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate">{formatDate(b.created_at)}</td>
                  </tr>
                );
              })}
              {receivedWithStatus.length === 0 && <EmptyRow colSpan={5}>Aucun colis reçu.</EmptyRow>}
            </Table>
          </Panel>
        </div>
      )}

      {/* --- Avis ------------------------------------------------------------- */}
      {tab === 'avis' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader
              title={`Avis reçus (${reviewsReceived?.length ?? 0})`}
              action={profile.reviews_count > 0 ? <Stars rating={profile.rating} count={profile.reviews_count} /> : undefined}
            />
            <div className="divide-y divide-hairline">
              {(reviewsReceived ?? []).map((r) => (
                <ReviewRow key={r.id} rating={r.rating} comment={r.comment} tags={r.tags} createdAt={r.created_at} personId={r.reviewer_id} personName={nameOf(r.reviewer_id)} personLabel="Par" />
              ))}
              {(reviewsReceived ?? []).length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">Aucun avis reçu.</p>}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title={`Avis donnés (${reviewsGiven?.length ?? 0})`} />
            <div className="divide-y divide-hairline">
              {(reviewsGiven ?? []).map((r) => (
                <ReviewRow key={r.id} rating={r.rating} comment={r.comment} tags={r.tags} createdAt={r.created_at} personId={r.reviewee_id} personName={nameOf(r.reviewee_id)} personLabel="À propos de" />
              ))}
              {(reviewsGiven ?? []).length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">Aucun avis donné.</p>}
            </div>
          </Panel>
        </div>
      )}

      {/* --- Transactions ----------------------------------------------------- */}
      {tab === 'transactions' && (
        <div className="mt-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Encaissé" value={formatCents(paymentTotals.succeeded, paymentCurrency)} accent="emerald" />
            <StatTile label="Remboursé" value={formatCents(paymentTotals.refunded, paymentCurrency)} />
            <StatTile
              label="En litige"
              value={formatCents(paymentTotals.disputed, paymentCurrency)}
              accent={paymentTotals.disputed > 0 ? 'red' : 'brand'}
            />
            <StatTile label="Échoué / en attente" value={formatCents(paymentTotals.failed + paymentTotals.pending, paymentCurrency)} accent="amber" />
          </div>

          <Panel className="mt-6">
            <PanelHeader
              title={`Transactions (${paymentsWithStatus.length})`}
              hint="Lecture seule : les paiements sont écrits par l’application et Stripe."
            />
            <Table
              head={
                <>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Montant</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Trajet</th>
                  <th className="px-4 py-3">Référence Stripe</th>
                </>
              }
            >
              {paymentsWithStatus.map((p) => (
                <tr key={p.id} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-3 text-slate">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3 text-slate">{p.kind}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{formatCents(p.amount_cents, p.currency)}</td>
                  <td className="px-4 py-3">
                    <Badge tint={PAYMENT_STATUS_TINT[p.derived]}>{PAYMENT_STATUS_LABEL[p.derived]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate">
                    {p.trip_id ? (trips ?? []).find((t) => t.id === p.trip_id)?.to_city ?? '—' : '—'}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-xs text-muted">
                    {p.stripe_payment_intent_id ?? '—'}
                  </td>
                </tr>
              ))}
              {paymentsWithStatus.length === 0 && <EmptyRow colSpan={6}>Aucune transaction.</EmptyRow>}
            </Table>
          </Panel>
        </div>
      )}

      {/* --- Sanctions -------------------------------------------------------- */}
      {tab === 'sanctions' && (
        <div className="mt-6 flex flex-col gap-3">
          {(sanctions ?? []).map((s) => {
            const kind = s.kind as SanctionKind;
            const active = !s.lifted_at && kind !== 'warning';
            return (
              <Panel key={s.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tint={SANCTION_TINT[kind] ?? 'bg-brand-mist text-slate'}>
                        {SANCTION_LABEL[kind] ?? s.kind}
                      </Badge>
                      {s.duration_days && <span className="text-xs font-semibold text-slate">{s.duration_days} jours</span>}
                      {active ? (
                        <Badge tint="bg-red-100 text-red-700">En cours</Badge>
                      ) : s.lifted_at ? (
                        <Badge tint="bg-emerald-100 text-emerald-700">Levée le {formatDate(s.lifted_at)}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-ink">{s.reason}</p>
                    {s.note && <p className="mt-1 text-sm text-slate">Note interne : {s.note}</p>}
                    <p className="mt-1 text-xs text-muted">
                      Appliquée le {formatDateTime(s.created_at)}
                      {s.ends_at && ` · Fin prévue le ${formatDateTime(s.ends_at)}`}
                    </p>
                  </div>

                  {s.reinstatement_amount_cents > 0 && (
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-ink">
                        {formatCents(s.reinstatement_amount_cents, s.reinstatement_currency)}
                      </p>
                      <p className="text-xs font-semibold text-muted">à régler pour la réactivation</p>
                      {s.reinstatement_paid_at ? (
                        <Badge tint="bg-emerald-100 text-emerald-700">
                          Payé le {formatDate(s.reinstatement_paid_at)}
                        </Badge>
                      ) : (
                        <Badge tint="bg-red-100 text-red-700">Impayé</Badge>
                      )}
                      {s.reinstatement_payment_ref && (
                        <p className="mt-1 text-xs text-muted">Réf. {s.reinstatement_payment_ref}</p>
                      )}
                    </div>
                  )}
                </div>

                {active && (
                  <ReinstatementControls
                    sanctionId={s.id}
                    userId={id}
                    amountCents={s.reinstatement_amount_cents}
                    paidAt={s.reinstatement_paid_at}
                  />
                )}
              </Panel>
            );
          })}
          {(sanctions ?? []).length === 0 && (
            <Panel className="p-8 text-center text-sm text-muted">Aucune sanction. Compte au dossier vierge.</Panel>
          )}
        </div>
      )}

      {/* --- Signalements ----------------------------------------------------- */}
      {tab === 'signalements' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader title={`Signalements reçus (${reportsAgainst?.length ?? 0})`} />
            <div className="divide-y divide-hairline">
              {(reportsAgainst ?? []).map((r) => (
                <div key={r.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{r.reason}</span>
                    <span className="text-xs text-muted">{formatDate(r.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate">
                    Par{' '}
                    <Link href={`/users/${r.reporter_id}`} className="font-medium text-brand-600 hover:underline">
                      {nameOf(r.reporter_id)}
                    </Link>{' '}
                    · {r.status}
                  </p>
                  {r.description && <p className="mt-1.5 text-sm text-slate">{r.description}</p>}
                </div>
              ))}
              {(reportsAgainst ?? []).length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-muted">Aucun signalement reçu.</p>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title={`Signalements émis (${reportsMade?.length ?? 0})`}
              hint="Un membre qui signale beaucoup peut aussi abuser du dispositif."
            />
            <div className="divide-y divide-hairline">
              {(reportsMade ?? []).map((r) => (
                <div key={r.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{r.reason}</span>
                    <span className="text-xs text-muted">{formatDate(r.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate">
                    Contre{' '}
                    <Link href={`/users/${r.reported_user_id}`} className="font-medium text-brand-600 hover:underline">
                      {nameOf(r.reported_user_id)}
                    </Link>{' '}
                    · {r.status}
                  </p>
                  {r.description && <p className="mt-1.5 text-sm text-slate">{r.description}</p>}
                </div>
              ))}
              {(reportsMade ?? []).length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-muted">Aucun signalement émis.</p>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* --- Messagerie interne ----------------------------------------------- */}
      {tab === 'messages' && (
        <div className="mt-6 flex flex-col gap-6">
          <Panel>
            <PanelHeader
              title="Contacter cet utilisateur"
              hint="Le message est enregistré côté compte et destiné à l’onglet « Messages de l’équipe » de l’app."
            />
            <AdminMessageComposer userId={id} />
          </Panel>

          <Panel>
            <PanelHeader title={`Messages envoyés (${adminMessages?.length ?? 0})`} />
            <div className="divide-y divide-hairline">
              {(adminMessages ?? []).map((m) => (
                <div key={m.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{m.subject || 'Sans objet'}</span>
                    <div className="flex items-center gap-2">
                      <Badge tint={m.read_at ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-mist text-slate'}>
                        {m.read_at ? `Lu le ${formatDate(m.read_at)}` : 'Non lu'}
                      </Badge>
                      <span className="text-xs text-muted">{formatDateTime(m.created_at)}</span>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate">{m.body}</p>
                </div>
              ))}
              {(adminMessages ?? []).length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-muted">Aucun message envoyé à cet utilisateur.</p>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* --- Support ---------------------------------------------------------- */}
      {tab === 'support' && (
        <Panel className="mt-6">
          <PanelHeader
            title={`Tickets de support (${tickets?.length ?? 0})`}
            action={
              <Link href="/support" className="text-xs font-semibold text-brand-600 hover:underline">
                Ouvrir la file support →
              </Link>
            }
          />
          <div className="divide-y divide-hairline">
            {(tickets ?? []).map((t) => (
              <div key={t.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{t.subject}</span>
                  <div className="flex items-center gap-2">
                    <Badge
                      tint={
                        t.status === 'open'
                          ? 'bg-red-100 text-red-700'
                          : t.status === 'answered'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-brand-mist text-slate'
                      }
                    >
                      {t.status === 'open' ? 'En attente' : t.status === 'answered' ? 'Répondu' : 'Fermé'}
                    </Badge>
                    <span className="text-xs text-muted">{formatDateTime(t.created_at)}</span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate">{t.message}</p>
                {t.admin_reply && (
                  <div className="mt-2 rounded-lg bg-brand-mist p-3 text-sm text-brand-700">
                    <span className="font-semibold">Réponse : </span>
                    {t.admin_reply}
                  </div>
                )}
              </div>
            ))}
            {(tickets ?? []).length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-muted">Aucun ticket ouvert par cet utilisateur.</p>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}

function VerificationRow({
  userId,
  field,
  title,
  detail,
  verified,
}: {
  userId: string;
  field: 'id_verified' | 'phone_verified' | 'face_verified';
  title: string;
  detail: string;
  verified: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="truncate text-xs text-slate">{detail}</p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <Badge tint={verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
          {verified ? 'Vérifié' : 'Non vérifié'}
        </Badge>
        <VerificationToggle userId={userId} field={field} verified={verified} />
      </div>
    </div>
  );
}

function ReviewRow({
  rating,
  comment,
  tags,
  createdAt,
  personId,
  personName,
  personLabel,
}: {
  rating: number;
  comment: string | null;
  tags: string[];
  createdAt: string;
  personId: string;
  personName: string;
  personLabel: string;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-amber-500">{'★'.repeat(rating)}{'☆'.repeat(Math.max(0, 5 - rating))}</span>
        <span className="text-xs text-muted">{formatDate(createdAt)}</span>
      </div>
      <p className="mt-1 text-xs text-slate">
        {personLabel}{' '}
        <Link href={`/users/${personId}`} className="font-medium text-brand-600 hover:underline">
          {personName}
        </Link>
      </p>
      {comment && <p className="mt-1.5 text-sm text-slate">{comment}</p>}
      {tags?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="rounded-full bg-brand-mist px-2 py-0.5 text-[11px] font-medium text-slate">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
