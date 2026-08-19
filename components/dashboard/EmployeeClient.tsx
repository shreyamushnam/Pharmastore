'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { employeeSchema } from '@/lib/validation';
import { hasAdminRole, isSuperAdmin, isManager } from '@/lib/roles';
import { createEmployee, updateEmployee, toggleEmployeeStatus } from '@/lib/actions/employees';
import Modal from '@/components/ui/Modal';
import {
  Plus,
  Search,
  Edit2,
  UserCheck,
  UserX,
  AlertTriangle,
  Loader2,
  CheckCircle,
} from 'lucide-react';

import { z } from 'zod';

interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  branch_id?: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface EmployeeClientProps {
  initialEmployees: Profile[];
  initialBranches: Branch[];
  currentUser: { role: string; branch_id: string | null } | null;
}

type EmployeeFormData = z.infer<typeof employeeSchema>;

// Roles an actor is allowed to assign, keyed by the actor's own role.
const assignableRolesByActor: Record<string, string[]> = {
  super_admin: ['super_admin', 'admin', 'manager', 'employee'],
  admin: ['manager', 'employee'],
  manager: ['employee'],
};

export default function EmployeeClient({
  initialEmployees,
  initialBranches,
  currentUser,
}: EmployeeClientProps) {
  const actorRole = currentUser?.role ?? 'employee';
  const assignableRoles = assignableRolesByActor[actorRole] ?? ['employee'];
  const isActorSuperAdmin = actorRole === 'super_admin';
  const isActorManager = actorRole === 'manager';
  const activeBranches = initialBranches.filter((b) => b.is_active);
  const [employees, setEmployees] = useState<Profile[]>(initialEmployees);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      role: 'employee',
      phone: '',
      branch_id: '',
      is_active: true,
    },
  });

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setError(null);
    setSuccessMsg(null);
    reset({
      full_name: '',
      email: '',
      password: '',
      role: 'employee',
      phone: '',
      branch_id: '',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: Profile) => {
    setEditingEmployee(emp);
    setError(null);
    setSuccessMsg(null);
    reset({
      full_name: emp.full_name,
      email: emp.email || '',
      password: '', // leave empty to not change password
      role: emp.role as (typeof employeeSchema._output)['role'],
      phone: emp.phone || '',
      branch_id: emp.branch_id || '',
      is_active: emp.is_active,
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: EmployeeFormData) => {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      let res;
      if (editingEmployee) {
        res = await updateEmployee(editingEmployee.id, null, data);
      } else {
        res = await createEmployee(null, data);
      }

      if (res?.error) {
        setError(res.error);
      } else {
        setSuccessMsg(
          editingEmployee
            ? 'Employee details updated successfully'
            : 'Employee registered successfully'
        );
        setTimeout(() => {
          setIsModalOpen(false);
          window.location.reload();
        }, 1200);
      }
    });
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const actionText = currentStatus ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${actionText} this user account?`)) return;

    const res = await toggleEmployeeStatus(id, !currentStatus);
    if (res?.error) {
      alert(res.error);
    } else {
      window.location.reload();
    }
  };

  const filteredEmployees = employees.filter((e) => {
    const query = searchQuery.toLowerCase();
    const name = e.full_name.toLowerCase();
    const email = e.email?.toLowerCase() || '';
    const phone = e.phone || '';
    return name.includes(query) || email.includes(query) || phone.includes(query);
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Employee Management</h1>
          <p className="text-sm text-slate-500">Add, edit, or deactivate store operators and administrators</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-sm transition py-2.5 px-4 text-sm"
        >
          <Plus className="h-4 w-4" />
          Add Employee
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
          <Search className="h-4 w-4" />
        </div>
        <input
          type="text"
          placeholder="Search employees by name, email, phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
      </div>

      {/* Table Container */}
      <div className="overflow-hidden border border-slate-200 bg-white rounded-2xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="rx-table-header">
                <th className="p-4">Full Name</th>
                <th className="p-4">Email Address</th>
                <th className="p-4">Role Badge</th>
                <th className="p-4">Branch</th>
                <th className="p-4">Contact Phone</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No employees found.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="rx-table-row">
                    <td className="p-4 font-semibold text-slate-900">{emp.full_name}</td>
                    <td className="p-4 text-slate-700">{emp.email || 'No email associated'}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide border uppercase ${
                          isSuperAdmin(emp)
                            ? 'bg-rose-900/30 text-rose-300 border-rose-800'
                            : hasAdminRole(emp)
                            ? 'rx-badge-success'
                            : isManager(emp)
                            ? 'bg-purple-900/30 text-purple-300 border-purple-800'
                            : 'rx-badge-info'
                        }`}
                      >
                        {emp.role}
                      </span>
                    </td>
                    <td className="p-4 text-slate-700">
                      {initialBranches.find((b) => b.id === emp.branch_id)?.name ?? '—'}
                    </td>
                    <td className="p-4 text-slate-700">{emp.phone || 'N/A'}</td>
                    <td className="p-4 text-center">
                      {emp.is_active ? (
                        <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold rx-badge-success">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold rx-badge-danger">
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-600 transition"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(emp.id, emp.is_active)}
                          className={`rounded-lg p-1.5 transition ${
                            emp.is_active
                              ? 'text-rose-700 hover:bg-rose-50 hover:text-rose-800'
                              : 'text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800'
                          }`}
                          title={emp.is_active ? 'Deactivate User' : 'Activate User'}
                        >
                          {emp.is_active ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isPending && setIsModalOpen(false)}
        title={editingEmployee ? 'Edit Employee Details' : 'Register New Employee'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Full Name *
              </label>
              <input
                type="text"
                required
                {...register('full_name')}
                placeholder="e.g. Rahul Sharma"
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500"
              />
              {errors.full_name && (
                <p className="mt-1 text-xs text-rose-600">{errors.full_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Email Address *
              </label>
              <input
                type="email"
                required
                {...register('email')}
                placeholder="rahul@pharmastore.com"
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Password {editingEmployee && '(leave blank to keep current)'} *
              </label>
              <input
                type="password"
                required={!editingEmployee}
                {...register('password')}
                placeholder="••••••••"
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Contact Phone
                </label>
                <input
                  type="text"
                  {...register('phone')}
                  placeholder="+91 XXXXX XXXXX"
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  User Role *
                </label>
                <select
                  required
                  {...register('role')}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-teal-500"
                >
                  {assignableRoles.map((r) => (
                    <option key={r} value={r} className="text-slate-800">
                      {r === 'super_admin'
                        ? 'Super Admin (Developer)'
                        : r === 'admin'
                        ? 'Admin (Store Owner)'
                        : r === 'manager'
                        ? 'Manager'
                        : 'Employee'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isActorSuperAdmin && (
              <p className="text-xs text-amber-600">
                Super Admins and Admins can only be created by a Super Admin.
              </p>
            )}

            <div className={isActorManager ? '' : 'grid grid-cols-2 gap-4'}>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Branch {isActorManager ? '' : '(assign scope for manager / staff)'}
                </label>
                <select
                  {...register('branch_id')}
                  disabled={isActorManager}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-teal-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="">{isActorManager ? 'Your assigned branch' : '— No branch —'}</option>
                  {activeBranches.map((b) => (
                    <option key={b.id} value={b.id} className="text-slate-800">
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
                {errors.branch_id && (
                  <p className="mt-1 text-xs text-rose-600">{errors.branch_id.message}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 py-2">
              <input
                type="checkbox"
                id="is_active"
                {...register('is_active')}
                className="h-4 w-4 rounded border-slate-300 bg-white text-teal-600 focus:ring-teal-500/20"
              />
              <label htmlFor="is_active" className="text-sm font-semibold text-slate-700">
                Account Active (User can log in)
              </label>
            </div>
          </div>

          {/* Feedback alerts */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle className="h-5 w-5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={isPending}
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 px-4 py-2.5 text-sm font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-sm transition disabled:opacity-50 px-4 py-2.5 text-sm"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingEmployee ? 'Save Changes' : 'Register User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
