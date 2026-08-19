'use server';

import { createClient } from '@/lib/supabase/server';
import { batchSchema } from '@/lib/validation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/actions/auth';
import { hasAdminRole } from '@/lib/roles';

export async function getBatches(productId?: string) {
  try {
    const supabase = await createClient();
    let query = supabase
      .from('batches')
      .select('*, products(name, generic_name, unit, tax_rate, barcode), suppliers(name)')
      .order('expiry_date', { ascending: true });

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('Error fetching batches:', error);
    return [];
  }
}

export async function createBatch(prevState: any, data: any) {
  try {
    const parsed = batchSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { error: 'Unauthorized: Session not found' };
    }

    const supabase = await createClient();

    let targetBranchId: string | null = null;
    if (currentUser.role === 'manager' || currentUser.role === 'employee') {
      targetBranchId = currentUser.branch_id || null;
      if (!targetBranchId) {
        return { error: 'Your account is not assigned to any branch.' };
      }
    } else {
      targetBranchId = parsed.data.branch_id || currentUser.branch_id || null;
      if (!targetBranchId) {
        return { error: 'Please select a valid branch for this batch.' };
      }

      // Validate the branch exists and is active
      const { data: branchCheck } = await supabase
        .from('branches')
        .select('is_active')
        .eq('id', targetBranchId)
        .single();

      if (!branchCheck) {
        return { error: 'The selected branch does not exist.' };
      }
      if (!branchCheck.is_active) {
        return { error: 'The selected branch is inactive and cannot accept new batches.' };
      }
    }

    // Ensure quantity_available starts at 0.
    // The DB trigger trigger_auto_purchase_movement will create a purchase movement,
    // which in turn triggers trigger_update_batch_stock to set quantity_available to quantity_received.
    const batchData = {
      ...parsed.data,
      quantity_available: 0,
      branch_id: targetBranchId,
    };

    const { error } = await supabase.from('batches').insert([batchData]);

    if (error) {
      return { error: 'Failed to create batch' };
    }

    revalidatePath('/admin/batches');
    revalidatePath('/admin/products');
    revalidatePath('/employee/stock');
    return { success: true };
  } catch (error: any) {
    return { error: 'An unexpected error occurred' };
  }
}

export async function updateBatch(id: string, prevState: any, data: any) {
  try {
    const parsed = batchSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { error: 'Unauthorized: Session not found' };
    }

    const supabase = await createClient();

    // Fetch batch to verify branch access
    const { data: existingBatch } = await supabase
      .from('batches')
      .select('branch_id')
      .eq('id', id)
      .single();

    if (!existingBatch) {
      return { error: 'Batch not found or unauthorized' };
    }

    // Exclude quantity fields from standard update to preserve ledger integrity
    const { quantity_received, quantity_available, ...updateFields } = parsed.data;

    const { error } = await supabase
      .from('batches')
      .update(updateFields)
      .eq('id', id);

    if (error) {
      return { error: 'Failed to update batch' };
    }

    revalidatePath('/admin/batches');
    revalidatePath('/employee/stock');
    return { success: true };
  } catch (error: any) {
    return { error: 'An unexpected error occurred' };
  }
}

export async function deleteBatch(id: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasAdminRole(currentUser)) {
      return { error: 'Unauthorized: Admin privileges required' };
    }

    const supabase = await createClient();

    // Verify branch access before deleting
    const { data: existingBatch } = await supabase
      .from('batches')
      .select('branch_id')
      .eq('id', id)
      .single();

    if (!existingBatch) {
      return { error: 'Batch not found or unauthorized' };
    }

    const { error } = await supabase.from('batches').delete().eq('id', id);

    if (error) {
      return { error: 'Failed to delete batch' };
    }

    revalidatePath('/admin/batches');
    revalidatePath('/employee/stock');
    return { success: true };
  } catch (error: any) {
    return { error: 'An unexpected error occurred' };
  }
}
