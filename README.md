# FlyBaze Admin

Back-office web app for FlyBaze Express — separate from the mobile app repo, same Supabase backend (project `ppwugogzftmtlqiekiji`).

## Setup

```bash
npm install
npm run dev
```

Needs `.env.local` (already present locally, gitignored) with:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, never exposed to the browser (guarded by the `server-only` package in `src/lib/supabase/admin.ts`)

## Access control

There is no self-service sign-up. An admin account is a normal Supabase auth user (create one in the Supabase dashboard or via the mobile app's own sign-up) that also has a row in the `admins` table. Add one via SQL:

```sql
insert into public.admins (id) values ('<the user''s auth.users id>');
```

## What's built

- **Dashboard** (`/`) — user counts, active trips, packages exchanged, pending reports.
- **Users** (`/users`, `/users/[id]`) — filter by registration date / country / report count, ban permanently, suspend 7 days, disable a trip's paid visibility, view a user's sent-package history and received reports.
- **Reports** (`/reports`) — litige/report queue, mark reviewed/resolved/dismissed.
- **Support** (`/support`) — reply to user support tickets from the mobile app.

## Deliberately not built yet

Revenue (CA), premium subscribers, and viewing private chat conversations all need real infrastructure that doesn't exist in the mobile app yet (real payments/subscriptions, real chat) — see the mobile app repo's memory notes for details. Adding these here without that foundation would just be more fake data.
