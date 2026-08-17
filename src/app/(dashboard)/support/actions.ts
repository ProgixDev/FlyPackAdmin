'use server';

import { revalidatePath } from 'next/cache';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function replyToTicket(ticketId: string, reply: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { error } = await admin
    .from('support_tickets')
    .update({ admin_reply: reply, status: 'answered', answered_by: user?.id ?? null, updated_at: new Date().toISOString() })
    .eq('id', ticketId);
  if (error) throw error;
  revalidatePath('/support');
}

export async function closeTicket(ticketId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from('support_tickets')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', ticketId);
  if (error) throw error;
  revalidatePath('/support');
}
