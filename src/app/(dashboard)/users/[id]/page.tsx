import Link from 'next/link';
import { notFound } from 'next/navigation';

import { createAdminClient } from '@/lib/supabase/admin';

import { DisableVisibilityButton, UserActionsPanel } from './actions-panel';

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const [{ data: profile }, { data: authUser }, { data: trips }, { data: bookings }, { data: reportsAgainst }] =
    await Promise.all([
      admin.from('profiles').select('*').eq('id', id).maybeSingle(),
      admin.auth.admin.getUserById(id),
      admin
        .from('trips')
        .select('id, from_city, to_city, departure_date, kilos_max, visibility_paid, travel_status')
        .eq('traveler_id', id)
        .order('departure_date', { ascending: false }),
      admin
        .from('bookings')
        .select('id, kilos, status, created_at, trips(from_city, to_city, departure_date)')
        .eq('sender_id', id)
        .order('created_at', { ascending: false }),
      admin
        .from('reports')
        .select('id, reason, description, status, created_at, reporter_id')
        .eq('reported_user_id', id)
        .order('created_at', { ascending: false }),
    ]);

  if (!profile) notFound();

  const banned = !!authUser?.user?.banned_until && new Date(authUser.user.banned_until) > new Date();

  return (
    <div>
      <Link href="/users" className="text-sm font-medium text-brand-600 hover:underline">
        ← Utilisateurs
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">{profile.full_name || 'Sans nom'}</h1>
          <p className="mt-1 text-sm text-slate">
            {authUser?.user?.email} · {[profile.country, profile.residence_city].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-1 text-xs text-muted">
            Inscrit le {new Date(profile.created_at).toLocaleDateString('fr-FR')} · Téléphone :{' '}
            {profile.phone || '—'} {profile.phone_verified ? '(vérifié)' : ''}
          </p>
        </div>
        <UserActionsPanel userId={id} banned={banned} />
      </div>

      {banned && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          Compte suspendu/banni jusqu’au {new Date(authUser!.user!.banned_until!).toLocaleString('fr-FR')}
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-bold text-ink">Trajets publiés ({trips?.length ?? 0})</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-hairline bg-white shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-brand-mist text-xs font-semibold uppercase text-slate">
              <tr>
                <th className="px-4 py-2.5">Trajet</th>
                <th className="px-4 py-2.5">Départ</th>
                <th className="px-4 py-2.5">Kilos</th>
                <th className="px-4 py-2.5">Mise en avant</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {(trips ?? []).map((t) => (
                <tr key={t.id} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-2.5 text-slate">{t.from_city} → {t.to_city}</td>
                  <td className="px-4 py-2.5 text-slate">{new Date(t.departure_date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-2.5 text-slate">{t.kilos_max} kg</td>
                  <td className="px-4 py-2.5">
                    {t.visibility_paid ? (
                      <span className="rounded-full bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand-700">Active</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {t.visibility_paid && <DisableVisibilityButton tripId={t.id} userId={id} />}
                  </td>
                </tr>
              ))}
              {(!trips || trips.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted">
                    Aucun trajet publié.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-bold text-ink">Historique des colis envoyés ({bookings?.length ?? 0})</h2>
        <p className="mt-1 text-xs text-slate">
          Utile pour repérer un compte qui envoie un volume anormalement élevé de colis.
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-hairline bg-white shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-brand-mist text-xs font-semibold uppercase text-slate">
              <tr>
                <th className="px-4 py-2.5">Trajet</th>
                <th className="px-4 py-2.5">Kilos</th>
                <th className="px-4 py-2.5">Statut</th>
                <th className="px-4 py-2.5">Le</th>
              </tr>
            </thead>
            <tbody>
              {(bookings ?? []).map((b) => {
                const trip = Array.isArray(b.trips) ? b.trips[0] : b.trips;
                return (
                  <tr key={b.id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-2.5 text-slate">
                      {trip ? `${trip.from_city} → ${trip.to_city}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate">{b.kilos} kg</td>
                    <td className="px-4 py-2.5 text-slate">{b.status}</td>
                    <td className="px-4 py-2.5 text-slate">{new Date(b.created_at).toLocaleDateString('fr-FR')}</td>
                  </tr>
                );
              })}
              {(!bookings || bookings.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted">
                    Aucun colis envoyé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-bold text-ink">Signalements reçus ({reportsAgainst?.length ?? 0})</h2>
        <div className="mt-3 flex flex-col gap-2">
          {(reportsAgainst ?? []).map((r) => (
            <div key={r.id} className="rounded-xl border border-hairline bg-white p-4 text-sm shadow-[0_10px_25px_-18px_rgba(32,94,131,0.35)]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">{r.reason}</span>
                <span className="text-xs text-muted">{new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
              {r.description && <p className="mt-1 text-slate">{r.description}</p>}
            </div>
          ))}
          {(!reportsAgainst || reportsAgainst.length === 0) && (
            <p className="text-sm text-muted">Aucun signalement reçu.</p>
          )}
        </div>
      </section>
    </div>
  );
}
