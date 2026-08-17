import 'server-only';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

/**
 * Service-role client — bypasses RLS entirely. Only ever import this from
 * Server Components, Server Actions, or Route Handlers. The `server-only`
 * import above makes any accidental client-bundle import a build error.
 */
export function createAdminClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
