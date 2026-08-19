import { getAnalyticsSummary } from '@/lib/actions/analytics';
import AnalyticsClient from '@/components/dashboard/AnalyticsClient';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import { hasAdminRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export default async function AdminAnalyticsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasAdminRole(currentUser)) {
    redirect('/login');
  }

  const data = await getAnalyticsSummary();
  if (!data) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400">
        Error compiling analytical records. Please verify database connection.
      </div>
    );
  }

  return <AnalyticsClient data={data} />;
}
