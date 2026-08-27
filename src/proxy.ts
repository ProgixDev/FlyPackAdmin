import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Depuis Next.js 16, le middleware s'appelle proxy et s'exécute sur le runtime
 * Node.js. La doc est explicite : ce n'est pas l'endroit pour aller chercher
 * des données lentes, ni pour porter l'autorisation.
 *
 * Ici, on ne fait qu'une chose : rafraîchir la session Supabase pour que les
 * Server Components lisent un jeton valide — les Server Components ne peuvent
 * pas écrire de cookies eux-mêmes. L'autorisation réelle vit dans le layout du
 * dashboard et dans requireAdmin() côté Server Actions.
 */

/** Au-delà, on laisse passer la requête plutôt que de la faire échouer en 504. */
const REFRESH_TIMEOUT_MS = 3_000;

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Sans cookie de session, il n'y a rien à rafraîchir. Ce raccourci évite un
  // aller-retour réseau vers Supabase pour chaque visiteur anonyme et chaque
  // robot — c'est-à-dire pour l'essentiel du trafic.
  const hasSession = request.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-'));
  if (!hasSession) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Un Supabase lent ou injoignable ne doit pas emporter toute l'application :
  // on abandonne le rafraîchissement et on laisse le layout trancher, quitte à
  // renvoyer l'utilisateur vers /login.
  await Promise.race([
    supabase.auth.getUser(),
    new Promise((resolve) => setTimeout(resolve, REFRESH_TIMEOUT_MS)),
  ]);

  return response;
}

export const config = {
  // Le proxy ne sert qu'aux pages authentifiées : ni les fichiers statiques,
  // ni la page de connexion (qui écrit ses cookies depuis une Server Action)
  // n'ont besoin d'un rafraîchissement de session.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.png|login|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
};
