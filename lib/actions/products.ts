'use server';

import { createClient } from '@/lib/supabase/server';
import { productSchema } from '@/lib/validation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUser } from '@/lib/actions/auth';
import { hasAdminRole } from '@/lib/roles';

async function fetchProductsFromDb(searchQuery?: string) {
  try {
    const supabase = await createClient();
    let query = supabase.from('products').select('*').order('name', { ascending: true });

    if (searchQuery) {
      if (/^\d+$/.test(searchQuery)) {
        query = query.or(`barcode.eq.${searchQuery},name.ilike.%${searchQuery}%`);
      } else {
        query = query.or(`name.ilike.%${searchQuery}%,generic_name.ilike.%${searchQuery}%`);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return [];
  }
}

export async function getProducts(searchQuery?: string) {
  return fetchProductsFromDb(searchQuery);
}

export async function createProduct(prevState: any, data: any) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasAdminRole(currentUser)) {
      return { error: 'Unauthorized: Admin privileges required' };
    }

    const parsed = productSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const productData = {
      ...parsed.data,
      generic_name: parsed.data.generic_name || null,
      manufacturer: parsed.data.manufacturer || null,
      category: parsed.data.category || null,
      composition: parsed.data.composition || null,
      strength: parsed.data.strength || null,
      pack_size: parsed.data.pack_size || null,
      unit: parsed.data.unit || null,
      hsn_code: parsed.data.hsn_code || null,
      barcode: parsed.data.barcode || null,
    };

    const supabase = await createClient();
    const { error } = await supabase.from('products').insert([productData]);

    if (error) {
      if (error.code === '23505') {
        return { error: 'A product with this barcode already exists' };
      }
      return { error: 'Failed to create product' };
    }

    revalidateTag('products', 'max');
    revalidatePath('/admin/products');
    revalidatePath('/employee/stock');
    return { success: true };
  } catch (error: any) {
    return { error: 'An unexpected error occurred' };
  }
}

export async function updateProduct(id: string, prevState: any, data: any) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasAdminRole(currentUser)) {
      return { error: 'Unauthorized: Admin privileges required' };
    }

    const parsed = productSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }

    const productData = {
      ...parsed.data,
      generic_name: parsed.data.generic_name || null,
      manufacturer: parsed.data.manufacturer || null,
      category: parsed.data.category || null,
      composition: parsed.data.composition || null,
      strength: parsed.data.strength || null,
      pack_size: parsed.data.pack_size || null,
      unit: parsed.data.unit || null,
      hsn_code: parsed.data.hsn_code || null,
      barcode: parsed.data.barcode || null,
    };

    const supabase = await createClient();
    const { error } = await supabase
      .from('products')
      .update(productData)
      .eq('id', id);

    if (error) {
      if (error.code === '23505') {
        return { error: 'A product with this barcode already exists' };
      }
      return { error: 'Failed to update product' };
    }

    revalidateTag('products', 'max');
    revalidatePath('/admin/products');
    revalidatePath('/employee/stock');
    return { success: true };
  } catch (error: any) {
    return { error: 'An unexpected error occurred' };
  }
}

export async function deleteProduct(id: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasAdminRole(currentUser)) {
      return { error: 'Unauthorized: Admin privileges required' };
    }

    const supabase = await createClient();
    const { error } = await supabase.from('products').delete().eq('id', id);

    if (error) {
      return { error: 'Failed to delete product' };
    }

    revalidateTag('products', 'max');
    revalidatePath('/admin/products');
    revalidatePath('/employee/stock');
    return { success: true };
  } catch (error: any) {
    return { error: 'An unexpected error occurred' };
  }
}

export async function getPOSProducts() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return [];
    }

    const isPlaceholder = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder-project') && process.env.NODE_ENV !== 'production';
    if (isPlaceholder) {
      // Return mock products with mock batches
      return [
        {
          id: 'prod-1',
          name: 'Paracetamol 650mg (Dolo)',
          generic_name: 'Paracetamol',
          manufacturer: 'Micro Labs',
          category: 'Analgesics',
          composition: 'Paracetamol 650mg',
          strength: '650mg',
          pack_size: '15',
          unit: 'strip',
          hsn_code: '30049011',
          barcode: '8901123456789',
          requires_prescription: false,
          tax_rate: 12,
          batches: [
            {
              id: 'bat-1',
              product_id: 'prod-1',
              batch_number: 'PAR-2601',
              expiry_date: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0], // 6 months
              quantity_available: 150,
              purchase_price: 25.00,
              mrp: 30.90,
              selling_price: 30.90,
              branch_id: currentUser.branch_id || 'br-1',
            },
            {
              id: 'bat-2',
              product_id: 'prod-1',
              batch_number: 'PAR-2602',
              expiry_date: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString().split('T')[0], // 15 days (near expiry)
              quantity_available: 50,
              purchase_price: 25.00,
              mrp: 30.90,
              selling_price: 30.90,
              branch_id: currentUser.branch_id || 'br-1',
            },
            {
              id: 'bat-3',
              product_id: 'prod-1',
              batch_number: 'PAR-2501',
              expiry_date: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString().split('T')[0], // Expired
              quantity_available: 20,
              purchase_price: 25.00,
              mrp: 30.90,
              selling_price: 30.90,
              branch_id: currentUser.branch_id || 'br-1',
            }
          ]
        },
        {
          id: 'prod-2',
          name: 'Amoxicillin 500mg',
          generic_name: 'Amoxicillin',
          manufacturer: 'Alkem Labs',
          category: 'Antibiotics',
          composition: 'Amoxicillin 500mg',
          strength: '500mg',
          pack_size: '10',
          unit: 'strip',
          hsn_code: '30041010',
          barcode: '8902234567890',
          requires_prescription: true,
          tax_rate: 12,
          batches: [
            {
              id: 'bat-4',
              product_id: 'prod-2',
              batch_number: 'AMX-9988',
              expiry_date: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
              quantity_available: 100,
              purchase_price: 60.00,
              mrp: 75.00,
              selling_price: 75.00,
              branch_id: currentUser.branch_id || 'br-1',
            }
          ]
        },
        {
          id: 'prod-3',
          name: 'Atorvastatin 10mg (Lipvas)',
          generic_name: 'Atorvastatin',
          manufacturer: 'Cipla',
          category: 'Cardiovascular',
          composition: 'Atorvastatin 10mg',
          strength: '10mg',
          pack_size: '10',
          unit: 'strip',
          hsn_code: '30049099',
          barcode: '8903345678901',
          requires_prescription: true,
          tax_rate: 18,
          batches: [
            {
              id: 'bat-5',
              product_id: 'prod-3',
              batch_number: 'ATO-4455',
              expiry_date: new Date(Date.now() + 450 * 24 * 3600 * 1000).toISOString().split('T')[0],
              quantity_available: 80,
              purchase_price: 40.00,
              mrp: 52.00,
              selling_price: 52.00,
              branch_id: currentUser.branch_id || 'br-1',
            }
          ]
        },
        {
          id: 'prod-4',
          name: 'Pan-D Capsule',
          generic_name: 'Pantoprazole + Domperidone',
          manufacturer: 'Alkem Labs',
          category: 'Gastrointestinal',
          composition: 'Pantoprazole 40mg + Domperidone 30mg',
          strength: '40mg/30mg',
          pack_size: '15',
          unit: 'strip',
          hsn_code: '30049039',
          barcode: '8904456789012',
          requires_prescription: false,
          tax_rate: 12,
          batches: [
            {
              id: 'bat-6',
              product_id: 'prod-4',
              batch_number: 'PND-1234',
              expiry_date: new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString().split('T')[0],
              quantity_available: 12,
              purchase_price: 110.00,
              mrp: 142.50,
              selling_price: 142.50,
              branch_id: currentUser.branch_id || 'br-1',
            }
          ]
        }
      ];
    }

    const supabase = await createClient();

    // Fetch all products
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (prodError) throw prodError;

    // Fetch active batches (unexpired and quantity_available > 0)
    let batchQuery = supabase
      .from('batches')
      .select('*')
      .gt('quantity_available', 0)
      .gte('expiry_date', new Date().toISOString().split('T')[0]);

    // Scope to branch if current user is manager or employee
    if (currentUser.role === 'manager' || currentUser.role === 'employee') {
      if (currentUser.branch_id) {
        batchQuery = batchQuery.eq('branch_id', currentUser.branch_id);
      }
    }

    const { data: batches, error: batchError } = await batchQuery;
    if (batchError) throw batchError;

    // Map batches to products
    const productBatchesMap: Record<string, any[]> = {};
    batches?.forEach((batch) => {
      if (!productBatchesMap[batch.product_id]) {
        productBatchesMap[batch.product_id] = [];
      }
      productBatchesMap[batch.product_id].push({
        ...batch,
        selling_price: Number(batch.selling_price),
        mrp: Number(batch.mrp),
        purchase_price: Number(batch.purchase_price),
      });
    });

    // Sort batches by expiry_date asc (FEFO)
    Object.keys(productBatchesMap).forEach((prodId) => {
      productBatchesMap[prodId].sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());
    });

    return products.map((p) => ({
      ...p,
      tax_rate: Number(p.tax_rate),
      batches: productBatchesMap[p.id] || [],
    }));
  } catch (error: any) {
    console.error('Error fetching POS products:', error);
    return [];
  }
}
