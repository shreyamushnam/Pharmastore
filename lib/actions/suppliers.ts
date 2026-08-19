'use server';

import { createClient } from '@/lib/supabase/server';
import { supplierSchema } from '@/lib/validation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUser } from '@/lib/actions/auth';
import { hasAdminRole } from '@/lib/roles';

async function fetchSuppliersFromDb() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    return [];
  }
}

export async function getSuppliers() {
  return fetchSuppliersFromDb();
}

export async function createSupplier(prevState: any, data: any) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasAdminRole(currentUser)) {
      return { error: 'Unauthorized: Admin privileges required' };
    }

    const parsed = supplierSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const supplierData = {
      ...parsed.data,
      contact_person: parsed.data.contact_person || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      gstin: parsed.data.gstin || null,
      address: parsed.data.address || null,
    };

    const supabase = await createClient();
    const { error } = await supabase.from('suppliers').insert([supplierData]);

    if (error) {
      return { error: 'Failed to create supplier' };
    }

    revalidateTag('suppliers', 'max');
    revalidatePath('/admin/suppliers');
    return { success: true };
  } catch (error: any) {
    return { error: 'An unexpected error occurred' };
  }
}

export async function updateSupplier(id: string, prevState: any, data: any) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasAdminRole(currentUser)) {
      return { error: 'Unauthorized: Admin privileges required' };
    }

    const parsed = supplierSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const supplierData = {
      ...parsed.data,
      contact_person: parsed.data.contact_person || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      gstin: parsed.data.gstin || null,
      address: parsed.data.address || null,
    };

    const supabase = await createClient();
    const { error } = await supabase
      .from('suppliers')
      .update(supplierData)
      .eq('id', id);

    if (error) {
      return { error: 'Failed to update supplier' };
    }

    revalidateTag('suppliers', 'max');
    revalidatePath('/admin/suppliers');
    return { success: true };
  } catch (error: any) {
    return { error: 'An unexpected error occurred' };
  }
}

export async function deleteSupplier(id: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasAdminRole(currentUser)) {
      return { error: 'Unauthorized: Admin privileges required' };
    }

    const supabase = await createClient();
    const { error } = await supabase.from('suppliers').delete().eq('id', id);

    if (error) {
      return { error: 'Failed to delete supplier' };
    }

    revalidateTag('suppliers', 'max');
    revalidatePath('/admin/suppliers');
    return { success: true };
  } catch (error: any) {
    return { error: 'An unexpected error occurred' };
  }
}
