import Link from 'next/link';

import { formatDateTime } from '@/lib/admin-data';
import { createAdminClient } from '@/lib/supabase/admin';
import { Avatar, Badge, FilterPill, PageHeader, Panel, StatTile } from '@/components/ui';

import { QuickSanction } from './quick-sanction';
import { ReportStatusButtons } from './status-buttons';

const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  reviewed: 'En cours d’examen',
  resolved: 'Résolu',
  dismissed: 'Rejeté',
};

const STATUS_TINT: Record<string, string> = {
  pending: 'bg-red-100 text-red-700',
  reviewed: 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  dismissed: 'bg-brand-mist text-slate',
};

const TARGET_LABEL: Record<string, string> = {
  user: 'Utilisateur',
  trip: 'Trajet',
  message: 'Message suspect',
};

const TARGET_TINT: Record<string, string> = {
  user: 'bg-brand-tint text-brand-700',
  trip: 'bg-violet-100 text-violet-700',
  message: 'bg-amber-100 text-amber-700',
};

type ReportRow = {
  id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  trip_id: string | null;
  reporter_id: string;
  reported_user_id: string;
  target_type?: string;
  message_id?: string | null;
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; target?: string }>;
}) {
  const { status, target } = await searchParams;
  const admin = createAdminClient();

  const buildQuery = (columns: string) => {
    let query = admin.from('reports').select(columns).order('created_at', { ascending: false }).limit(300);
    if (status) query = query.eq('status', status);
    return query;
  };

  // `target_type` et `message_id` n'existent qu'après la migration : on retombe
  // sur l'ancien jeu de colonnes tant qu'elle n'est pas appliquée.
  const FULL = 'id, reason, description, status, created_at, trip_id, reporter_id, reported_user_id, target_type, message_id';
  const LEGACY = 'id, reason, description, status, created_at, trip_id, reporter_id, reported_user_id';

  let reports: ReportRow[] = [];
  let migrated = true;
  const full = await buildQuery(FULL);
  if (full.error) {
    migrated = false;
    const legacy = await buildQuery(LEGACY);
    reports = (legacy.data ?? []) as unknown as ReportRow[];
  } else {
    reports = (full.data ?? []) as unknown as ReportRow[];
  }

  const targetOf = (r: ReportRow) => r.target_type ?? (r.trip_id ? 'trip' : 'user');
  const visible = target ? reports.filter((r) => targetOf(r) === target) : reports;

  const userIds = Array.from(new Set(reports.flatMap((r) => [r.reporter_id, r.reported_user_id])));
  const messageIds = reports.map((r) => r.message_id).filter((v): v is string => !!v);

  const [{ data: profiles }, { data: reportedMessages }] = await Promise.all([
    userIds.length
      ? admin.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; avatar_url: string | null }[] }),
    messageIds.length
      ? admin.from('messages').select('id, body, created_at, conversation_id').in('id', messageIds)
      : Promise.resolve({ data: [] as { id: string; body: string; created_at: string; conversation_id: string }[] }),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const nameOf = (id: string) => profileById.get(id)?.full_name || 'Sans nom';
  const messageById = new Map((reportedMessages ?? []).map((m) => [m.id, m]));

  // Conversation liant les deux parties d'un signalement rattaché à un trajet —
  // permet à l'admin de lire l'échange pour trancher.
  const tripIds = Array.from(new Set(reports.map((r) => r.trip_id).filter((v): v is string => !!v)));
  const { data: conversationRows } = tripIds.length
    ? await admin.from('conversations').select('id, trip_id, traveler_id, sender_id').in('trip_id', tripIds)
    : { data: [] };

  const conversationIdByReport = new Map(
    reports
      .map((r) => {
        if (r.message_id) {
          const conversationId = messageById.get(r.message_id)?.conversation_id;
          return conversationId ? ([r.id, conversationId] as [string, string]) : null;
        }
        if (!r.trip_id) return null;
        const match = (conversationRows ?? []).find(
          (c) =>
            c.trip_id === r.trip_id &&
            ((c.traveler_id === r.reporter_id && c.sender_id === r.reported_user_id) ||
              (c.traveler_id === r.reported_user_id && c.sender_id === r.reporter_id)),
        );
        return match ? ([r.id, match.id] as [string, string]) : null;
      })
      .filter((v): v is [string, string] => !!v),
  );

  const statusCounts = reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const targetCounts = reports.reduce<Record<string, number>>((acc, r) => {
    const key = targetOf(r);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const buildHref = (patch: { status?: string; target?: string }) => {
    const params = new URLSearchParams();
    const merged = { status, target, ...patch };
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    const qs = params.toString();
    return qs ? `/reports?${qs}` : '/reports';
  };

  return (
    <div>
      <PageHeader
        title="File de modération"
        subtitle={`${visible.length} signalement(s) affiché(s)`}
      />

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="En attente" value={statusCounts.pending ?? 0} accent={(statusCounts.pending ?? 0) > 0 ? 'red' : 'emerald'} />
        <StatTile label="En cours d’examen" value={statusCounts.reviewed ?? 0} accent="amber" />
        <StatTile label="Résolus" value={statusCounts.resolved ?? 0} accent="emerald" />
        <StatTile label="Rejetés" value={statusCounts.dismissed ?? 0} />
      </div>

      {!migrated && (
        <div className="mt-6 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-5 text-sm text-amber-800">
          <p className="font-semibold">Migration non appliquée</p>
          <p className="mt-1">
            La distinction utilisateur / trajet / message et les sanctions rapides nécessitent la migration{' '}
            <code className="rounded bg-white px-1 py-0.5 text-xs">supabase/migrations/0001_admin_moderation.sql</code>.
            En attendant, la cible est déduite de la présence d’un trajet.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted">Statut</span>
        {['', 'pending', 'reviewed', 'resolved', 'dismissed'].map((s) => (
          <FilterPill key={s || 'all'} href={buildHref({ status: s })} active={(status ?? '') === s}>
            {s ? STATUS_LABEL[s] : 'Tous'}
          </FilterPill>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted">Cible</span>
        <FilterPill href={buildHref({ target: '' })} active={!target}>Toutes</FilterPill>
        {(['user', 'trip', 'message'] as const).map((t) => (
          <FilterPill key={t} href={buildHref({ target: t })} active={target === t}>
            {TARGET_LABEL[t]} ({targetCounts[t] ?? 0})
          </FilterPill>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {visible.map((r) => {
          const kind = targetOf(r);
          const message = r.message_id ? messageById.get(r.message_id) : null;
          const conversationId = conversationIdByReport.get(r.id);
          const reported = profileById.get(r.reported_user_id);

          return (
            <Panel key={r.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tint={TARGET_TINT[kind] ?? 'bg-brand-mist text-slate'}>{TARGET_LABEL[kind] ?? kind}</Badge>
                    <span className="font-semibold text-ink">{r.reason}</span>
                    <Badge tint={STATUS_TINT[r.status] ?? 'bg-brand-mist text-slate'}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate">
                    <Avatar name={nameOf(r.reporter_id)} url={profileById.get(r.reporter_id)?.avatar_url} size={20} />
                    <Link href={`/users/${r.reporter_id}`} className="font-medium text-brand-600 hover:underline">
                      {nameOf(r.reporter_id)}
                    </Link>
                    <span>a signalé</span>
                    <Avatar name={nameOf(r.reported_user_id)} url={reported?.avatar_url} size={20} />
                    <Link href={`/users/${r.reported_user_id}`} className="font-medium text-brand-600 hover:underline">
                      {nameOf(r.reported_user_id)}
                    </Link>
                    <span>· {formatDateTime(r.created_at)}</span>
                  </div>
                </div>
                <ReportStatusButtons reportId={r.id} status={r.status} />
              </div>

              {r.description && <p className="mt-3 text-sm text-slate">{r.description}</p>}

              {message && (
                <div className="mt-3 rounded-xl border-l-4 border-amber-400 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-semibold text-amber-800">Message signalé · {formatDateTime(message.created_at)}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{message.body}</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
                <div className="flex flex-wrap gap-3 text-xs font-semibold">
                  {conversationId && (
                    <Link href={`/conversations/${conversationId}`} className="text-brand-600 hover:underline">
                      Lire la conversation →
                    </Link>
                  )}
                  {r.trip_id && (
                    <Link href={`/users/${r.reported_user_id}?tab=trajets`} className="text-brand-600 hover:underline">
                      Voir le trajet →
                    </Link>
                  )}
                  <Link href={`/users/${r.reported_user_id}?tab=sanctions`} className="text-brand-600 hover:underline">
                    Historique des sanctions →
                  </Link>
                </div>
                <QuickSanction userId={r.reported_user_id} reportId={r.id} reason={r.reason} />
              </div>
            </Panel>
          );
        })}
        {visible.length === 0 && (
          <Panel className="p-8 text-center text-sm text-muted">Aucun signalement pour ces filtres.</Panel>
        )}
      </div>
    </div>
  );
}
