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

  return (
    <div className="flex flex-1 bg-brand-mist">
      <aside className="flex w-60 flex-col border-r border-hairline bg-white px-4 py-6">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-sm font-extrabold text-white shadow-[0_8px_20px_-8px_rgba(53,184,252,0.7)]">
            F
          </div>
          <span className="text-base font-extrabold tracking-tight text-ink">FlyBaze Admin</span>
        </div>
        <NavLinks />
        <div className="mt-auto px-2">
          <p className="mb-2 truncate text-xs text-muted">{user.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto p-8">{children}</main>
    </div>
  );
}
