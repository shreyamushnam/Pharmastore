-- Migration: Multi-branch role security hardening and partitioning
BEGIN;

-- 1. Create branches table if it does not exist
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  location text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.branches enable row level security;

-- 2. Safe addition of branch_id columns to partitioning tables
alter table public.profiles add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.batches add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.sales add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.stock_movements add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.purchase_orders add column if not exists branch_id uuid references public.branches(id) on delete set null;

-- Update role check constraint on profiles
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('super_admin', 'admin', 'manager', 'employee'));

-- 3. Idempotently create Headquarters branch if not exists
INSERT INTO public.branches (name, code, location, is_active)
VALUES ('Headquarters', 'HQ', 'Primary Office', true)
ON CONFLICT (code) DO NOTHING;

-- 4. Safe data backfilling for historical records
DO $$
DECLARE
  default_branch_id uuid;
  backfilled_profiles_count integer := 0;
  backfilled_batches_count integer := 0;
  backfilled_sales_count integer := 0;
  backfilled_stock_movements_count integer := 0;
  backfilled_purchase_orders_count integer := 0;
BEGIN
  SELECT id INTO default_branch_id FROM public.branches
  ORDER BY (code = 'HQ') DESC, created_at ASC
  LIMIT 1;

  WITH updated AS (
    UPDATE public.profiles
    SET branch_id = default_branch_id
    WHERE branch_id IS NULL
    RETURNING 1
  ) SELECT count(*) INTO backfilled_profiles_count FROM updated;

  WITH updated AS (
    UPDATE public.batches
    SET branch_id = default_branch_id
    WHERE branch_id IS NULL
    RETURNING 1
  ) SELECT count(*) INTO backfilled_batches_count FROM updated;

  WITH updated AS (
    UPDATE public.sales
    SET branch_id = default_branch_id
    WHERE branch_id IS NULL
    RETURNING 1
  ) SELECT count(*) INTO backfilled_sales_count FROM updated;

  WITH updated AS (
    UPDATE public.stock_movements
    SET branch_id = default_branch_id
    WHERE branch_id IS NULL
    RETURNING 1
  ) SELECT count(*) INTO backfilled_stock_movements_count FROM updated;

  WITH updated AS (
    UPDATE public.purchase_orders
    SET branch_id = default_branch_id
    WHERE branch_id IS NULL
    RETURNING 1
  ) SELECT count(*) INTO backfilled_purchase_orders_count FROM updated;

  RAISE NOTICE 'Backfill complete. Profiles: %, Batches: %, Sales: %, Stock Movements: %, Purchase Orders: %.',
    backfilled_profiles_count, backfilled_batches_count, backfilled_sales_count, backfilled_stock_movements_count, backfilled_purchase_orders_count;
END $$;

-- 5. Helper Functions
create or replace function public.is_super_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin' and is_active = true
  );
$$ language sql security definer stable set search_path = public;

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('super_admin', 'admin') and is_active = true
  );
$$ language sql security definer stable set search_path = public;

create or replace function public.is_active_staff()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active = true
  );
$$ language sql security definer stable set search_path = public;

create or replace function public.current_user_branch_id()
returns uuid language sql security definer stable set search_path = public as $$
  select branch_id from public.profiles where id = auth.uid();
$$;

create or replace function public.has_branch_access(record_branch_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active = true
      and (
        role in ('super_admin', 'admin')
        or branch_id = record_branch_id
      )
  );
$$ language sql security definer stable set search_path = public;

-- 6. Trigger updates
create or replace function public.check_profile_update()
returns trigger as $$
declare
  admin_exists boolean;
begin
  select exists (
    select 1 from public.profiles where role = 'admin' and is_active = true
  ) into admin_exists;

  if not admin_exists then
    if new.role is distinct from 'admin' or new.is_active is distinct from true then
      raise exception 'Bootstrap phase: The first profile must be set to role = admin and is_active = true.';
    end if;
    raise warning 'SYSTEM BOOTSTRAP: First admin profile bootstrap initiated for user ID %', new.id;
    insert into public.audit_logs (user_id, action, entity, entity_id, new_value)
    values (new.id, 'BOOTSTRAP', 'profiles', new.id, jsonb_build_object('role', new.role, 'is_active', new.is_active, 'bootstrap', true));
  else
    -- Check if target profile is a super_admin or is being set to super_admin
    if old.role = 'super_admin' or new.role = 'super_admin' then
      if not public.is_super_admin() then
        raise exception 'Only super administrators can manage super administrator roles and profiles.';
      end if;
    end if;

    -- Prevent non-admins from altering role, is_active, or branch_id fields
    if not public.is_admin() then
      if new.role is distinct from old.role then
        raise exception 'Only administrators can change profile roles.';
      end if;
      if new.is_active is distinct from old.is_active then
        raise exception 'Only administrators can change profile active status.';
      end if;
      if new.branch_id is distinct from old.branch_id then
        raise exception 'Only administrators can change branch assignments.';
      end if;
    end if;

    -- Users cannot change their own role
    if new.id = auth.uid() and new.role is distinct from old.role then
      raise exception 'Users are not permitted to change their own roles.';
    end if;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role, phone, is_active, branch_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Employee'),
    new.email,
    'employee', -- Enforce safe default role, do not trust client metadata
    new.phone,
    true,
    null        -- Safe default null branch, must be assigned explicitly by authorized flow
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace function public.auto_create_purchase_movement()
returns trigger as $$
begin
  if new.quantity_received > 0 then
    insert into public.stock_movements (batch_id, movement_type, quantity, reason, reference_type, reference_id, created_by, branch_id)
    values (
      new.id, 
      'purchase', 
      new.quantity_received, 
      'Initial stock-in on batch creation', 
      'batch',
      new.id,
      auth.uid(),
      new.branch_id
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- 7. Policy definitions (Recreate all to align on partitioning)
-- Drop existing policies to prevent duplicates
drop policy if exists "Staff can view active profiles in their branch or all if admin" on public.profiles;
drop policy if exists "Admins can modify profiles" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Staff can view active branches" on public.branches;
drop policy if exists "Admins can modify branches" on public.branches;
drop policy if exists "Staff can view suppliers" on public.suppliers;
drop policy if exists "Admins can modify suppliers" on public.suppliers;
drop policy if exists "Staff can view products" on public.products;
drop policy if exists "Staff can insert products" on public.products;
drop policy if exists "Staff can update products" on public.products;
drop policy if exists "Only admins can delete products" on public.products;
drop policy if exists "Staff can view batches" on public.batches;
drop policy if exists "Staff can insert batches" on public.batches;
drop policy if exists "Staff can update batches" on public.batches;
drop policy if exists "Only admins can delete batches" on public.batches;
drop policy if exists "Staff can view purchase orders" on public.purchase_orders;
drop policy if exists "Staff can create purchase orders" on public.purchase_orders;
drop policy if exists "Staff can update purchase orders" on public.purchase_orders;
drop policy if exists "Only admins can delete purchase orders" on public.purchase_orders;
drop policy if exists "Staff can view purchase order items" on public.purchase_order_items;
drop policy if exists "Staff can manage purchase order items" on public.purchase_order_items;
drop policy if exists "Staff can view stock movements" on public.stock_movements;
drop policy if exists "Staff can insert stock movements" on public.stock_movements;
drop policy if exists "Staff can view/manage customers" on public.customers;
drop policy if exists "Staff can view sales" on public.sales;
drop policy if exists "Staff can insert sales" on public.sales;
drop policy if exists "Staff can view sale items" on public.sale_items;
drop policy if exists "Staff can insert sale items" on public.sale_items;
drop policy if exists "Staff can view notifications" on public.notifications;
drop policy if exists "Staff can update notifications (mark read)" on public.notifications;
drop policy if exists "Admins can manage notifications" on public.notifications;
drop policy if exists "Admins can view audit logs" on public.audit_logs;

-- Recreate policies
create policy "Staff can view active profiles in their branch or all if admin"
  on public.profiles for select
  using (
    public.is_admin() or 
    (public.is_active_staff() and branch_id = public.current_user_branch_id())
  );

create policy "Admins can modify profiles"
  on public.profiles for all
  using (public.is_admin());

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Staff can view active branches"
  on public.branches for select
  using (
    (public.is_active_staff() and is_active = true)
    or public.is_admin()
  );

create policy "Admins can modify branches"
  on public.branches for all
  using (public.is_admin());

create policy "Staff can view suppliers"
  on public.suppliers for select
  using (public.is_active_staff());

create policy "Admins can modify suppliers"
  on public.suppliers for all
  using (public.is_admin());

create policy "Staff can view products"
  on public.products for select
  using (public.is_active_staff());

create policy "Staff can insert products"
  on public.products for insert
  with check (public.is_active_staff());

create policy "Staff can update products"
  on public.products for update
  using (public.is_active_staff());

create policy "Only admins can delete products"
  on public.products for delete
  using (public.is_admin());

create policy "Staff can view batches"
  on public.batches for select
  using (public.is_active_staff() and public.has_branch_access(branch_id));

create policy "Staff can insert batches"
  on public.batches for insert
  with check (public.is_active_staff() and public.has_branch_access(branch_id));

create policy "Staff can update batches"
  on public.batches for update
  using (public.is_active_staff() and public.has_branch_access(branch_id))
  with check (public.is_active_staff() and public.has_branch_access(branch_id));

create policy "Only admins can delete batches"
  on public.batches for delete
  using (public.is_admin() and public.has_branch_access(branch_id));

create policy "Staff can view purchase orders"
  on public.purchase_orders for select
  using (public.is_active_staff() and public.has_branch_access(branch_id));

create policy "Staff can create purchase orders"
  on public.purchase_orders for insert
  with check (public.is_active_staff() and public.has_branch_access(branch_id));

create policy "Staff can update purchase orders"
  on public.purchase_orders for update
  using (public.is_active_staff() and public.has_branch_access(branch_id));

create policy "Only admins can delete purchase orders"
  on public.purchase_orders for delete
  using (public.is_admin() and public.has_branch_access(branch_id));

create policy "Staff can view purchase order items"
  on public.purchase_order_items for select
  using (public.is_active_staff() and exists (
    select 1 from public.purchase_orders where id = po_id and public.has_branch_access(branch_id)
  ));

create policy "Staff can manage purchase order items"
  on public.purchase_order_items for all
  using (public.is_active_staff() and exists (
    select 1 from public.purchase_orders where id = po_id and public.has_branch_access(branch_id)
  ));

create policy "Staff can view stock movements"
  on public.stock_movements for select
  using (public.is_active_staff() and public.has_branch_access(branch_id));

create policy "Staff can insert stock movements"
  on public.stock_movements for insert
  with check (public.is_active_staff() and public.has_branch_access(branch_id));

create policy "Staff can view/manage customers"
  on public.customers for all
  using (public.is_active_staff());

create policy "Staff can view sales"
  on public.sales for select
  using (public.is_active_staff() and public.has_branch_access(branch_id));

create policy "Staff can insert sales"
  on public.sales for insert
  with check (public.is_active_staff() and public.has_branch_access(branch_id));

create policy "Staff can view sale items"
  on public.sale_items for select
  using (public.is_active_staff() and exists (
    select 1 from public.sales where id = sale_id and public.has_branch_access(branch_id)
  ));

create policy "Staff can insert sale items"
  on public.sale_items for insert
  with check (public.is_active_staff() and exists (
    select 1 from public.sales where id = sale_id and public.has_branch_access(branch_id)
  ));

create policy "Staff can view notifications"
  on public.notifications for select
  using (public.is_active_staff());

create policy "Staff can update notifications (mark read)"
  on public.notifications for update
  using (public.is_active_staff());

create policy "Admins can manage notifications"
  on public.notifications for all
  using (public.is_admin());

create policy "Admins can view audit logs"
  on public.audit_logs for select
  using (public.is_admin());

-- 8. Attach Audit trigger to branches if not exists
drop trigger if exists audit_branches on public.branches;
create trigger audit_branches
  after insert or update or delete on public.branches
  for each row execute function public.audit_trigger_func();

COMMIT;
