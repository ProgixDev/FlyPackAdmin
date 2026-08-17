'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');
  if (!email || !password) return { error: 'Entrez votre e-mail et votre mot de passe.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'Identifiants incorrects.' };

  const admin = createAdminClient();
  const { data: adminRow } = await admin.from('admins').select('id').eq('id', data.user.id).maybeSingle();
  if (!adminRow) {
    await supabase.auth.signOut();
    return { error: 'Ce compte n’a pas les droits administrateur.' };
  }

  return { error: null };
}
