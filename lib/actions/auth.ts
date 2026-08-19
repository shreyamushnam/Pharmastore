'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function login(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Failed to retrieve user session' };
  }

  // Get user profile role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return { error: 'User profile not found in database' };
  }

  if (!profile.is_active) {
    // Sign out active session if they're deactivated
    await supabase.auth.signOut();
    return { error: 'This user account has been deactivated' };
  }

  // Redirect based on role
  if (profile.role === 'super_admin' || profile.role === 'admin') {
    redirect('/admin/dashboard');
  } else {
    redirect('/employee/dashboard');
  }
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function getCurrentUser() {
  try {
    const isPlaceholder = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder-project') && process.env.NODE_ENV !== 'production';
    if (isPlaceholder) {
      return {
        id: 'mock-admin-id',
        full_name: 'Administrator',
        email: 'admin@pharmastore.com',
        role: 'admin',
        is_active: true,
        branch_id: null,
        created_at: new Date().toISOString()
      };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile && !profile.is_active) {
      return null;
    }

    return profile;
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
}
