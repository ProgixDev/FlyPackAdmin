'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function setReportStatus(reportId: string, status: 'reviewed' | 'resolved' | 'dismissed') {
  const adminId = await requireAdmin();

  const admin = createAdminClient();
  const { error } = await admin
    .from('reports')
    .update({ status, resolved_by: adminId, resolved_at: new Date().toISOString() })
    .eq('id', reportId);
  if (error) throw error;
  revalidatePath('/reports');
}
