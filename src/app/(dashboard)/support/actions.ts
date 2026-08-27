'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function replyToTicket(ticketId: string, reply: string) {
  const adminId = await requireAdmin();

  const admin = createAdminClient();
  const { error } = await admin
    .from('support_tickets')
    .update({ admin_reply: reply, status: 'answered', answered_by: adminId, updated_at: new Date().toISOString() })
    .eq('id', ticketId);
  if (error) throw error;
  revalidatePath('/support');
}

export async function closeTicket(ticketId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from('support_tickets')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', ticketId);
  if (error) throw error;
  revalidatePath('/support');
}
