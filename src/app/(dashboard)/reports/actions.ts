'use server';

import { revalidatePath } from 'next/cache';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function setReportStatus(reportId: string, status: 'reviewed' | 'resolved' | 'dismissed') {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { error } = await admin
    .from('reports')
    .update({ status, resolved_by: user?.id ?? null, resolved_at: new Date().toISOString() })
    .eq('id', reportId);
  if (error) throw error;
  revalidatePath('/reports');
}
