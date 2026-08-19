'use client';

import { useState, useTransition } from 'react';
import { getExpiryStatus } from '@/lib/utils/expiry';
import { returnBatchToSupplier } from '@/lib/actions/stock';
import {
  AlertTriangle,
  Layers,
  Truck,
  CheckCircle,
  AlertCircle,
  Download,
  Send,
  Loader2,
  Calendar,
} from 'lucide-react';

interface LowStockItem {
  product_id: string;
  name: string;
  generic_name: string | null;
  total_stock: number;
  reorder_level: number;
  unit: string | null;
}

interface BatchAlert {
  id: string;
  batch_number: string;
  expiry_date: string;
  quantity_available: number;
  purchase_price: number;
  product_name: string;
  generic_name: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_phone: string | null;
  supplier_email: string | null;
}

interface AlertsClientProps {
  lowStockItems: LowStockItem[];
  batchAlerts: BatchAlert[];
}

export default function AlertsClient({ lowStockItems, batchAlerts }: AlertsClientProps) {
  const [activeTab, setActiveTab] = useState<'low-stock' | 'expiry' | 'returns'>('low-stock');
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Group batch alerts by Supplier for the Return Generator
  const supplierReturns: {
    [key: string]: {
      supplierName: string;
      phone: string | null;
      email: string | null;
      items: Array<{
        id: string;
        product_name: string;
        batch_number: string;
        expiry_date: string;
        quantity: number;
        purchase_price: number;
        total_value: number;
      }>;
    };
  } = {};

  batchAlerts.forEach((b) => {
    const sId = b.supplier_id || 'direct';
    const sName = b.supplier_name || 'Direct Purchase (No Supplier)';

    if (!supplierReturns[sId]) {
      supplierReturns[sId] = {
        supplierName: sName,
        phone: b.supplier_phone,
        email: b.supplier_email,
        items: [],
      };
    }

    supplierReturns[sId].items.push({
      id: b.id,
      product_name: b.product_name,
      batch_number: b.batch_number,
      expiry_date: b.expiry_date,
      quantity: b.quantity_available,
      purchase_price: Number(b.purchase_price),
      total_value: b.quantity_available * Number(b.purchase_price),
    });
  });

  // Export CSV helper
  const handleExportCSV = (supplierName: string, items: any[]) => {
    const headers = 'Product Name,Batch Number,Expiry Date,Available Quantity,Unit Cost (INR),Total Return Value (INR)\n';
    const rows = items
      .map(
        (item) =>
          `"${item.product_name}","${item.batch_number}","${item.expiry_date}",${item.quantity},${item.purchase_price.toFixed(2)},${item.total_value.toFixed(2)}`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Distributor_Return_${supplierName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Process all returns for a supplier
  const handleProcessSupplierReturn = (supplierId: string, supplierName: string, items: any[]) => {
    if (
      !confirm(
        `Are you sure you want to return all ${items.length} near-expiry lots to "${supplierName}"? This will write off these items from stock.`
      )
    )
      return;

    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      let failed = false;
      for (const item of items) {
        const res = await returnBatchToSupplier(item.id, `Returned to distributor: ${supplierName}`);
        if (res?.error) {
          setErrorMsg(`Error returning batch ${item.batch_number}: ${res.error}`);
          failed = true;
          break;
        }
      }

      if (!failed) {
        setSuccessMsg(`Successfully processed returns to supplier: ${supplierName}`);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ops & Inventory Alerts</h1>
        <p className="text-sm text-slate-500">
          Track low-stock medicines, inspect expired/critical items, and prepare supplier returns
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border border-slate-200 bg-slate-100 p-1 rounded-xl max-w-md">
        <button
          onClick={() => setActiveTab('low-stock')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'low-stock'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Low Stock ({lowStockItems.length})
        </button>

        <button
          onClick={() => setActiveTab('expiry')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'expiry'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="h-4 w-4" />
          Expiry Alerts ({batchAlerts.length})
        </button>

        <button
          onClick={() => setActiveTab('returns')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'returns'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Truck className="h-4 w-4" />
          Supplier Returns
        </button>
      </div>

      {/* Success/Error displays */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tab Contents */}
      {activeTab === 'low-stock' && (
        <div className="overflow-hidden border border-slate-200 bg-white rounded-2xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="rx-table-header">
                  <th className="p-4">Medicine Name</th>
                  <th className="p-4">Generic Formula</th>
                  <th className="p-4 text-center">Current Total Stock</th>
                  <th className="p-4 text-center">Reorder Threshold</th>
                  <th className="p-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {lowStockItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      All catalog items satisfy reorder targets!
                    </td>
                  </tr>
                ) : (
                  lowStockItems.map((item) => (
                    <tr key={item.product_id} className="rx-table-row">
                      <td className="p-4 font-bold text-slate-900">{item.name}</td>
                      <td className="p-4 text-slate-500">{item.generic_name || 'N/A'}</td>
                      <td className="p-4 text-center font-semibold text-rose-600">
                        {item.total_stock} <span className="text-[10px] text-slate-500 uppercase">{item.unit || 'units'}</span>
                      </td>
                      <td className="p-4 text-center text-slate-700 font-mono">{item.reorder_level}</td>
                      <td className="p-4 text-right">
                        <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold rx-badge-danger">
                          Reorder Alert
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'expiry' && (
        <div className="overflow-hidden border border-slate-200 bg-white rounded-2xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="rx-table-header">
                  <th className="p-4">Medicine Details</th>
                  <th className="p-4">Batch Number</th>
                  <th className="p-4 text-center">Expiry Status</th>
                  <th className="p-4 text-center">Available Stock</th>
                  <th className="p-4">Supplier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {batchAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No batches are currently near expiry. Inventory is healthy!
                    </td>
                  </tr>
                ) : (
                  batchAlerts.map((batch) => {
                    const statusInfo = getExpiryStatus(batch.expiry_date);
                    const badgeClass =
                      statusInfo.status === 'expired' || statusInfo.status === 'critical'
                        ? 'rx-badge-danger'
                        : statusInfo.status === 'warning'
                        ? 'rx-badge-warning'
                        : 'rx-badge-success';

                    return (
                      <tr key={batch.id} className="rx-table-row">
                        <td className="p-4 font-bold text-slate-900">
                          <div>{batch.product_name}</div>
                          <div className="text-xs text-slate-500 font-normal">{batch.generic_name || ''}</div>
                        </td>
                        <td className="p-4 font-mono text-slate-800">{batch.batch_number}</td>
                        <td className="p-4 text-center">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border ${badgeClass}`}
                          >
                            {statusInfo.label}
                          </span>
                          <div className="mt-1 text-[10px] text-slate-500">
                            Exp: {new Date(batch.expiry_date).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="p-4 text-center text-slate-800 font-semibold">{batch.quantity_available}</td>
                        <td className="p-4 text-slate-700">{batch.supplier_name || 'Direct / Unknown'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'returns' && (
        <div className="space-y-6">
          {Object.keys(supplierReturns).length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
              No near-expiry inventory available to process for supplier returns.
            </div>
          ) : (
            Object.entries(supplierReturns).map(([sId, data]) => {
              const totalValuation = data.items.reduce((sum, item) => sum + item.total_value, 0);

              return (
                <div
                  key={sId}
                  className="rx-card p-6 space-y-4"
                >
                  {/* Supplier Card Info Header */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                        <Truck className="h-5 w-5 text-teal-600" />
                        {data.supplierName}
                      </h3>
                      {data.phone || data.email ? (
                        <p className="text-xs text-slate-500 mt-1">
                          {data.phone && `Phone: ${data.phone}`} {data.email && `• Email: ${data.email}`}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1">No supplier contact details available</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500 uppercase tracking-wider">Return Valuation</div>
                      <div className="text-lg font-mono font-bold text-emerald-700">
                        ₹{totalValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Table of items returning to this supplier */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/50">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="p-3">Medicine</th>
                          <th className="p-3">Batch Number</th>
                          <th className="p-3">Expiry Date</th>
                          <th className="p-3 text-center">Return Qty</th>
                          <th className="p-3 text-right">Unit Price (INR)</th>
                          <th className="p-3 text-right">Value (INR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-700">
                        {data.items.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-100/50">
                            <td className="p-3 font-bold text-slate-900">{item.product_name}</td>
                            <td className="p-3 font-mono text-slate-700">{item.batch_number}</td>
                            <td className="p-3 flex items-center gap-1 text-slate-600">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              {new Date(item.expiry_date).toLocaleDateString()}
                            </td>
                            <td className="p-3 text-center font-semibold text-slate-900">{item.quantity}</td>
                            <td className="p-3 text-right font-mono">₹{item.purchase_price.toFixed(2)}</td>
                            <td className="p-3 text-right font-mono text-slate-900 font-semibold">₹{item.total_value.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => handleExportCSV(data.supplierName, data.items)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 py-2 px-4 text-xs font-semibold text-slate-700 transition"
                    >
                      <Download className="h-4 w-4 text-teal-600" />
                      Export Return CSV
                    </button>
                    <button
                      onClick={() => handleProcessSupplierReturn(sId, data.supplierName, data.items)}
                      disabled={isPending || sId === 'direct'}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 py-2 px-4 text-xs font-semibold text-white disabled:opacity-50 transition shadow-sm"
                      title={sId === 'direct' ? 'Cannot return direct purchase batches automatically' : ''}
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Process return & Deduct Stock
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
