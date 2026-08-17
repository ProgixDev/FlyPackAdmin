'use client';

import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace('/login');
        router.refresh();
      }}
      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-500 hover:bg-slate-100"
    >
      Se déconnecter
    </button>
  );
}
