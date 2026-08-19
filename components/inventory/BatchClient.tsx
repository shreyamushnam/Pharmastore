'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { batchSchema } from '@/lib/validation';
import { createBatch, updateBatch, deleteBatch } from '@/lib/actions/batches';
import { getExpiryStatus } from '@/lib/utils/expiry';
import Modal from '@/components/ui/Modal';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle,
  Calendar,
  Upload,
  Download,
} from 'lucide-react';

import { z } from 'zod';

interface Product {
  id: string;
  name: string;
  generic_name: string | null;
  unit: string | null;
  barcode?: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface Batch {
  id: string;
  product_id: string;
  supplier_id: string | null;
  batch_number: string;
  mfg_date: string | null;
  expiry_date: string;
  quantity_received: number;
  quantity_available: number;
  purchase_price: number;
  mrp: number;
  selling_price: number;
  products: {
    name: string;
    generic_name: string | null;
    unit: string | null;
    tax_rate: number;
    barcode?: string | null;
  } | null;
  suppliers: {
    name: string;
  } | null;
}

interface BatchClientProps {
  initialBatches: Batch[];
  products: Product[];
  suppliers: Supplier[];
}

type BatchFormData = z.infer<typeof batchSchema>;

export default function BatchClient({
  initialBatches,
  products,
  suppliers,
}: BatchClientProps) {
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>(initialBatches);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setBatches(initialBatches);
  }, [initialBatches]);

  const exportBatchesToCSV = () => {
    const headers = [
      'Product Barcode',
      'Product Name',
      'Supplier Name',
      'Batch Number',
      'Mfg Date (YYYY-MM-DD)',
      'Expiry Date (YYYY-MM-DD)',
      'Quantity Ingested',
      'Purchase Price',
      'MRP',
      'Selling Price'
    ];

    const rows = batches.map(b => [
      `"${(b.products?.barcode || '').replace(/"/g, '""')}"`,
      `"${(b.products?.name || '').replace(/"/g, '""')}"`,
      `"${(b.suppliers?.name || '').replace(/"/g, '""')}"`,
      `"${(b.batch_number || '').replace(/"/g, '""')}"`,
      `"${(b.mfg_date || '').replace(/"/g, '""')}"`,
      `"${(b.expiry_date || '').replace(/"/g, '""')}"`,
      b.quantity_received,
      b.purchase_price,
      b.mrp,
      b.selling_price
    ]);

    const csvContent = "\ufeff" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'batches_registry.csv');
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

        const parsedBatches: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const row = parseCSVRow(lines[i]);
          if (row.length < 10) continue;

          const csvBarcode = row[0];
          const csvProductName = row[1];
          const csvSupplierName = row[2];

          let matchedProduct = products.find(p => p.barcode === csvBarcode);
          if (!matchedProduct && csvProductName) {
            matchedProduct = products.find(p => p.name.toLowerCase() === csvProductName.toLowerCase());
          }

          if (!matchedProduct) {
            console.warn(`Product not found for: ${csvProductName || csvBarcode}`);
            continue;
          }

          let matchedSupplier = null;
          if (csvSupplierName) {
            matchedSupplier = suppliers.find(s => s.name.toLowerCase() === csvSupplierName.toLowerCase());
          }

          parsedBatches.push({
            product_id: matchedProduct.id,
            supplier_id: matchedSupplier ? matchedSupplier.id : null,
            batch_number: row[3],
            mfg_date: row[4] || null,
            expiry_date: row[5],
            quantity_received: Number(row[6] || '0'),
            purchase_price: Number(row[7] || '0'),
            mrp: Number(row[8] || '0'),
            selling_price: Number(row[9] || '0'),
          });
        }

        if (parsedBatches.length === 0) {
          alert('No valid batches parsed. Verify names or barcodes exist in catalog.');
          return;
        }

        let successCount = 0;
        let failCount = 0;

        startTransition(async () => {
          for (const bData of parsedBatches) {
            const res = await createBatch(null, bData);
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
        alert('CSV parsing failure.');
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
  } = useForm<BatchFormData>({
    resolver: zodResolver(batchSchema) as any,
    defaultValues: {
      product_id: '',
      supplier_id: '',
      batch_number: '',
      mfg_date: '',
      expiry_date: '',
      quantity_received: 0,
      purchase_price: 0,
      mrp: 0,
      selling_price: 0,
    },
  });

  const handleOpenAdd = () => {
    setEditingBatch(null);
    setError(null);
    setSuccessMsg(null);
    reset({
      product_id: products[0]?.id || '',
      supplier_id: suppliers[0]?.id || null,
      batch_number: '',
      mfg_date: '',
      expiry_date: '',
      quantity_received: 0,
      purchase_price: 0,
      mrp: 0,
      selling_price: 0,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (batch: Batch) => {
    setEditingBatch(batch);
    setError(null);
    setSuccessMsg(null);
    reset({
      product_id: batch.product_id,
      supplier_id: batch.supplier_id,
      batch_number: batch.batch_number,
      mfg_date: batch.mfg_date || '',
      expiry_date: batch.expiry_date,
      quantity_received: batch.quantity_received,
      purchase_price: Number(batch.purchase_price),
      mrp: Number(batch.mrp),
      selling_price: Number(batch.selling_price),
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: BatchFormData) => {
    setError(null);
    setSuccessMsg(null);

    // Convert empty supplier_id to null
    const submissionData = {
      ...data,
      supplier_id: data.supplier_id === '' ? null : data.supplier_id,
    };

    startTransition(async () => {
      let res;
      if (editingBatch) {
        res = await updateBatch(editingBatch.id, null, submissionData);
      } else {
        res = await createBatch(null, submissionData);
      }

      if (res?.error) {
        setError(res.error);
      } else {
        setSuccessMsg(
          editingBatch ? 'Batch updated successfully' : 'Batch created & stock logged successfully'
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
    if (!confirm('Are you sure you want to delete this batch? This will revert any stock availability associated with it.')) return;

    const previousBatches = batches;
    setBatches((prev) => prev.filter((b) => b.id !== id));

    const res = await deleteBatch(id);
    if (res?.error) {
      alert(res.error);
      setBatches(previousBatches);
    } else {
      router.refresh();
    }
  };

  const filteredBatches = batches.filter((b) => {
    const query = searchQuery.toLowerCase();
    const productName = b.products?.name.toLowerCase() || '';
    const genericName = b.products?.generic_name?.toLowerCase() || '';
    const batchNo = b.batch_number.toLowerCase();
    return productName.includes(query) || genericName.includes(query) || batchNo.includes(query);
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Batch Master</h1>
          <p className="text-sm text-slate-500">Manage medicine batches, pricing, and expiry dates</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden Import file input */}
          <input
            type="file"
            id="batch-csv-upload"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
          />
          <label
            htmlFor="batch-csv-upload"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2.5 px-4 text-sm font-semibold transition cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </label>
          <button
            onClick={exportBatchesToCSV}
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
            Add Batch
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
          placeholder="Search by product name, batch no..."
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
                <th className="p-4">Product Name</th>
                <th className="p-4">Batch Number</th>
                <th className="p-4 text-center">Expiry Status</th>
                <th className="p-4 text-center">Stock (Avail / Recv)</th>
                <th className="p-4 text-center">Purchase / MRP / Sell</th>
                <th className="p-4">Supplier</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No batches found.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch) => {
                  const expiryInfo = getExpiryStatus(batch.expiry_date);
                  const badgeClass =
                    expiryInfo.status === 'expired' || expiryInfo.status === 'critical'
                      ? 'rx-badge-danger'
                      : expiryInfo.status === 'warning'
                      ? 'rx-badge-warning'
                      : 'rx-badge-success';

                  return (
                    <tr key={batch.id} className="rx-table-row">
                      <td className="p-4">
                        <div className="font-semibold text-slate-900">
                          {batch.products?.name || 'Unknown Product'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {batch.products?.generic_name || 'No generic composition'}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-slate-800">{batch.batch_number}</td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold border ${badgeClass}`}
                        >
                          {expiryInfo.label}
                        </span>
                        <div className="mt-1 text-[10px] text-slate-500">
                          Exp: {new Date(batch.expiry_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`font-semibold ${batch.quantity_available === 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                          {batch.quantity_available}
                        </span>
                        <span className="text-xs text-slate-500"> / {batch.quantity_received}</span>
                        <div className="text-[10px] text-slate-500 uppercase mt-0.5">{batch.products?.unit || 'units'}</div>
                      </td>
                      <td className="p-4 text-center text-slate-700 font-mono text-xs">
                        ₹{Number(batch.purchase_price).toFixed(2)} / ₹{Number(batch.mrp).toFixed(2)} / ₹
                        {Number(batch.selling_price).toFixed(2)}
                      </td>
                      <td className="p-4 text-slate-700">{batch.suppliers?.name || 'Direct / Unknown'}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(batch)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-600 transition"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(batch.id)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-650 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isPending && setIsModalOpen(false)}
        title={editingBatch ? 'Edit Batch Pricing & Expiry' : 'Stock-In New Batch'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!editingBatch ? (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Select Product *
                </label>
                <select
                  required
                  {...register('product_id')}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-teal-500"
                >
                  <option value="" disabled>Select a product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id} className="text-slate-800">
                      {p.name} {p.generic_name && `(${p.generic_name})`}
                    </option>
                  ))}
                </select>
                {errors.product_id && (
                  <p className="mt-1 text-xs text-rose-600">{errors.product_id.message}</p>
                )}
              </div>
            ) : (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Product
                </label>
                <div className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm text-slate-600">
                  {editingBatch.products?.name}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Batch Number *
              </label>
              <input
                type="text"
                required
                {...register('batch_number')}
                placeholder="e.g. B-PRC103"
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500"
              />
              {errors.batch_number && (
                <p className="mt-1 text-xs text-rose-600">{errors.batch_number.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Supplier
              </label>
              <select
                {...register('supplier_id')}
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-teal-500"
              >
                <option value="" className="text-slate-800">Direct purchase (No supplier)</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id} className="text-slate-800">
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Mfg Date
              </label>
              <input
                type="date"
                {...register('mfg_date')}
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Expiry Date *
              </label>
              <input
                type="date"
                required
                {...register('expiry_date')}
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-teal-500"
              />
              {errors.expiry_date && (
                <p className="mt-1 text-xs text-rose-600">{errors.expiry_date.message}</p>
              )}
            </div>

            {!editingBatch ? (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Quantity Received *
                </label>
                <input
                  type="number"
                  required
                  {...register('quantity_received')}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-teal-500"
                />
                {errors.quantity_received && (
                  <p className="mt-1 text-xs text-rose-600">{errors.quantity_received.message}</p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Quantity Received
                </label>
                <div className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm text-slate-600">
                  {editingBatch.quantity_received} (adjust via stock ledger)
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Purchase Price (Per Unit) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                {...register('purchase_price')}
                placeholder="₹ 0.00"
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-teal-500"
              />
              {errors.purchase_price && (
                <p className="mt-1 text-xs text-rose-600">{errors.purchase_price.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                MRP (Max Retail Price) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                {...register('mrp')}
                placeholder="₹ 0.00"
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-teal-500"
              />
              {errors.mrp && <p className="mt-1 text-xs text-rose-600">{errors.mrp.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Selling Price *
              </label>
              <input
                type="number"
                step="0.01"
                required
                {...register('selling_price')}
                placeholder="₹ 0.00"
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-teal-500"
              />
              {errors.selling_price && (
                <p className="mt-1 text-xs text-rose-600">{errors.selling_price.message}</p>
              )}
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
              {editingBatch ? 'Save Changes' : 'Record Stock-In'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
