'use client';

import { useActionState } from 'react';
import { login } from '@/lib/actions/auth';
import { Activity, Mail, Lock, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, null);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 font-sans text-slate-800">
      {/* Background glowing effects */}
      <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-teal-500/5 blur-[120px]" />
      <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-emerald-500/5 blur-[120px]" />

      <div className="relative w-full max-w-md px-6 py-12">
        <div className="relative flex flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          {/* Header */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/20 shadow-sm">
              <Activity className="h-8 w-8 animate-pulse" />
            </div>
            <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
              PharmaStore PIMS
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Inventory & POS Management System
            </p>
          </div>

          {/* Form */}
          <form action={formAction} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Email Address
              </label>
              <div className="relative mt-2">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="name@pharmastore.com"
                  className="block w-full rounded-xl border border-slate-350 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none ring-offset-white transition duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Password
              </label>
              <div className="relative mt-2">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  className="block w-full rounded-xl border border-slate-350 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none ring-offset-white transition duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>

            {/* Error Message */}
            {state?.error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {state.error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isPending}
              className="flex w-full items-center justify-center rounded-xl bg-teal-600 hover:bg-teal-700 py-3 px-4 text-sm font-semibold text-white shadow-md transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In to Dashboard'
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="mt-8 text-center text-xs text-slate-400">
            For employee login issues, contact system administrator.
          </div>
        </div>
      </div>
    </div>
  );
}

