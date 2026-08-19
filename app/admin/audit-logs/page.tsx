import { getAuditLogs } from '@/lib/actions/audit';
import AuditLogsClient from '@/components/dashboard/AuditLogsClient';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import { hasAdminRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export default async function AdminAuditLogsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasAdminRole(currentUser)) {
    redirect('/login');
  }

  const logs = await getAuditLogs();
  return <AuditLogsClient initialLogs={logs} />;
}
