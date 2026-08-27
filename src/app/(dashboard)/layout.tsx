import Image from 'next/image';
import { redirect } from 'next/navigation';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import { NavLinks } from './nav-links';
import { SignOutButton } from './sign-out-button';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { data: adminRow } = await admin.from('admins').select('id').eq('id', user.id).maybeSingle();
  if (!adminRow) redirect('/login');

  const [{ count: pendingReports }, { count: openTickets }, migrationProbe] = await Promise.all([
    admin.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    // Sonde légère : la table n'existe que si la migration a été appliquée.
    admin.from('sanctions').select('id', { count: 'exact', head: true }),
  ]);

  const migrationPending = Boolean(migrationProbe.error);

  return (
    <div className="flex flex-1 bg-brand-mist">
      <aside className="flex w-60 flex-col border-r border-hairline bg-white px-4 py-6">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl shadow-[0_8px_20px_-8px_rgba(53,184,252,0.7)]">
            <Image src="/logo.png" alt="Flybaz Express" width={40} height={40} className="h-full w-full object-cover" priority />
          </div>
          <span className="text-base font-extrabold tracking-tight text-ink">Flybaz Admin</span>
        </div>
        <NavLinks pendingReports={pendingReports ?? 0} openTickets={openTickets ?? 0} />
        <div className="mt-auto px-2">
          <p className="mb-2 truncate text-xs text-muted">{user.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto p-8">
        {migrationPending && (
          <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <p className="font-bold">Migration base de données en attente</p>
            <p className="mt-1">
              Les sanctions, la messagerie interne et la détection par IP resteront inactives tant que le fichier{' '}
              <code className="rounded bg-white px-1 py-0.5 text-xs">supabase/migrations/0001_admin_moderation.sql</code>{' '}
              n’aura pas été exécuté dans le SQL Editor de Supabase. Le reste du back-office fonctionne normalement.
            </p>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
