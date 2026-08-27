'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth';
import type { TablesUpdate } from '@/lib/database.types';
import { createAdminClient } from '@/lib/supabase/admin';

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Supabase n'a pas de bannissement définitif : on bannit ~100 ans. */
const PERMANENT_BAN_HOURS = '876000h';

function revalidateUser(userId: string) {
  revalidatePath('/users');
  revalidatePath(`/users/${userId}`);
  revalidatePath('/reports');
  revalidatePath('/risk');
}

export type SanctionInput = {
  reason: string;
  note?: string;
  /** Suspension uniquement. */
  days?: number;
  /** Montant à régler pour obtenir la réactivation. 0 = aucune condition. */
  amountCents?: number;
  currency?: string;
  reportId?: string;
  /** Envoie aussi le motif à l'utilisateur via la messagerie interne. */
  notifyUser?: boolean;
};

const SANCTION_LABEL = { warning: 'Avertissement', suspension: 'Suspension', ban: 'Bannissement' } as const;

async function applySanction(
  userId: string,
  kind: 'warning' | 'suspension' | 'ban',
  input: SanctionInput,
): Promise<ActionResult> {
  const adminId = await requireAdmin();
  const admin = createAdminClient();

  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: 'Le motif est obligatoire.' };

  const amountCents = kind === 'warning' ? 0 : Math.max(0, Math.round(input.amountCents ?? 0));
  const currency = (input.currency || 'eur').toLowerCase();
  const now = new Date();
  let endsAt: string | null = null;

  if (kind === 'suspension') {
    const days = input.days ?? 0;
    if (days <= 0) return { ok: false, error: 'La durée de suspension doit être d’au moins 1 jour.' };
    endsAt = new Date(now.getTime() + days * 86_400_000).toISOString();
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: `${days * 24}h` });
    if (error) return { ok: false, error: error.message };
  } else if (kind === 'ban') {
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: PERMANENT_BAN_HOURS });
    if (error) return { ok: false, error: error.message };
  }
  // Un avertissement ne touche pas au compte : il est seulement consigné.

  const { error: insertError } = await admin.from('sanctions').insert({
    user_id: userId,
    kind,
    reason,
    note: input.note?.trim() || null,
    duration_days: kind === 'suspension' ? (input.days ?? null) : null,
    starts_at: now.toISOString(),
    ends_at: endsAt,
    reinstatement_amount_cents: amountCents,
    reinstatement_currency: currency,
    report_id: input.reportId || null,
    created_by: adminId,
  });
  if (insertError) return { ok: false, error: insertError.message };

  if (input.notifyUser) {
    const lines = [reason];
    if (kind === 'suspension' && endsAt) {
      lines.push(`Votre compte est suspendu jusqu’au ${new Date(endsAt).toLocaleDateString('fr-FR')}.`);
    }
    if (amountCents > 0) {
      const formatted = new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: currency.toUpperCase(),
      }).format(amountCents / 100);
      lines.push(`La réactivation de votre compte est conditionnée au règlement de ${formatted}.`);
    }
    await admin.from('admin_messages').insert({
      user_id: userId,
      admin_id: adminId,
      subject: SANCTION_LABEL[kind],
      body: lines.join('\n\n'),
    });
  }

  revalidateUser(userId);
  return { ok: true };
}

export async function warnUser(userId: string, input: SanctionInput) {
  return applySanction(userId, 'warning', input);
}

export async function suspendUser(userId: string, input: SanctionInput) {
  return applySanction(userId, 'suspension', input);
}

export async function banUser(userId: string, input: SanctionInput) {
  return applySanction(userId, 'ban', input);
}

/**
 * Réactive le compte et clôt les sanctions en cours. Refuse tant qu'un montant
 * de réactivation reste impayé, sauf si l'admin choisit explicitement de passer
 * outre (`force`).
 */
export async function reactivateUser(userId: string, force = false): Promise<ActionResult> {
  const adminId = await requireAdmin();
  const admin = createAdminClient();

  const { data: openSanctions, error: readError } = await admin
    .from('sanctions')
    .select('id, kind, reinstatement_amount_cents, reinstatement_currency, reinstatement_paid_at')
    .eq('user_id', userId)
    .is('lifted_at', null)
    .neq('kind', 'warning');
  if (readError) return { ok: false, error: readError.message };

  const unpaid = (openSanctions ?? []).filter(
    (s) => s.reinstatement_amount_cents > 0 && !s.reinstatement_paid_at,
  );
  if (unpaid.length > 0 && !force) {
    const total = unpaid.reduce((sum, s) => sum + s.reinstatement_amount_cents, 0);
    const formatted = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: (unpaid[0].reinstatement_currency || 'eur').toUpperCase(),
    }).format(total / 100);
    return {
      ok: false,
      error: `Réactivation bloquée : ${formatted} restent à régler. Marquez le paiement comme reçu, ou forcez la réactivation.`,
    };
  }

  const { error: unbanError } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
  if (unbanError) return { ok: false, error: unbanError.message };

  const { error: liftError } = await admin
    .from('sanctions')
    .update({ lifted_at: new Date().toISOString(), lifted_by: adminId })
    .eq('user_id', userId)
    .is('lifted_at', null)
    .neq('kind', 'warning');
  if (liftError) return { ok: false, error: liftError.message };

  revalidateUser(userId);
  return { ok: true };
}

/** Enregistre le règlement du montant de réactivation (encaissé hors application). */
export async function markReinstatementPaid(
  sanctionId: string,
  userId: string,
  paymentRef: string,
): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from('sanctions')
    .update({
      reinstatement_paid_at: new Date().toISOString(),
      reinstatement_payment_ref: paymentRef.trim() || null,
    })
    .eq('id', sanctionId);
  if (error) return { ok: false, error: error.message };

  revalidateUser(userId);
  return { ok: true };
}

/** Ajoute ou corrige le montant exigé sur une sanction déjà appliquée. */
export async function setReinstatementAmount(
  sanctionId: string,
  userId: string,
  amountCents: number,
  currency = 'eur',
): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from('sanctions')
    .update({
      reinstatement_amount_cents: Math.max(0, Math.round(amountCents)),
      reinstatement_currency: currency.toLowerCase(),
    })
    .eq('id', sanctionId);
  if (error) return { ok: false, error: error.message };

  revalidateUser(userId);
  return { ok: true };
}

// --- Vérification d'identité -------------------------------------------------

export async function setVerification(
  userId: string,
  field: 'id_verified' | 'phone_verified' | 'face_verified',
  value: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();

  const patch: TablesUpdate<'profiles'> = { updated_at: new Date().toISOString() };
  patch[field] = value;

  const { error } = await admin.from('profiles').update(patch).eq('id', userId);
  if (error) return { ok: false, error: error.message };

  revalidateUser(userId);
  return { ok: true };
}

// --- Messagerie interne ------------------------------------------------------

export async function sendAdminMessage(
  userId: string,
  subject: string,
  body: string,
): Promise<ActionResult> {
  const adminId = await requireAdmin();
  const admin = createAdminClient();

  if (!body.trim()) return { ok: false, error: 'Le message est vide.' };

  const { error } = await admin.from('admin_messages').insert({
    user_id: userId,
    admin_id: adminId,
    subject: subject.trim() || null,
    body: body.trim(),
  });
  if (error) return { ok: false, error: error.message };

  revalidateUser(userId);
  return { ok: true };
}

// --- Trajets -----------------------------------------------------------------

export async function disableTripVisibility(tripId: string, userId: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin.from('trips').update({ visibility_paid: false }).eq('id', tripId);
  if (error) return { ok: false, error: error.message };

  revalidateUser(userId);
  revalidatePath('/trips');
  return { ok: true };
}
