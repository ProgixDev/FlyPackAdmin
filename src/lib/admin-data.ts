import 'server-only';
import type { User } from '@supabase/supabase-js';

import type { createAdminClient } from '@/lib/supabase/admin';

type Admin = ReturnType<typeof createAdminClient>;

/**
 * `listUsers` is capped at 1000 rows per page, so a single call silently drops
 * everyone past the first page once the app grows. This walks every page.
 */
export async function listAllAuthUsers(admin: Admin): Promise<Map<string, User>> {
  const byId = new Map<string, User>();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) byId.set(u.id, u);
    if (data.users.length < 1000) break;
  }
  return byId;
}

// --- Statut d'un compte ------------------------------------------------------

export type AccountStatus = 'banned' | 'suspended' | 'pending' | 'active';

/** Supabase n'a pas de « ban définitif » : on bannit très loin dans le futur. */
const BAN_HORIZON_MS = 10 * 365 * 86_400_000;

export function accountStatus(
  authUser: Pick<User, 'banned_until' | 'email_confirmed_at'> | undefined,
  profile: { id_type: string | null; id_verified: boolean },
): AccountStatus {
  const bannedUntil = authUser?.banned_until ? new Date(authUser.banned_until) : null;
  if (bannedUntil && bannedUntil.getTime() > Date.now()) {
    return bannedUntil.getTime() - Date.now() > BAN_HORIZON_MS ? 'banned' : 'suspended';
  }
  // Pièce d'identité envoyée mais pas encore validée, ou e-mail jamais confirmé.
  if (!authUser?.email_confirmed_at) return 'pending';
  if (profile.id_type && !profile.id_verified) return 'pending';
  return 'active';
}

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  active: 'Actif',
  suspended: 'Suspendu',
  banned: 'Banni',
  pending: 'En attente de vérification',
};

export const ACCOUNT_STATUS_TINT: Record<AccountStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-amber-100 text-amber-700',
  banned: 'bg-red-100 text-red-700',
  pending: 'bg-brand-tint text-brand-700',
};

// --- Statut d'un trajet ------------------------------------------------------
// `travel_status` est écrit par l'app mobile et son vocabulaire exact n'est pas
// figé côté back-office : on le reconnaît par motif plutôt que par égalité, et
// on retombe sur la date de départ et les kilos restants.

export type TripStatus = 'available' | 'full' | 'completed' | 'cancelled';

export function deriveTripStatus(
  trip: { travel_status: string | null; departure_date: string },
  availability?: { kilos_available: number | null } | null,
): TripStatus {
  const raw = (trip.travel_status ?? '').toLowerCase();
  if (/cancel|annul/.test(raw)) return 'cancelled';
  if (/arriv|deliver|complet|termin|done|finish/.test(raw)) return 'completed';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(trip.departure_date) < today) return 'completed';

  if (availability && availability.kilos_available !== null && availability.kilos_available <= 0) {
    return 'full';
  }
  return 'available';
}

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  available: 'Disponible',
  full: 'Complet',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

export const TRIP_STATUS_TINT: Record<TripStatus, string> = {
  available: 'bg-emerald-100 text-emerald-700',
  full: 'bg-brand-tint text-brand-700',
  completed: 'bg-brand-mist text-slate',
  cancelled: 'bg-red-100 text-red-700',
};

export const TRIP_STATUS_HEX: Record<TripStatus, string> = {
  available: '#10B981',
  full: '#35B8FC',
  completed: '#94A3B8',
  cancelled: '#EF4444',
};

// --- Statut d'une réservation (colis) ---------------------------------------

export type BookingStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled';

export function deriveBookingStatus(status: string | null): BookingStatus {
  const raw = (status ?? '').toLowerCase();
  if (/cancel|annul|refus|reject|declin/.test(raw)) return 'cancelled';
  if (/deliver|livr|complet|termin|arriv/.test(raw)) return 'delivered';
  if (/confirm|accept|paid|payé/.test(raw)) return 'confirmed';
  return 'pending';
}

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  delivered: 'Livré',
  cancelled: 'Annulé',
};

export const BOOKING_STATUS_TINT: Record<BookingStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-brand-tint text-brand-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

// --- Statut d'un paiement ----------------------------------------------------

export type PaymentStatus = 'succeeded' | 'refunded' | 'disputed' | 'failed' | 'pending';

export function derivePaymentStatus(status: string | null): PaymentStatus {
  const raw = (status ?? '').toLowerCase();
  if (/refund|rembours/.test(raw)) return 'refunded';
  if (/disput|chargeback|litig/.test(raw)) return 'disputed';
  if (/fail|echec|échec|cancel|annul/.test(raw)) return 'failed';
  if (/succe|paid|payé|complet/.test(raw)) return 'succeeded';
  return 'pending';
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  succeeded: 'Payé',
  refunded: 'Remboursé',
  disputed: 'En litige',
  failed: 'Échoué',
  pending: 'En attente',
};

export const PAYMENT_STATUS_TINT: Record<PaymentStatus, string> = {
  succeeded: 'bg-emerald-100 text-emerald-700',
  refunded: 'bg-brand-tint text-brand-700',
  disputed: 'bg-red-100 text-red-700',
  failed: 'bg-brand-mist text-slate',
  pending: 'bg-amber-100 text-amber-700',
};

// --- Sanctions ---------------------------------------------------------------

export type SanctionKind = 'warning' | 'suspension' | 'ban';

export const SANCTION_LABEL: Record<SanctionKind, string> = {
  warning: 'Avertissement',
  suspension: 'Suspension',
  ban: 'Bannissement',
};

export const SANCTION_TINT: Record<SanctionKind, string> = {
  warning: 'bg-amber-100 text-amber-700',
  suspension: 'bg-orange-100 text-orange-700',
  ban: 'bg-red-100 text-red-700',
};

// --- Formatage ---------------------------------------------------------------

export function formatCents(cents: number, currency = 'eur') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('fr-FR') : '—';
}

export function formatDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('fr-FR') : '—';
}
