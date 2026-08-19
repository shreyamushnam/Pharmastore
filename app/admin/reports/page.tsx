import { getCurrentUser } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';
import { hasAdminRole } from '@/lib/roles';
import { getBranches } from '@/lib/actions/branches';
import { getBatches } from '@/lib/actions/batches';
import { getSales } from '@/lib/actions/sales';
import ReportsClient from '@/components/dashboard/ReportsClient';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const profile = await getCurrentUser();

  if (!profile) {
    redirect('/login');
  }

  if (!hasAdminRole(profile)) {
    redirect('/employee/dashboard');
  }

  // Fetch branches, sales, and batches parallelly
  const [branches, batches, sales] = await Promise.all([
    getBranches(),
    getBatches(),
    getSales(),
  ]);

  return (
    <ReportsClient 
      initialBranches={branches} 
      initialBatches={batches as any} 
      initialSales={sales as any} 
    />
  );
}
