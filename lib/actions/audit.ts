'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/actions/auth';
import { hasAdminRole } from '@/lib/roles';

export async function getAuditLogs() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasAdminRole(currentUser)) {
      throw new Error('Unauthorized: Admin access required');
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
}
