-- =============================================================================
-- Flybaz Admin — modération, sanctions et messagerie interne
-- =============================================================================
-- À exécuter dans le SQL Editor Supabase (projet zuxfssznrcjbsiusjicr).
-- Le script est idempotent : le relancer ne casse rien.
-- =============================================================================


-- 1. SANCTIONS ---------------------------------------------------------------
-- Historique complet des avertissements, suspensions et bannissements.
-- Une suspension peut être assortie d'un montant de réactivation : le compte
-- ne doit être réactivé qu'une fois ce montant encaissé.

create table if not exists public.sanctions (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references public.profiles(id) on delete cascade,
  kind                        text not null check (kind in ('warning', 'suspension', 'ban')),
  reason                      text not null,
  note                        text,

  -- Durée : renseignée uniquement pour les suspensions temporaires.
  duration_days               integer,
  starts_at                   timestamptz not null default now(),
  ends_at                     timestamptz,

  -- Levée de la sanction (réactivation du compte).
  lifted_at                   timestamptz,
  lifted_by                   uuid references public.admins(id) on delete set null,

  -- Montant à régler pour obtenir la réactivation. 0 = aucune condition.
  reinstatement_amount_cents  integer not null default 0 check (reinstatement_amount_cents >= 0),
  reinstatement_currency      text not null default 'eur',
  reinstatement_paid_at       timestamptz,
  -- Référence libre du règlement (virement, reçu, ou futur payment_intent Stripe).
  reinstatement_payment_ref   text,

  -- Signalement à l'origine de la sanction, si elle vient de la file de modération.
  report_id                   uuid references public.reports(id) on delete set null,

  created_by                  uuid references public.admins(id) on delete set null,
  created_at                  timestamptz not null default now()
);

create index if not exists sanctions_user_id_created_at_idx
  on public.sanctions (user_id, created_at desc);
create index if not exists sanctions_active_idx
  on public.sanctions (user_id) where lifted_at is null;

comment on table public.sanctions is
  'Historique des sanctions administratives appliquées à un compte.';
comment on column public.sanctions.reinstatement_amount_cents is
  'Montant (en centimes) que l''utilisateur doit régler pour être réactivé. 0 = pas de condition de paiement.';


-- 2. MESSAGERIE INTERNE ADMIN -> UTILISATEUR ---------------------------------
-- L'admin écrit depuis la fiche utilisateur. L'app mobile devra afficher ces
-- messages dans un onglet « Messages de l'équipe ».

create table if not exists public.admin_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  admin_id    uuid references public.admins(id) on delete set null,
  subject     text,
  body        text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists admin_messages_user_id_created_at_idx
  on public.admin_messages (user_id, created_at desc);

comment on table public.admin_messages is
  'Messages envoyés par l''équipe Flybaz à un utilisateur depuis le back-office.';


-- 3. SIGNALEMENTS : cibler aussi un message ----------------------------------
-- La file de modération distingue trois cibles : utilisateur, trajet, message.

alter table public.reports
  add column if not exists message_id uuid references public.messages(id) on delete set null;

alter table public.reports
  add column if not exists target_type text not null default 'user';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reports_target_type_check'
  ) then
    alter table public.reports
      add constraint reports_target_type_check
      check (target_type in ('user', 'trip', 'message'));
  end if;
end $$;

-- Rattrape les signalements existants déjà liés à un trajet.
update public.reports
   set target_type = 'trip'
 where trip_id is not null
   and target_type = 'user';


-- 4. RLS ---------------------------------------------------------------------
-- Le back-office utilise la clé service_role, qui contourne RLS. Ces règles
-- servent donc uniquement à l'app mobile (clé anon/authenticated).

alter table public.sanctions enable row level security;
alter table public.admin_messages enable row level security;

-- Un utilisateur voit ses propres sanctions (pour afficher « compte suspendu,
-- réactivation conditionnée au règlement de X »).
drop policy if exists "sanctions: read own" on public.sanctions;
create policy "sanctions: read own"
  on public.sanctions for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Un utilisateur lit ses messages de l'équipe...
drop policy if exists "admin_messages: read own" on public.admin_messages;
create policy "admin_messages: read own"
  on public.admin_messages for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ...et peut seulement les marquer comme lus.
drop policy if exists "admin_messages: mark own as read" on public.admin_messages;
create policy "admin_messages: mark own as read"
  on public.admin_messages for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- 5. DÉTECTION DE COMPTES À RISQUE -------------------------------------------
-- Les adresses IP vivent dans auth.audit_log_entries, hors de portée de
-- PostgREST. Cette fonction SECURITY DEFINER les expose au back-office pour
-- repérer plusieurs comptes créés depuis la même IP.

create or replace function public.admin_user_ips()
returns table (
  user_id     uuid,
  ip          text,
  events      bigint,
  first_seen  timestamptz,
  last_seen   timestamptz
)
language sql
security definer
set search_path = auth, public
as $$
  select
    (payload ->> 'actor_id')::uuid as user_id,
    ip_address::text               as ip,
    count(*)                       as events,
    min(created_at)                as first_seen,
    max(created_at)                as last_seen
  from auth.audit_log_entries
  where ip_address is not null
    and ip_address <> ''
    and payload ->> 'actor_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  group by 1, 2
$$;

comment on function public.admin_user_ips() is
  'Adresses IP observées par utilisateur (journal d''authentification). Réservé au back-office.';

-- Personne d'autre que le back-office ne doit appeler cette fonction.
revoke all on function public.admin_user_ips() from public, anon, authenticated;
grant execute on function public.admin_user_ips() to service_role;
