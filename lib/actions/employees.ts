'use server';

import { createAdminClient, createClient } from '@/lib/supabase/server';
import { employeeSchema } from '@/lib/validation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUser } from '@/lib/actions/auth';

async function fetchEmployeesFromDb() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('Error fetching employees:', error);
    return [];
  }
}

export async function getEmployees() {
  return fetchEmployeesFromDb();
}

export async function createEmployee(prevState: any, data: any) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return { error: 'Unauthorized: Staff management privileges required' };
    }

    const parsed = employeeSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    if (!parsed.data.password) {
      return { error: 'Password is required when creating a new employee' };
    }

    // Role level check: Only super_admin can create super_admin or admin
    if (parsed.data.role === 'super_admin' && currentUser.role !== 'super_admin') {
      return { error: 'Unauthorized: Only super administrators can create super administrators' };
    }
    if (parsed.data.role === 'admin' && currentUser.role !== 'super_admin') {
      return { error: 'Unauthorized: Only super administrators can create store owner administrators' };
    }
    if (parsed.data.role === 'manager' && currentUser.role !== 'super_admin' && currentUser.role !== 'admin') {
      return { error: 'Unauthorized: Only administrators can create manager accounts' };
    }

    // Branch check: Managers can only create staff for their own branch.
    // A manager always assigns their own branch (the UI does not let them pick one),
    // so fall back to the manager's branch when none is supplied.
    let targetBranchId = parsed.data.branch_id || null;
    if (currentUser.role === 'manager') {
      targetBranchId = currentUser.branch_id || null;
      if (!targetBranchId) {
        return { error: 'Your account is not assigned to a branch.' };
      }
    }

    const adminSupabase = await createAdminClient();

    // 1. Create the user in Supabase Auth
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        full_name: parsed.data.full_name,
        role: parsed.data.role,
      },
    });

    if (authError) {
      return { error: authError.message };
    }

    const userId = authData.user?.id;
    if (!userId) {
      return { error: 'Failed to create auth user' };
    }

    // 2. Update the profile fields to set phone, active state, and branch association using adminSupabase (secure write)
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .update({
        phone: parsed.data.phone || null,
        is_active: parsed.data.is_active,
        branch_id: targetBranchId,
      })
      .eq('id', userId);

    if (profileError) {
      // Clean up Auth user if profile sync fails
      await adminSupabase.auth.admin.deleteUser(userId);
      return { error: profileError.message };
    }

    revalidateTag('employees', 'max');
    revalidatePath('/admin/employees');
    return { success: true };
  } catch (error: any) {
    return { error: 'An unexpected error occurred' };
  }
}

export async function updateEmployee(id: string, prevState: any, data: any) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return { error: 'Unauthorized: Staff management privileges required' };
    }

    const parsed = employeeSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    // Secure lookup: Use RLS client to verify if the currentUser can even see the target profile
    const clientSupabase = await createClient();
    const { data: targetProfile, error: targetProfileError } = await clientSupabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (targetProfileError || !targetProfile) {
      return { error: 'Employee profile not found' };
    }

    const adminSupabase = await createAdminClient();

    // Role boundaries checks:
    // Only super_admin can touch/manage super_admin
    if (targetProfile.role === 'super_admin' && currentUser.role !== 'super_admin') {
      return { error: 'Unauthorized: Only super administrators can manage super administrator accounts' };
    }
    if (parsed.data.role === 'super_admin' && currentUser.role !== 'super_admin') {
      return { error: 'Unauthorized: Only super administrators can assign super administrator role' };
    }

    // Only super_admin can touch/manage admin
    if (targetProfile.role === 'admin' && currentUser.role !== 'super_admin') {
      return { error: 'Unauthorized: Only super administrators can manage store owner administrator accounts' };
    }
    if (parsed.data.role === 'admin' && currentUser.role !== 'super_admin') {
      return { error: 'Unauthorized: Only super administrators can assign store owner administrator role' };
    }

    // Manager constraints:
    // Manager cannot manage a manager account
    if (targetProfile.role === 'manager' && currentUser.role !== 'super_admin' && currentUser.role !== 'admin') {
      return { error: 'Unauthorized: Only administrators can manage manager accounts' };
    }
    if (parsed.data.role === 'manager' && currentUser.role !== 'super_admin' && currentUser.role !== 'admin') {
      return { error: 'Unauthorized: Only administrators can assign manager role' };
    }

    // Manager branch check.
    // A manager always operates within their own branch: the UI does not let them change
    // the submitted branch, so when none is supplied, preserve the target's branch and
    // fall back to the manager's own branch for the write.
    let targetBranchId = parsed.data.branch_id || targetProfile.branch_id || null;
    if (currentUser.role === 'manager') {
      if (targetProfile.branch_id !== currentUser.branch_id) {
        return { error: 'Unauthorized: Managers can only manage staff for their own branch' };
      }
      targetBranchId = currentUser.branch_id || targetProfile.branch_id || null;
    }
    // Fetch current auth user details for rollback support
    const { data: { user: originalUser }, error: fetchUserError } = await adminSupabase.auth.admin.getUserById(id);
    if (fetchUserError || !originalUser) {
      return { error: fetchUserError?.message || 'Employee auth record not found' };
    }

    // 1. Update Auth settings (email/password if provided)
    const updateData: { email: string; password?: string } = {
      email: parsed.data.email,
    };
    if (parsed.data.password) {
      updateData.password = parsed.data.password;
    }

    const { error: authError } = await adminSupabase.auth.admin.updateUserById(id, updateData);
    if (authError) {
      return { error: authError.message };
    }

    // 2. Update Profile fields using adminSupabase (secure write)
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .update({
        full_name: parsed.data.full_name,
        email: parsed.data.email,
        role: parsed.data.role,
        phone: parsed.data.phone || null,
        is_active: parsed.data.is_active,
        branch_id: targetBranchId,
      })
      .eq('id', id);

    if (profileError) {
      console.error('Profile update failed, rolling back Auth user updates:', profileError);
      const rollbackData = {
        email: originalUser.email!,
      };
      const { error: rollbackError } = await adminSupabase.auth.admin.updateUserById(id, rollbackData);
      if (rollbackError) {
        console.error('Critical: Failed to roll back Auth user updates:', rollbackError);
      }

      // Generate a recovery link to notify the user/allow reset since password rollback cannot be direct
      const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
        type: 'recovery',
        email: originalUser.email!,
      });
      if (linkError) {
        console.error('Failed to generate recovery link during password rollback:', linkError);
        console.log(JSON.stringify({
          event: 'recovery_link_generated',
          email: originalUser.email,
          timestamp: new Date().toISOString()
        }));
      }

      return { error: profileError.message };
    }

    revalidateTag('employees', 'max');
    revalidatePath('/admin/employees');
    return { success: true };
  } catch (error: any) {
    return { error: 'An unexpected error occurred' };
  }
}

export async function toggleEmployeeStatus(id: string, isActive: boolean) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'admin' && currentUser.role !== 'manager')) {
      return { error: 'Unauthorized: Staff management privileges required' };
    }

    const supabase = await createClient();
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (!targetProfile) {
      return { error: 'Employee not found' };
    }

    if (targetProfile.role === 'super_admin' && currentUser.role !== 'super_admin') {
      return { error: 'Unauthorized: Only super administrators can manage super administrator accounts' };
    }
    if (targetProfile.role === 'admin' && currentUser.role !== 'super_admin') {
      return { error: 'Unauthorized: Only super administrators can manage store owner administrator accounts' };
    }

    if (targetProfile.role === 'manager' && currentUser.role !== 'super_admin' && currentUser.role !== 'admin') {
      return { error: 'Unauthorized: Only administrators can manage manager accounts' };
    }

    if (currentUser.role === 'manager' && targetProfile.branch_id !== currentUser.branch_id) {
      return { error: 'Unauthorized: Managers can only toggle status of staff in their own branch' };
    }

    const adminSupabase = await createAdminClient();
    const { error } = await adminSupabase
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      return { error: 'Failed to update employee status' };
    }

    revalidateTag('employees', 'max');
    revalidatePath('/admin/employees');
    return { success: true };
  } catch (error: any) {
    return { error: 'An unexpected error occurred' };
  }
}
