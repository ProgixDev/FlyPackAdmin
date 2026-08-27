'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');
  if (!email || !password) return { error: 'Entrez votre e-mail et votre mot de passe.' };

  // Une configuration incomplète produisait la même erreur qu'un mauvais mot de
  // passe, ce qui rend la panne indiscernable d'une faute de frappe.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[login] Variables Supabase manquantes côté serveur.');
    return { error: 'Configuration Supabase absente. Vérifiez les variables d’environnement.' };
  }

  // L'hôte réellement contacté : une faute de frappe dans l'URL du projet
  // produit un échec réseau indistinguable d'une panne Supabase.
  let target = process.env.NEXT_PUBLIC_SUPABASE_URL.trim();
  try {
    target = new URL(target).host;
  } catch {
    console.error('[login] NEXT_PUBLIC_SUPABASE_URL n’est pas une URL valide :', JSON.stringify(target));
    return { error: `L’URL Supabase configurée est invalide : ${JSON.stringify(target)}` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Le détail part dans les logs serveur : c'est la seule trace exploitable
    // quand la connexion échoue pour une raison qui n'est pas le mot de passe.
    // `cause` porte le code réseau (ENOTFOUND, ECONNREFUSED…) quand il y en a un.
    console.error(
      '[login] signInWithPassword a échoué :',
      JSON.stringify({ host: target, status: error.status, code: error.code, message: error.message }),
      (error as { cause?: unknown }).cause ?? '',
    );

    if (error.code === 'email_not_confirmed') {
      return { error: 'Cet e-mail n’est pas confirmé. Confirmez-le dans Supabase, ou cochez « Auto Confirm User ».' };
    }
    if (error.status === 401 && error.code !== 'invalid_credentials') {
      return { error: 'Clé Supabase refusée. La clé anon/publishable configurée n’est plus valide.' };
    }
    if (!error.status) {
      return { error: `Supabase injoignable depuis le serveur. Hôte contacté : ${target}` };
    }
    return { error: 'Identifiants incorrects.' };
  }

  const admin = createAdminClient();
  const { data: adminRow, error: adminError } = await admin
    .from('admins')
    .select('id')
    .eq('id', data.user.id)
    .maybeSingle();

  if (adminError) {
    console.error('[login] Lecture de la table admins impossible :', adminError.message);
    await supabase.auth.signOut();
    return { error: 'Impossible de vérifier les droits administrateur. Vérifiez la clé service-role.' };
  }

  if (!adminRow) {
    await supabase.auth.signOut();
    return {
      error: `Ce compte n’a pas les droits administrateur. Ajoutez son identifiant (${data.user.id}) dans la table admins.`,
    };
  }

  return { error: null };
}
