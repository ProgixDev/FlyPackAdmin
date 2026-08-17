'use server';

import { revalidatePath } from 'next/cache';

import { createAdminClient } from '@/lib/supabase/admin';

export async function banUser(userId: string) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' }); // ~100 years
  if (error) throw error;
  revalidatePath('/users');
  revalidatePath(`/users/${userId}`);
}

export async function suspendUser(userId: string, days: number) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: `${days * 24}h` });
  if (error) throw error;
  revalidatePath('/users');
  revalidatePath(`/users/${userId}`);
}

export async function unbanUser(userId: string) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
  if (error) throw error;
  revalidatePath('/users');
  revalidatePath(`/users/${userId}`);
}

export async function disableTripVisibility(tripId: string, userId: string) {
  const admin = createAdminClient();
  const { error } = await admin.from('trips').update({ visibility_paid: false }).eq('id', tripId);
  if (error) throw error;
  revalidatePath(`/users/${userId}`);
}
