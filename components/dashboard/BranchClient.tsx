'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { branchSchema } from '@/lib/validation';
import { createBranch, updateBranch, toggleBranchStatus } from '@/lib/actions/branches';
import Modal from '@/components/ui/Modal';
import {
  Plus,
  Search,
  Edit2,
  AlertTriangle,
  Loader2,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  MapPin,
  Phone,
  Building2,
} from 'lucide-react';

import { z } from 'zod';

interface Branch {
  id: string;
  name: string;
  code: string;
  location: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  drug_licence_no?: string | null;
  gstin?: string | null;
}

interface BranchClientProps {
  initialBranches: Branch[];
}

type BranchFormData = z.infer<typeof branchSchema>;

export default function BranchClient({ initialBranches }: BranchClientProps) {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setBranches(initialBranches);
  }, [initialBranches]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema) as any,
    defaultValues: {
      name: '',
      code: '',
      location: '',
      phone: '',
      is_active: true,
      drug_licence_no: '',
      gstin: '',
    },
  });

  const handleOpenAdd = () => {
    setEditingBranch(null);
    setError(null);
    setSuccessMsg(null);
    reset({
      name: '',
      code: '',
      location: '',
      phone: '',
      is_active: true,
      drug_licence_no: '',
      gstin: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setError(null);
    setSuccessMsg(null);
    reset({
      name: branch.name,
      code: branch.code,
      location: branch.location || '',
      phone: branch.phone || '',
      is_active: branch.is_active,
      drug_licence_no: branch.drug_licence_no || '',
      gstin: branch.gstin || '',
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: BranchFormData) => {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      let res;
      if (editingBranch) {
        res = await updateBranch(editingBranch.id, null, data);
      } else {
        res = await createBranch(null, data);
      }

      if (res?.error) {
        setError(res.error);
      } else {
        setSuccessMsg(
          editingBranch ? 'Branch updated successfully' : 'Branch created successfully'
        );
        router.refresh();
        setTimeout(() => {
          setIsModalOpen(false);
          setSuccessMsg(null);
        }, 1000);
      }
    });
  };

  const handleToggleActive = async (branch: Branch) => {
    const nextStatus = !branch.is_active;
    const confirmMsg = nextStatus
      ? `Are you sure you want to activate the branch "${branch.name}"?`
      : `Are you sure you want to deactivate the branch "${branch.name}"?`;
    
    if (!confirm(confirmMsg)) return;

    // Optimistic update
    const previousBranches = branches;
    setBranches((prev) =>
      prev.map((b) => (b.id === branch.id ? { ...b, is_active: nextStatus } : b))
    );

    const res = await toggleBranchStatus(branch.id, nextStatus);
    if (res?.error) {
      alert(res.error);
      setBranches(previousBranches);
    } else {
      router.refresh();
    }
  };

  const filteredBranches = branches.filter((b) => {
    const query = searchQuery.toLowerCase();
    const name = b.name.toLowerCase();
    const code = b.code.toLowerCase();
    const location = b.location?.toLowerCase() || '';
    return name.includes(query) || code.includes(query) || location.includes(query);
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Branch Directory</h1>
          <p className="text-sm text-slate-500">Manage retail pharmacy branches and warehouse locations</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-sm transition cursor-pointer py-2.5 px-4 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add Branch
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
          <Search className="h-4 w-4" />
        </div>
        <input
          type="text"
          placeholder="Search branches by name, code, or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
      </div>

      {/* Table Container */}
      <div className="overflow-hidden border border-slate-200 bg-white rounded-2xl shadow-sm animate-fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-xxs font-bold border-b border-slate-100">
                <th className="p-4">Branch Details</th>
                <th className="p-4">Branch Code</th>
                <th className="p-4">Location</th>
                <th className="p-4">Drug Licence / GSTIN</th>
                <th className="p-4">Contact Phone</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredBranches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No pharmacy branches found.
                  </td>
                </tr>
              ) : (
                filteredBranches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="font-semibold text-slate-900">{branch.name}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-mono font-bold">
                        {branch.code}
                      </span>
                    </td>
                    <td className="p-4 text-slate-700">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        {branch.location || 'N/A'}
                      </div>
                    </td>
                    <td className="p-4 text-slate-700">
                      <div className="text-xs">
                        <div className="font-semibold text-slate-900">DL: {branch.drug_licence_no || 'N/A'}</div>
                        <div className="text-slate-550 font-mono">GST: {branch.gstin || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="p-4 text-slate-700">
                      <div className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {branch.phone || 'N/A'}
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          branch.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            branch.is_active ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        {branch.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(branch)}
                          title={branch.is_active ? 'Deactivate Branch' : 'Activate Branch'}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-600 transition cursor-pointer"
                        >
                          {branch.is_active ? (
                            <ToggleRight className="h-6 w-6 text-teal-600" />
                          ) : (
                            <ToggleLeft className="h-6 w-6 text-slate-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleOpenEdit(branch)}
                          title="Edit Details"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-600 transition cursor-pointer"
                        >
                          <Edit2 className="h-4 w-4" />
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
        title={editingBranch ? 'Edit Branch Details' : 'Register New Pharmacy Branch'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Branch / Outlet Name *
              </label>
              <input
                type="text"
                required
                {...register('name')}
                placeholder="e.g. Hyderabad Main Branch"
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Branch Code (Unique) *
                </label>
                <input
                  type="text"
                  required
                  {...register('code')}
                  placeholder="e.g. HYD-01"
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 font-mono"
                />
                {errors.code && (
                  <p className="mt-1 text-xs text-rose-600">{errors.code.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Contact Phone
                </label>
                <input
                  type="text"
                  {...register('phone')}
                  placeholder="e.g. +91 98765 43210"
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Drug Licence No.
                </label>
                <input
                  type="text"
                  {...register('drug_licence_no')}
                  placeholder="e.g. Form 20B/21B"
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  GSTIN
                </label>
                <input
                  type="text"
                  {...register('gstin')}
                  placeholder="e.g. 36AAAAA1111A1Z1"
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Location / Address
              </label>
              <input
                type="text"
                {...register('location')}
                placeholder="e.g. Jubilee Hills, Hyderabad"
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500"
              />
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
              className="flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-sm transition disabled:opacity-50 px-4 py-2.5 text-sm cursor-pointer"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingBranch ? 'Save Changes' : 'Register Branch'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
