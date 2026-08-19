-- Migration: Add transactional checkout function with FOR UPDATE locking to prevent TOCTOU double-spend
BEGIN;

CREATE OR REPLACE FUNCTION public.checkout_sale_transaction(
  input_invoice_number text,
  input_customer_id uuid,
  input_subtotal numeric,
  input_tax_amount numeric,
  input_discount numeric,
  input_total numeric,
  input_payment_mode text,
  input_created_by uuid,
  input_branch_id uuid,
  input_prescription_ref text,
  input_prescription_url text,
  input_items jsonb -- Array of objects: {batch_id: uuid, quantity: integer, unit_price: numeric, tax_amount: numeric}
)
RETURNS uuid AS $$
DECLARE
  new_sale_id uuid;
  item_record jsonb;
  batch_available_qty integer;
BEGIN
  -- Insert Sale
  INSERT INTO public.sales (
    invoice_number,
    customer_id,
    subtotal,
    tax_amount,
    discount,
    total,
    payment_mode,
    created_by,
    branch_id,
    created_at
  ) VALUES (
    input_invoice_number,
    input_customer_id,
    input_subtotal,
    input_tax_amount,
    input_discount,
    input_total,
    input_payment_mode,
    input_created_by,
    input_branch_id,
    NOW()
  ) RETURNING id INTO new_sale_id;

  -- Loop through items and insert them + check stock levels using FOR UPDATE on batches
  FOR item_record IN SELECT * FROM jsonb_array_elements(input_items) LOOP
    -- Lock batch row to prevent concurrent race condition (TOCTOU)
    SELECT quantity_available INTO batch_available_qty
    FROM public.batches
    WHERE id = (item_record->>'batch_id')::uuid
    FOR UPDATE;

    IF batch_available_qty IS NULL THEN
      RAISE EXCEPTION 'Batch with ID % not found', (item_record->>'batch_id')::uuid;
    END IF;

    IF batch_available_qty < (item_record->>'quantity')::integer THEN
      RAISE EXCEPTION 'Insufficient stock in batch %: requested %, available %', 
        (item_record->>'batch_id')::uuid, (item_record->>'quantity')::integer, batch_available_qty;
    END IF;

    -- Insert sale item
    INSERT INTO public.sale_items (
      sale_id,
      batch_id,
      quantity,
      unit_price,
      tax_amount
    ) VALUES (
      new_sale_id,
      (item_record->>'batch_id')::uuid,
      (item_record->>'quantity')::integer,
      (item_record->>'unit_price')::numeric,
      (item_record->>'tax_amount')::numeric
    );

    -- Insert stock movement (deducts quantity_available from batch via DB trigger)
    INSERT INTO public.stock_movements (
      batch_id,
      movement_type,
      quantity,
      status,
      reason,
      reference_type,
      reference_id,
      created_by,
      branch_id
    ) VALUES (
      (item_record->>'batch_id')::uuid,
      'sale',
      -(item_record->>'quantity')::integer,
      'approved',
      'POS Checkout Invoice: ' || input_invoice_number,
      'sale',
      new_sale_id,
      input_created_by,
      input_branch_id
    );
  END LOOP;

  RETURN new_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
