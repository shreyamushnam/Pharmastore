import { getCurrentUser } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';
import Header from '@/components/dashboard/Header';
import { hasAdminRole } from '@/lib/roles';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUser();

  if (!profile) {
    redirect('/login');
  }

  if (!hasAdminRole(profile)) {
    redirect('/employee/dashboard');
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header profile={profile} />
      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
