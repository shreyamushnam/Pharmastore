This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Security Architecture & Multi-Branch Gating

### Role Hierarchy
1. **Super Admin (Developer)**: Complete global read/write access. Can manage branches, global audit logs, and promote/demote other administrative accounts.
2. **Admin (Store Owner)**: Global read/write access to business functions (inventory, sales, employees, suppliers) across all branches. Restrained from modifying `super_admin` accounts or modifying branch properties.
3. **Manager (Branch Manager)**: Scoped strictly to their assigned branch. Cannot manage or view data from other branches. Restricted from creating/managing other managers or admins.
4. **Employee**: Scoped strictly to their assigned branch for standard POS billing and stock lookups.

### Row-Level Security (RLS) Model
All transactional and physical entities (`batches`, `sales`, `stock_movements`, `purchase_orders`) are bound by the RLS helper function `public.has_branch_access(branch_id)`. 
- Global admins bypass branch checks.
- Branch staff (managers and employees) are restricted to matching `branch_id` values.
- Self-escalation trigger `check_profile_update` blocks any unauthorized client-side updates to role, active status, or branch assignments.

### Secure First Super Admin Bootstrap Procedure
Public signups are sandboxed as `employee` with `branch_id = null` and cannot promote themselves. To bootstrap the first `super_admin` account:

1. Register an account with your developer email using the standard signup flow.
2. Log into your Supabase Dashboard, open the **SQL Editor**, and run the following script:

```sql
-- Disable the profile security trigger temporarily
ALTER TABLE public.profiles DISABLE TRIGGER trigger_check_profile_update;

-- Promote the developer account to super_admin
UPDATE public.profiles
SET role = 'super_admin', is_active = true, branch_id = null
WHERE email = 'developer@yourdomain.com';

-- Re-enable the profile security trigger
ALTER TABLE public.profiles ENABLE TRIGGER trigger_check_profile_update;
```

This procedure is secure as disabling triggers requires database superuser/owner privileges which are not available to the standard application client.

### Database Migrations
Database updates are managed transactionally. The hardening migration file is located at `supabase/migrations/20260818000000_multi_branch_role_security_hardening.sql`. Run it via the Supabase CLI:

```bash
supabase db push
```

