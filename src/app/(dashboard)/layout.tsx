import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import { SignOutButton } from './sign-out-button';

const NAV = [
  { href: '/', label: 'Tableau de bord' },
  { href: '/users', label: 'Utilisateurs' },
  { href: '/reports', label: 'Signalements' },
  { href: '/support', label: 'Support' },
];

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
    <div className="flex flex-1">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white px-4 py-6">
        <div className="mb-8 px-2 text-base font-extrabold text-slate-900">FlyBaze Admin</div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto px-2">
          <p className="mb-2 truncate text-xs text-slate-400">{user.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto p-8">{children}</main>
    </div>
  );
}
