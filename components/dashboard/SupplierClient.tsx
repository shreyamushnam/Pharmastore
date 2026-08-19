'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supplierSchema } from '@/lib/validation';
import { createSupplier, updateSupplier, deleteSupplier } from '@/lib/actions/suppliers';
import Modal from '@/components/ui/Modal';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle,
  Upload,
  Download,
} from 'lucide-react';

import { z } from 'zod';

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  created_at: string;
}

interface SupplierClientProps {
  initialSuppliers: Supplier[];
}

type SupplierFormData = z.infer<typeof supplierSchema>;

export default function SupplierClient({ initialSuppliers }: SupplierClientProps) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSuppliers(initialSuppliers);
  }, [initialSuppliers]);

  const exportSuppliersToCSV = () => {
    const headers = ['Name', 'Contact Person', 'Phone', 'Email', 'GSTIN', 'Address'];
    const rows = suppliers.map(s => [
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${(s.contact_person || '').replace(/"/g, '""')}"`,
      `"${(s.phone || '').replace(/"/g, '""')}"`,
      `"${(s.email || '').replace(/"/g, '""')}"`,
      `"${(s.gstin || '').replace(/"/g, '""')}"`,
      `"${(s.address || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = "\ufeff" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'suppliers_registry.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
        if (lines.length <= 1) {
          alert('CSV file is empty.');
          return;
        }

        const parsedSuppliers: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const row = parseCSVRow(lines[i]);
          if (row.length < 6) continue;

          parsedSuppliers.push({
            name: row[0],
            contact_person: row[1] || null,
            phone: row[2] || null,
            email: row[3] || null,
            gstin: row[4] || null,
            address: row[5] || null
          });
        }

        if (parsedSuppliers.length === 0) {
          alert('No valid supplier rows detected.');
          return;
        }

        let successCount = 0;
        let failCount = 0;

        startTransition(async () => {
          for (const sup of parsedSuppliers) {
            const res = await createSupplier(null, sup);
            if (res?.error) {
              failCount++;
            } else {
              successCount++;
            }
          }
          alert(`CSV Import Finished!\nSuccessfully Added: ${successCount}\nFailed: ${failCount}`);
          router.refresh();
        });
      } catch (err) {
        alert('An error occurred parsing the CSV.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const parseCSVRow = (text: string): string[] => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''));
    return result;
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema) as any,
    defaultValues: {
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      gstin: '',
      address: '',
    },
  });

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setError(null);
    setSuccessMsg(null);
    reset({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      gstin: '',
      address: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sup: Supplier) => {
    setEditingSupplier(sup);
    setError(null);
    setSuccessMsg(null);
    reset({
      name: sup.name,
      contact_person: sup.contact_person || '',
      phone: sup.phone || '',
      email: sup.email || '',
      gstin: sup.gstin || '',
      address: sup.address || '',
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: SupplierFormData) => {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      let res;
      if (editingSupplier) {
        res = await updateSupplier(editingSupplier.id, null, data);
      } else {
        res = await createSupplier(null, data);
      }

      if (res?.error) {
        setError(res.error);
      } else {
        setSuccessMsg(
          editingSupplier ? 'Supplier updated successfully' : 'Supplier created successfully'
        );
        router.refresh();
        setTimeout(() => {
          setIsModalOpen(false);
          setSuccessMsg(null);
        }, 1000);
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return;

    const previousSuppliers = suppliers;
    setSuppliers((prev) => prev.filter((s) => s.id !== id));

    const res = await deleteSupplier(id);
    if (res?.error) {
      alert(res.error);
      setSuppliers(previousSuppliers);
    } else {
      router.refresh();
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const query = searchQuery.toLowerCase();
    const name = s.name.toLowerCase();
    const contact = s.contact_person?.toLowerCase() || '';
    const phone = s.phone || '';
    const gstin = s.gstin?.toLowerCase() || '';
    return name.includes(query) || contact.includes(query) || phone.includes(query) || gstin.includes(query);
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Supplier Master</h1>
          <p className="text-sm text-slate-500">Manage medicine manufacturers, distributors, and logistics partners</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden Import file input */}
          <input
            type="file"
            id="supplier-csv-upload"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
          />
          <label
            htmlFor="supplier-csv-upload"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2.5 px-4 text-sm font-semibold transition cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </label>
          <button
            onClick={exportSuppliersToCSV}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2.5 px-4 text-sm font-semibold transition cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-sm transition cursor-pointer py-2.5 px-4 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add Supplier
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
          placeholder="Search suppliers by name, GSTIN, phone..."
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
                <th className="p-4">Supplier Name</th>
                <th className="p-4">Contact Person</th>
                <th className="p-4">Phone / Email</th>
                <th className="p-4 font-mono">GSTIN</th>
                <th className="p-4">Address</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No suppliers found.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((sup) => (
                  <tr key={sup.id} className="rx-table-row">
                    <td className="p-4 font-semibold text-slate-900">{sup.name}</td>
                    <td className="p-4 text-slate-700">{sup.contact_person || 'N/A'}</td>
                    <td className="p-4 text-slate-700">
                      <div>{sup.phone || 'N/A'}</div>
                      <div className="text-xs text-slate-500">{sup.email || ''}</div>
                    </td>
                    <td className="p-4 font-mono text-slate-700 text-xs">{sup.gstin || 'N/A'}</td>
                    <td className="p-4 text-slate-500 max-w-xs truncate" title={sup.address || ''}>
                      {sup.address || 'N/A'}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(sup)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-600 transition"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(sup.id)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-600 transition"
                        >
                          <Trash2 className="h-4 w-4" />
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
        title={editingSupplier ? 'Edit Supplier Details' : 'Register New Supplier'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Supplier / Business Name *
              </label>
              <input
                type="text"
                required
                {...register('name')}
                placeholder="e.g. Apex Distributors"
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Contact Person
                </label>
                <input
                  type="text"
                  {...register('contact_person')}
                  placeholder="e.g. Amit Patel"
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  GSTIN (Tax ID)
                </label>
                <input
                  type="text"
                  {...register('gstin')}
                  placeholder="e.g. 07AAAAA1111A1Z1"
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Phone Number
                </label>
                <input
                  type="text"
                  {...register('phone')}
                  placeholder="e.g. +91 98765 43210"
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  {...register('email')}
                  placeholder="info@apex.com"
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Full Business Address
              </label>
              <textarea
                {...register('address')}
                rows={3}
                placeholder="Street address, City, Pin Code..."
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 resize-none"
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
              className="flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-sm transition disabled:opacity-50 px-4 py-2.5 text-sm"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingSupplier ? 'Save Changes' : 'Register Supplier'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
