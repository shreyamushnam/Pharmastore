import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const isPlaceholder = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder-project') && process.env.NODE_ENV !== 'production';
  if (isPlaceholder) {
    return supabaseResponse;
  }

  // Refresh the session token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();

  const isAuthPage = url.pathname.startsWith('/login');
  const isApiRoute = url.pathname.startsWith('/api');
  const isStaticAsset =
    url.pathname.includes('.') ||
    url.pathname.startsWith('/_next') ||
    url.pathname === '/favicon.ico';

  // If user is not authenticated and is accessing a protected page, redirect to login
  if (!user && !isAuthPage && !isApiRoute && !isStaticAsset && url.pathname !== '/') {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If user is authenticated, check their role and protect routes
  if (user) {
    // Role-based route gating (defense in depth)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    // Sign out and redirect ONLY if the profile genuinely does not exist or user is inactive.
    // Do not perform sign-out on transient network/fetch errors.
    const profileNotFound = profileError && profileError.code === 'PGRST116';
    const isInactive = profile && !profile.is_active;

    if (profileNotFound || isInactive) {
      if (!isAuthPage) {
        url.pathname = '/login';
        const redirectResponse = NextResponse.redirect(url);
        // Sign out to clear session locally
        await supabase.auth.signOut({ scope: 'local' });
        // Propagate cookies set by signOut
        supabaseResponse.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
        });
        return redirectResponse;
      }
      return supabaseResponse;
    }

    // If they go to login page, redirect to home
    if (isAuthPage) {
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    if (!profile) {
      return supabaseResponse;
    }

    if (url.pathname.startsWith('/admin') && profile.role !== 'admin' && profile.role !== 'super_admin') {
      url.pathname = '/employee/dashboard';
      return NextResponse.redirect(url);
    }
    if (url.pathname.startsWith('/employee') &&
        profile.role !== 'employee' &&
        profile.role !== 'manager' &&
        profile.role !== 'admin' &&
        profile.role !== 'super_admin') {
      url.pathname = '/admin/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
