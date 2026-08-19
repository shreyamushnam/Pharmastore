'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/actions/auth';
import { allocateBatchesFEFO } from '@/lib/utils/fefo';
import { revalidatePath } from 'next/cache';

interface SaleItemInput {
  productId: string;
  quantity: number;
}

interface CreateSaleInput {
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  items: SaleItemInput[];
  paymentMode: 'cash' | 'card' | 'upi';
  discount: number;
  prescriptionRef?: string; // Reference number or description
  prescriptionUrl?: string; // Supabase Storage URL
  branchId?: string;
}

export async function getSales() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('sales')
      .select('*, customers(name, phone), profiles(full_name)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('Error fetching sales:', error);
    return [];
  }
}

export async function getSaleDetails(saleId: string) {
  try {
    const isPlaceholder = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder-project') && process.env.NODE_ENV !== 'production';
    if (isPlaceholder) {
      return {
        id: saleId,
        invoice_number: 'INV-MOCK123',
        created_at: new Date().toISOString(),
        subtotal: 27.59,
        tax_amount: 3.31,
        discount: 0,
        total: 30.90,
        payment_mode: 'cash',
        branch_id: 'br-1',
        customers: { name: 'Walk-in Customer', phone: '9848022334', address: 'Hyderabad' },
        profiles: { full_name: 'Active Staff' },
        items: [
          {
            quantity: 15,
            unit_price: 2.06,
            tax_amount: 3.31,
            batches: {
              batch_number: 'PAR-2601',
              expiry_date: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0],
              products: {
                name: 'Paracetamol 650mg (Dolo)',
                generic_name: 'Paracetamol',
                hsn_code: '30049011',
                tax_rate: 12,
                unit: 'strip',
                pack_size: '15'
              }
            }
          }
        ]
      };
    }

    const supabase = await createClient();
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*, customers(*), profiles(full_name)')
      .eq('id', saleId)
      .single();

    if (saleError) throw saleError;

    const { data: items, error: itemsError } = await supabase
      .from('sale_items')
      .select('*, batches(batch_number, expiry_date, products(name, generic_name, hsn_code, tax_rate, pack_size, unit))')
      .eq('sale_id', saleId);

    if (itemsError) throw itemsError;

    return {
      ...sale,
      items: items || [],
    };
  } catch (error: any) {
    console.error('Error fetching sale details:', error);
    return null;
  }
}

export async function createSale(input: CreateSaleInput) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { error: 'Unauthorized: Session not found' };
    }

    if (!input.items || input.items.length === 0) {
      return { error: 'Cart is empty' };
    }

    const supabase = await createClient();

    let targetBranchId: string | null = null;
    if (currentUser.role === 'manager' || currentUser.role === 'employee') {
      targetBranchId = currentUser.branch_id || null;
      if (!targetBranchId) {
        return { error: 'Your account is not assigned to any branch.' };
      }
    } else {
      targetBranchId = input.branchId || currentUser.branch_id || null;
      if (!targetBranchId) {
        return { error: 'Please select a valid branch for this transaction.' };
      }

      // Validate the branch exists and is active in the database
      const { data: branchCheck } = await supabase
        .from('branches')
        .select('is_active')
        .eq('id', targetBranchId)
        .single();

      if (!branchCheck) {
        return { error: 'The selected branch does not exist.' };
      }
      if (!branchCheck.is_active) {
        return { error: 'The selected branch is inactive and cannot accept new sales.' };
      }
    }

    // 1. Resolve customer if details are provided
    let customerId: string | null = null;
    if (input.customerPhone) {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', input.customerPhone)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else if (input.customerName) {
        // Create new customer
        const { data: newCustomer, error: custError } = await supabase
          .from('customers')
          .insert([
            {
              name: input.customerName,
              phone: input.customerPhone,
              address: input.customerAddress || null,
            },
          ])
          .select('id')
          .single();

        if (custError) {
          return { error: 'Failed to create customer' };
        }
        customerId = newCustomer.id;
      }
    }

    // Accumulate all batch allocations, subtotal, and tax
    let totalSubtotal = 0;
    let totalTaxAmount = 0;
    const finalAllocations: Array<{
      batchId: string;
      quantity: number;
      unitPrice: number;
      taxAmount: number;
    }> = [];

    // 2. Loop through each cart item and apply FEFO
    for (const item of input.items) {
      // Fetch product to verify prescription requirement, tax rate, and pack size
      const { data: product, error: prodError } = await supabase
        .from('products')
        .select('name, requires_prescription, tax_rate, pack_size')
        .eq('id', item.productId)
        .single();

      if (prodError || !product) {
        return { error: `Product not found: ${item.productId}` };
      }

      const packSize = parseInt(product.pack_size || '1') || 1;

      // Hard gate checkout rule: Prescription required
      if (product.requires_prescription) {
        if (!input.prescriptionRef && !input.prescriptionUrl) {
          return {
            error: `Prescription verification required for Schedule drug: ${product.name}`,
          };
        }
      }

      // Fetch unexpired batches for this product and scoped branch, ordered by expiry date asc
      const { data: batches, error: batchError } = await supabase
        .from('batches')
        .select('id, batch_number, quantity_available, purchase_price, mrp, selling_price, expiry_date')
        .eq('product_id', item.productId)
        .eq('branch_id', targetBranchId)
        .gte('expiry_date', new Date().toISOString().split('T')[0])
        .gt('quantity_available', 0)
        .order('expiry_date', { ascending: true });

      if (batchError || !batches) {
        return { error: `Failed to query stock for: ${product.name}` };
      }

      // Apply FEFO allocation
      const mappedBatches = batches.map((b) => ({
        ...b,
        tax_rate: Number(product.tax_rate),
      }));

      const { allocations, unallocatedQuantity } = allocateBatchesFEFO(
        mappedBatches,
        item.quantity
      );

      if (unallocatedQuantity > 0) {
        return {
          error: `Insufficient unexpired stock for: ${product.name}. Requested: ${item.quantity}, Short: ${unallocatedQuantity}`,
        };
      }

      // Record allocations and compute pricing using MRP-inclusive back-worked tax
      allocations.forEach((alloc) => {
        const itemTotal = (alloc.quantitySelected * alloc.sellingPrice) / packSize;
        const itemSubtotal = itemTotal / (1 + alloc.taxRate / 100);
        const itemTax = itemTotal - itemSubtotal;

        totalSubtotal += itemSubtotal;
        totalTaxAmount += itemTax;

        finalAllocations.push({
          batchId: alloc.batchId,
          quantity: alloc.quantitySelected,
          unitPrice: alloc.sellingPrice / packSize,
          taxAmount: itemTax,
        });
      });
    }

    // 3. Compute final sale totals with server-side discount cap
    const discountAmount = Math.max(0, Math.min(input.discount, totalSubtotal));
    const finalTotal = Math.max(0, totalSubtotal + totalTaxAmount - discountAmount);
    const invoiceNumber = `INV-${Date.now()}`;

    const isPlaceholder = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder-project') && process.env.NODE_ENV !== 'production';
    if (isPlaceholder) {
      return { success: true, saleId: `mock-sale-${Date.now()}`, invoiceNumber };
    }

    // 4. Invoke secure transaction via database RPC call (handles locking and rollback)
    const { data: saleId, error: rpcError } = await supabase.rpc('checkout_sale_transaction', {
      input_invoice_number: invoiceNumber,
      input_customer_id: customerId,
      input_subtotal: totalSubtotal,
      input_tax_amount: totalTaxAmount,
      input_discount: discountAmount,
      input_total: finalTotal,
      input_payment_mode: input.paymentMode,
      input_created_by: currentUser.id,
      input_branch_id: targetBranchId,
      input_prescription_ref: input.prescriptionRef || null,
      input_prescription_url: input.prescriptionUrl || null,
      input_items: finalAllocations.map(a => ({
        batch_id: a.batchId,
        quantity: a.quantity,
        unit_price: a.unitPrice,
        tax_amount: a.taxAmount
      }))
    });

    if (rpcError) {
      console.error('Checkout Transaction Failure:', rpcError);
      return { error: rpcError.message || 'Checkout failed due to concurrency or database constraints.' };
    }

    revalidatePath('/admin/dashboard');
    revalidatePath('/admin/batches');
    revalidatePath('/employee/dashboard');
    revalidatePath('/employee/stock');

    return { success: true, saleId, invoiceNumber };
  } catch (error: any) {
    return { error: 'An unexpected checkout failure occurred' };
  }
}
