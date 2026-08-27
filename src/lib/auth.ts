import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Server Actions are publicly reachable HTTP endpoints — the admin check in the
 * dashboard layout does not protect them. Every action that touches the
 * service-role client must call this first.
 */
export async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié.');

  const admin = createAdminClient();
  const { data: adminRow } = await admin.from('admins').select('id').eq('id', user.id).maybeSingle();
  if (!adminRow) throw new Error('Accès réservé aux administrateurs.');

  return user.id;
}
