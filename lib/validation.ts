import { z } from 'zod';

// Product Schema
export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  generic_name: z.string().optional().nullable().or(z.literal('')),
  manufacturer: z.string().optional().nullable().or(z.literal('')),
  category: z.string().optional().nullable().or(z.literal('')),
  composition: z.string().optional().nullable().or(z.literal('')),
  strength: z.string().optional().nullable().or(z.literal('')),
  pack_size: z.string().optional().nullable().or(z.literal('')),
  unit: z.string().optional().nullable().or(z.literal('')),
  hsn_code: z.string().optional().nullable().or(z.literal('')),
  barcode: z.string().optional().nullable().or(z.literal('')),
  requires_prescription: z.boolean().default(false),
  reorder_level: z.coerce.number().int().nonnegative('Reorder level must be >= 0').default(10),
  tax_rate: z.coerce.number().refine((val) => [0, 5, 12, 18].includes(val), { message: 'GST tax rate must be a standard slab (0%, 5%, 12%, or 18%)' }).default(12),
});

// Batch Schema
export const batchSchema = z.object({
  product_id: z.string().uuid('Please select a valid product'),
  supplier_id: z.string().uuid('Please select a valid supplier').optional().nullable(),
  batch_number: z.string().min(1, 'Batch number is required'),
  mfg_date: z.string().optional().nullable().or(z.literal('')),
  expiry_date: z.string().min(1, 'Expiry date is required'),
  quantity_received: z.coerce.number().int().nonnegative('Received quantity must be >= 0'),
  quantity_available: z.coerce.number().int().nonnegative('Available quantity must be >= 0').optional(),
  purchase_price: z.coerce.number().nonnegative('Purchase price must be >= 0'),
  mrp: z.coerce.number().nonnegative('MRP must be >= 0'),
  selling_price: z.coerce.number().nonnegative('Selling price must be >= 0'),
  branch_id: z.string().uuid('Please select a valid branch').optional().nullable().or(z.literal('')),
});

// Supplier Schema
export const supplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  contact_person: z.string().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable().or(z.literal('')),
  email: z.string().email('Please enter a valid email').optional().nullable().or(z.literal('')),
  gstin: z.string().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable().or(z.literal('')),
});

// Employee / Profile Schema
export const employeeSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  role: z.enum(['super_admin', 'admin', 'manager', 'employee']),
  phone: z.string().optional().nullable().or(z.literal('')),
  is_active: z.boolean(),
  branch_id: z.string().uuid('Please select a valid branch').optional().nullable().or(z.literal('')),
});

// Purchase Order Schema
export const purchaseOrderSchema = z.object({
  supplier_id: z.string().uuid('Please select a valid supplier'),
  expected_date: z.string().optional().nullable().or(z.literal('')),
  items: z.array(
    z.object({
      product_id: z.string().uuid('Please select a product'),
      quantity: z.coerce.number().int().positive('Quantity must be greater than 0'),
      unit_price: z.coerce.number().nonnegative('Unit price must be >= 0'),
    })
  ).min(1, 'At least one item is required'),
});

// Stock Adjustment Schema
export const stockAdjustmentSchema = z.object({
  batch_id: z.string().uuid('Please select a valid batch'),
  movement_type: z.enum(['adjustment', 'writeoff']),
  quantity: z.coerce.number().int('Quantity must be an integer').refine((val) => val !== 0, 'Quantity cannot be zero'),
  reason: z.string().min(1, 'Please specify a reason'),
});

// Branch Schema
export const branchSchema = z.object({
  name: z.string().min(1, 'Branch name is required').max(100, 'Branch name must be 100 characters or less'),
  code: z.string().min(1, 'Branch code is required').max(10, 'Branch code must be 10 characters or less').regex(/^[A-Z0-9-]+$/, 'Branch code must contain only alphanumeric characters or hyphens').toUpperCase(),
  location: z.string().max(255, 'Location must be 255 characters or less').optional().nullable().or(z.literal('')),
  phone: z.string().max(20, 'Phone must be 20 characters or less').optional().nullable().or(z.literal('')),
  is_active: z.boolean().default(true),
  drug_licence_no: z.string().max(50, 'Drug licence number must be 50 characters or less').optional().nullable().or(z.literal('')),
  gstin: z.string().max(15, 'GSTIN must be 15 characters or less').optional().nullable().or(z.literal('')),
});

