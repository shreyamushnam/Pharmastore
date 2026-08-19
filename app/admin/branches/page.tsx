import { getBranches } from '@/lib/actions/branches';
import BranchClient from '@/components/dashboard/BranchClient';

export const dynamic = 'force-dynamic';

export default async function BranchesPage() {
  const branches = await getBranches();
  return <BranchClient initialBranches={branches} />;
}
