'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getNotifications() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

export async function getUnreadNotificationsCount() {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  } catch (error: any) {
    console.error('Error getting unread notifications count:', error);
    return 0;
  }
}

export async function markNotificationAsRead(id: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      return { error: 'Failed to update notification' };
    }

    revalidatePath('/admin/dashboard');
    revalidatePath('/employee/dashboard');
    return { success: true };
  } catch (error: any) {
    return { error: 'An unexpected error occurred' };
  }
}

export async function markAllNotificationsAsRead() {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false);

    if (error) {
      return { error: 'Failed to update notifications' };
    }

    revalidatePath('/admin/dashboard');
    revalidatePath('/employee/dashboard');
    return { success: true };
  } catch (error: any) {
    return { error: 'An unexpected error occurred' };
  }
}
