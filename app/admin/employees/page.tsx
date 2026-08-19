import { getEmployees } from '@/lib/actions/employees';
import { getBranches } from '@/lib/actions/branches';
import { getCurrentUser } from '@/lib/actions/auth';
import EmployeeClient from '@/components/dashboard/EmployeeClient';

export const dynamic = 'force-dynamic';

export default async function EmployeesPage() {
  const [employees, branches, currentUser] = await Promise.all([
    getEmployees(),
    getBranches(),
    getCurrentUser(),
  ]);
  return <EmployeeClient initialEmployees={employees} initialBranches={branches} currentUser={currentUser} />;
}
