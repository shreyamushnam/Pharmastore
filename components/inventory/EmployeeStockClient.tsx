'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { stockAdjustmentSchema } from '@/lib/validation';
import { adjustStock } from '@/lib/actions/stock';
import { getExpiryStatus } from '@/lib/utils/expiry';
import Modal from '@/components/ui/Modal';
import {
  Search,
  AlertTriangle,
  Loader2,
  CheckCircle,
  ShieldAlert,
  Barcode,
  Sparkles,
} from 'lucide-react';

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
    requires_prescription: boolean;
  } | null;
  suppliers: {
    name: string;
  } | null;
}

interface EmployeeStockClientProps {
  batches: Batch[];
}

type AdjustmentFormData = {
  batch_id: string;
  adjustment_direction: 'decrease' | 'increase';
  quantity_input: number;
  movement_type: 'adjustment' | 'writeoff';
  reason: string;
};

export default function EmployeeStockClient({ batches }: EmployeeStockClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AdjustmentFormData>({
    defaultValues: {
      batch_id: '',
      adjustment_direction: 'decrease',
      quantity_input: 1,
      movement_type: 'writeoff',
      reason: '',
    },
  });

  const handleOpenAdjustment = (batch: Batch) => {
    setSelectedBatch(batch);
    setError(null);
    setSuccessMsg(null);
    reset({
      batch_id: batch.id,
      adjustment_direction: 'decrease',
      quantity_input: 1,
      movement_type: 'writeoff',
      reason: '',
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: AdjustmentFormData) => {
    setError(null);
    setSuccessMsg(null);

    // Enforce that decrementing stock resolves to negative quantity for ledger, and vice-versa
    const signedQuantity =
      data.adjustment_direction === 'decrease' ? -Math.abs(data.quantity_input) : Math.abs(data.quantity_input);

    startTransition(async () => {
      const res = await adjustStock(null, {
        batch_id: data.batch_id,
        movement_type: data.movement_type,
        quantity: signedQuantity,
        reason: data.reason,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        setSuccessMsg(
          res.queued
            ? 'Request submitted successfully! Awaiting Admin approval.'
            : 'Stock adjustment updated successfully!'
        );
        setTimeout(() => {
          setIsModalOpen(false);
          window.location.reload();
        }, 1500);
      }
    });
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Live Stock Register</h1>
          <p className="text-sm text-slate-500">View available quantities, check expiry dates, and report damage or count corrections</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
          <Search className="h-4 w-4" />
        </div>
        <input
          type="text"
          placeholder="Scan barcode or search name/generic/batch..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          <Barcode className="h-5 w-5 text-slate-450" />
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-hidden border border-slate-200 bg-white rounded-2xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="rx-table-header">
                <th className="p-4">Product details</th>
                <th className="p-4">Batch Code</th>
                <th className="p-4 text-center">Expiry band</th>
                <th className="p-4 text-center">Available Stock</th>
                <th className="p-4 text-center">MRP</th>
                <th className="p-4">Supplier</th>
                <th className="p-4 text-right">Ledger Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No matching stock items found.
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
                          {batch.products?.generic_name || 'No generic'} {batch.products?.requires_prescription && (
                            <span className="ml-1.5 inline-flex rounded-md px-1.5 py-0.2 text-[9px] font-semibold rx-badge-danger">Rx</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-slate-800">{batch.batch_number}</td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border ${badgeClass}`}
                        >
                          {expiryInfo.label}
                        </span>
                        <div className="mt-1 text-[10px] text-slate-500">
                          Exp: {new Date(batch.expiry_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`font-semibold ${batch.quantity_available === 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {batch.quantity_available}
                        </span>
                        <span className="text-xs text-slate-500"> / {batch.quantity_received}</span>
                        <div className="text-[10px] text-slate-500 uppercase mt-0.5">{batch.products?.unit || 'units'}</div>
                      </td>
                      <td className="p-4 text-center text-slate-700 font-mono text-xs">
                        ₹{Number(batch.mrp).toFixed(2)}
                      </td>
                      <td className="p-4 text-slate-700">{batch.suppliers?.name || 'Direct / Unknown'}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleOpenAdjustment(batch)}
                          className="rounded-lg bg-amber-50 border border-amber-200 py-1.5 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition shadow-sm"
                        >
                          Report Log
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjustment Request Modal */}
      {selectedBatch && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => !isPending && setIsModalOpen(false)}
          title="Report Discrepancy or Write-off"
        >
          <div className="mb-4 rounded-xl bg-slate-50 p-4 border border-slate-200 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Selected Medicine</div>
            <div className="mt-1 font-bold text-slate-900">{selectedBatch.products?.name}</div>
            <div className="text-xs text-slate-500">Batch Code: <span className="font-mono text-slate-800">{selectedBatch.batch_number}</span></div>
            <div className="mt-2 text-xs text-slate-500">Current Available Quantity: <span className="font-bold text-emerald-700">{selectedBatch.quantity_available} {selectedBatch.products?.unit || 'units'}</span></div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Action Type *
                </label>
                <select
                  {...register('adjustment_direction')}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-teal-500"
                >
                  <option value="decrease" className="text-slate-800">Deduct / Decrease (-)</option>
                  <option value="increase" className="text-slate-800">Reconcile / Increase (+)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Adjustment Category *
                </label>
                <select
                  {...register('movement_type')}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-teal-500"
                >
                  <option value="writeoff" className="text-slate-800">Write-off / Breakage / Theft</option>
                  <option value="adjustment" className="text-slate-800">Stock Count Adjustment</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Quantity *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  {...register('quantity_input', { valueAsNumber: true })}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Reason for Adjustment *
                </label>
                <textarea
                  required
                  rows={3}
                  {...register('reason')}
                  placeholder="e.g. Expired capsules found, bottle broken, recount during monthly check..."
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 resize-none"
                />
              </div>
            </div>

            {/* Note alert */}
            <div className="flex gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <span>
                Note: Since your account has Operator / Employee permissions, this request will be sent to the Admin queue. It will not alter physical stock levels until approved by an administrator.
              </span>
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
                className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm transition disabled:opacity-50 px-4 py-2.5 text-sm"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Request
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
