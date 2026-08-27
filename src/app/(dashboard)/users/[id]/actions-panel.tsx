'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  banUser,
  disableTripVisibility,
  markReinstatementPaid,
  reactivateUser,
  sendAdminMessage,
  setReinstatementAmount,
  setVerification,
  suspendUser,
  warnUser,
  type ActionResult,
  type SanctionInput,
} from '../actions';

const REASONS = [
  'Fraude ou tentative d’arnaque',
  'Colis interdit ou illicite',
  'Faux profil / usurpation d’identité',
  'Comportement abusif envers un autre membre',
  'Spam ou sollicitation commerciale',
  'No-show répété',
  'Contournement de la plateforme',
  'Autre',
];

const field =
  'w-full rounded-xl border border-hairline bg-brand-mist/60 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-200';
const label = 'mb-1 block text-xs font-semibold text-slate';

function Feedback({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>;
}

/** Enveloppe commune : exécute l'action, remonte l'erreur, rafraîchit la page. */
function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<ActionResult>, onSuccess?: () => void) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess?.();
      router.refresh();
    });
  };

  return { pending, error, setError, run };
}

// --- Panneau de sanction -----------------------------------------------------

type Mode = 'warning' | 'suspension' | 'ban';

export function UserActionsPanel({
  userId,
  status,
  hasUnpaidReinstatement,
}: {
  userId: string;
  status: 'active' | 'suspended' | 'banned' | 'pending';
  hasUnpaidReinstatement: boolean;
}) {
  const { pending, error, setError, run } = useAction();
  const [mode, setMode] = useState<Mode | null>(null);

  const [reason, setReason] = useState(REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [note, setNote] = useState('');
  const [days, setDays] = useState(7);
  const [amount, setAmount] = useState('0');
  const [notifyUser, setNotifyUser] = useState(true);

  const reset = () => {
    setMode(null);
    setReason(REASONS[0]);
    setCustomReason('');
    setNote('');
    setDays(7);
    setAmount('0');
    setNotifyUser(true);
  };

  const submit = () => {
    const finalReason = reason === 'Autre' ? customReason : reason;
    const amountCents = Math.round((Number(amount.replace(',', '.')) || 0) * 100);
    const input: SanctionInput = { reason: finalReason, note, amountCents, notifyUser };

    if (mode === 'warning') run(() => warnUser(userId, input), reset);
    else if (mode === 'suspension') run(() => suspendUser(userId, { ...input, days }), reset);
    else if (mode === 'ban') run(() => banUser(userId, input), reset);
  };

  const inactive = status === 'suspended' || status === 'banned';

  return (
    <div className="w-full max-w-md">
      <div className="flex flex-wrap justify-end gap-2">
        {inactive ? (
          <>
            <button
              disabled={pending}
              onClick={() => run(() => reactivateUser(userId, false))}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              Réactiver le compte
            </button>
            {hasUnpaidReinstatement && (
              <button
                disabled={pending}
                onClick={() => {
                  if (!confirm('Réactiver sans avoir encaissé le montant exigé ?')) return;
                  run(() => reactivateUser(userId, true));
                }}
                className="rounded-lg border border-hairline px-3 py-2 text-xs font-semibold text-slate transition hover:bg-brand-mist disabled:opacity-50"
              >
                Forcer la réactivation
              </button>
            )}
          </>
        ) : (
          <>
            <button
              disabled={pending}
              onClick={() => { setError(null); setMode('warning'); }}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
            >
              Avertir
            </button>
            <button
              disabled={pending}
              onClick={() => { setError(null); setMode('suspension'); }}
              className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
            >
              Suspendre
            </button>
            <button
              disabled={pending}
              onClick={() => { setError(null); setMode('ban'); }}
              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              Bannir
            </button>
          </>
        )}
      </div>

      {!mode && <Feedback error={error} />}

      {mode && (
        <div className="mt-3 rounded-2xl border border-hairline bg-white p-4 text-left shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
          <p className="text-sm font-bold text-ink">
            {mode === 'warning' ? 'Avertir cet utilisateur' : mode === 'suspension' ? 'Suspendre ce compte' : 'Bannir ce compte'}
          </p>
          <p className="mt-1 text-xs text-slate">
            {mode === 'warning'
              ? 'Le compte reste actif. L’avertissement est consigné dans l’historique des sanctions.'
              : mode === 'suspension'
                ? 'L’utilisateur ne pourra plus se connecter pendant la durée choisie.'
                : 'L’utilisateur ne pourra plus se connecter. La sanction reste réversible.'}
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <div>
              <label className={label}>Motif</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className={field}>
                {REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {reason === 'Autre' && (
              <div>
                <label className={label}>Préciser le motif</label>
                <input value={customReason} onChange={(e) => setCustomReason(e.target.value)} className={field} />
              </div>
            )}

            {mode === 'suspension' && (
              <div>
                <label className={label}>Durée (jours)</label>
                <div className="flex items-center gap-2">
                  {[3, 7, 30, 90].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDays(d)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        days === d ? 'bg-brand-500 text-white' : 'border border-hairline text-slate hover:bg-brand-mist'
                      }`}
                    >
                      {d} j
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    value={days}
                    onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
                    className={`w-20 ${field}`}
                  />
                </div>
              </div>
            )}

            {mode !== 'warning' && (
              <div>
                <label className={label}>Montant à régler pour la réactivation (€)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={field}
                />
                <p className="mt-1 text-xs text-muted">
                  Laissez 0 s’il n’y a rien à payer. Sinon, la réactivation sera bloquée tant que le paiement
                  n’aura pas été marqué comme reçu.
                </p>
              </div>
            )}

            <div>
              <label className={label}>Note interne (non visible par l’utilisateur)</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={field} />
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-slate">
              <input type="checkbox" checked={notifyUser} onChange={(e) => setNotifyUser(e.target.checked)} />
              Prévenir l’utilisateur via la messagerie interne
            </label>
          </div>

          <Feedback error={error} />

          <div className="mt-4 flex gap-2">
            <button
              disabled={pending || (reason === 'Autre' && !customReason.trim())}
              onClick={submit}
              className="rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              {pending ? 'En cours…' : 'Confirmer'}
            </button>
            <button
              disabled={pending}
              onClick={reset}
              className="rounded-lg border border-hairline px-3.5 py-2 text-xs font-semibold text-slate transition hover:bg-brand-mist disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Montant de réactivation -------------------------------------------------

export function ReinstatementControls({
  sanctionId,
  userId,
  amountCents,
  paidAt,
}: {
  sanctionId: string;
  userId: string;
  amountCents: number;
  paidAt: string | null;
}) {
  const { pending, error, run } = useAction();
  const [ref, setRef] = useState('');
  const [amount, setAmount] = useState((amountCents / 100).toFixed(2));
  const [editing, setEditing] = useState(false);

  if (paidAt) return null;

  return (
    <div className="mt-3 rounded-xl bg-brand-mist p-3">
      {amountCents > 0 ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[160px]">
            <label className={label}>Référence du règlement (virement, reçu…)</label>
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optionnel" className={field} />
          </div>
          <button
            disabled={pending}
            onClick={() => run(() => markReinstatementPaid(sanctionId, userId, ref))}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            Marquer comme payé
          </button>
        </div>
      ) : editing ? (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className={label}>Montant exigé (€)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`w-32 ${field}`}
            />
          </div>
          <button
            disabled={pending}
            onClick={() =>
              run(
                () => setReinstatementAmount(sanctionId, userId, Math.round((Number(amount.replace(',', '.')) || 0) * 100)),
                () => setEditing(false),
              )
            }
            className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            Enregistrer
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg border border-hairline px-3 py-2 text-xs font-semibold text-slate transition hover:bg-white"
          >
            Annuler
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-xs font-semibold text-brand-600 hover:underline"
        >
          + Exiger un montant pour la réactivation
        </button>
      )}
      <Feedback error={error} />
    </div>
  );
}

// --- Vérification d'identité -------------------------------------------------

export function VerificationToggle({
  userId,
  field: fieldName,
  verified,
}: {
  userId: string;
  field: 'id_verified' | 'phone_verified' | 'face_verified';
  verified: boolean;
}) {
  const { pending, error, run } = useAction();

  return (
    <>
      <button
        disabled={pending}
        onClick={() => run(() => setVerification(userId, fieldName, !verified))}
        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
          verified
            ? 'border border-hairline text-slate hover:bg-brand-mist'
            : 'bg-emerald-600 text-white hover:bg-emerald-700'
        }`}
      >
        {verified ? 'Retirer la validation' : 'Valider'}
      </button>
      <Feedback error={error} />
    </>
  );
}

// --- Messagerie interne ------------------------------------------------------

export function AdminMessageComposer({ userId }: { userId: string }) {
  const { pending, error, run } = useAction();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  return (
    <div className="p-5">
      <div className="flex flex-col gap-2">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Objet (optionnel)"
          className={field}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Écrire à cet utilisateur…"
          className={field}
        />
      </div>
      <Feedback error={error} />
      <button
        disabled={pending || !body.trim()}
        onClick={() =>
          run(() => sendAdminMessage(userId, subject, body), () => {
            setSubject('');
            setBody('');
          })
        }
        className="mt-3 rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
      >
        {pending ? 'Envoi…' : 'Envoyer le message'}
      </button>
    </div>
  );
}

// --- Trajets -----------------------------------------------------------------

export function DisableVisibilityButton({ tripId, userId }: { tripId: string; userId: string }) {
  const { pending, run } = useAction();

  return (
    <button
      disabled={pending}
      onClick={() => run(() => disableTripVisibility(tripId, userId))}
      className="whitespace-nowrap rounded-lg border border-hairline px-2.5 py-1 text-xs font-semibold text-slate transition hover:bg-brand-mist disabled:opacity-50"
    >
      Désactiver la mise en avant
    </button>
  );
}
