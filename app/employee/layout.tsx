import { getCurrentUser } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';
import Header from '@/components/dashboard/Header';

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUser();

  if (!profile) {
    redirect('/login');
  }

  // Both admins, super_admins, managers, and employees can access employee routes
  if (
    profile.role !== 'employee' &&
    profile.role !== 'manager' &&
    profile.role !== 'admin' &&
    profile.role !== 'super_admin'
  ) {
    redirect('/login');
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
