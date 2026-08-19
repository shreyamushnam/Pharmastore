import { getCurrentUser } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';
import { hasAdminRole } from '@/lib/roles';

export default async function Home() {
  const profile = await getCurrentUser();

  if (!profile) {
    redirect('/login');
  }

  if (hasAdminRole(profile)) {
    redirect('/admin/dashboard');
  } else {
    redirect('/employee/dashboard');
  }
}
