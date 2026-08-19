'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/lib/actions/auth';
import { hasAdminRole } from '@/lib/roles';
import {
  Activity,
  LayoutDashboard,
  Pill,
  Layers,
  Users,
  Truck,
  FileSpreadsheet,
  Settings,
  ShoppingBag,
  Package,
  Bell,
  LogOut,
  Menu,
  X,
  User,
  TrendingUp,
  FileText,
  Building2,
} from 'lucide-react';

interface HeaderProps {
  profile: {
    full_name: string;
    role: string;
    email?: string;
  };
}

export default function Header({ profile }: HeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = hasAdminRole(profile);

  const adminLinks = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/products', label: 'Products', icon: Pill },
    { href: '/admin/batches', label: 'Batches', icon: Layers },
    { href: '/admin/sales', label: 'Bills', icon: FileText },
    { href: '/admin/employees', label: 'Employees', icon: Users },
    { href: '/admin/suppliers', label: 'Suppliers', icon: Truck },
    { href: '/admin/branches', label: 'Branches', icon: Building2 },
    { href: '/admin/reports', label: 'Reports', icon: FileSpreadsheet },
    { href: '/admin/analytics', label: 'Analytics', icon: TrendingUp },
    { href: '/admin/audit-logs', label: 'Audit Trail', icon: Activity },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  const employeeLinks = [
    { href: '/employee/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/employee/billing', label: 'POS Billing', icon: ShoppingBag },
    { href: '/employee/stock', label: 'Stock Master', icon: Package },
    { href: '/employee/alerts', label: 'Alerts', icon: Bell },
  ];

  // If user is admin, they can switch to employee POS Billing or Stock if they need to,
  // or we can show them the POS Billing and Stock master inside their navbar as well!
  // Let's make sure Admins can access Billing & Stock by displaying them or adding links.
  const links = isAdmin ? adminLinks : employeeLinks;

  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/20">
                <Activity className="h-6 w-6 animate-pulse" />
              </div>
              <span className="hidden text-lg font-bold tracking-tight text-slate-900 sm:block">
                PharmaStore
              </span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex md:space-x-1 lg:space-x-2">
            {links.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}

            {/* Quick POS Access for Admin */}
            {isAdmin && (
              <Link
                href="/employee/billing"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-amber-600 hover:bg-amber-50 transition-colors"
              >
                <ShoppingBag className="h-4 w-4" />
                POS Billing
              </Link>
            )}
          </nav>

          {/* Right Section: User & Logout */}
          <div className="hidden md:flex md:items-center md:gap-4">
            {/* User Profile Badge */}
            <div className="flex items-center gap-3 border-r border-slate-200 pr-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                <User className="h-4 w-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-semibold text-slate-800">
                  {profile.full_name}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isAdmin ? 'text-teal-600' : 'text-blue-600'
                  }`}
                >
                  {profile.role}
                </span>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-650 transition-colors hover:bg-red-50 hover:text-red-700 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none"
            >
              {mobileMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-b border-slate-200 bg-white md:hidden shadow-md">
          <div className="space-y-1 px-2 pt-2 pb-3">
            {links.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-base font-semibold transition-colors ${
                    active
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {link.label}
                </Link>
              );
            })}

            {isAdmin && (
              <Link
                href="/employee/billing"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-base font-semibold text-amber-600 hover:bg-amber-50 transition-colors"
              >
                <ShoppingBag className="h-5 w-5" />
                POS Billing
              </Link>
            )}
          </div>

          {/* Mobile User Profile & Logout */}
          <div className="border-t border-slate-200 p-4 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                <User className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-semibold text-slate-800">
                  {profile.full_name}
                </div>
                <div
                  className={`text-xs font-bold uppercase tracking-wider ${
                    isAdmin ? 'text-teal-600' : 'text-blue-600'
                  }`}
                >
                  {profile.role}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={() => logout()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-650 transition-colors hover:bg-red-100 hover:text-red-700 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
