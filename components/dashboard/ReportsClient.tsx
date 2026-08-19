'use client';

import { useState, useMemo, startTransition, useTransition } from 'react';
import { returnBatchToSupplier } from '@/lib/actions/stock';
import { getExpiryStatus } from '@/lib/utils/expiry';
import {
  FileSpreadsheet,
  Calendar,
  Download,
  AlertTriangle,
  RefreshCw,
  Building,
  CheckCircle2,
  Trash2,
  PackageX,
  IndianRupee,
  Clock,
  TrendingDown,
  Loader2,
} from 'lucide-react';

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface Batch {
  id: string;
  batch_number: string;
  product_id: string;
  products: {
    name: string;
    generic_name: string | null;
    hsn_code: string | null;
    tax_rate: number;
    unit: string | null;
  } | null;
  suppliers: {
    name: string;
  } | null;
  mrp: number;
  selling_price: number;
  quantity_available: number;
  expiry_date: string;
  branch_id: string | null;
}

interface Sale {
  id: string;
  invoice_number: string;
  created_at: string;
  subtotal: number;
  tax_amount: number;
  discount: number;
  total: number;
  payment_mode: string;
  branch_id: string | null;
  customers: {
    name: string;
    phone: string | null;
  } | null;
  profiles: {
    full_name: string;
  } | null;
  items?: Array<{
    quantity: number;
    unit_price: number;
    tax_amount: number;
    batches: {
      batch_number: string;
      products: {
        name: string;
        hsn_code: string | null;
        tax_rate: number;
      } | null;
    } | null;
  }>;
}

interface ReportsClientProps {
  initialBranches: Branch[];
  initialBatches: Batch[];
  initialSales: Sale[];
}

export default function ReportsClient({
  initialBranches,
  initialBatches,
  initialSales,
}: ReportsClientProps) {
  const [activeTab, setActiveTab] = useState<'gst' | 'expiry'>('gst');

  // Filter States
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0] // 30 days ago
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [expiryHorizon, setExpiryHorizon] = useState<'all' | 'expired' | '30' | '60' | '90'>('all');

  const [batches, setBatches] = useState<Batch[]>(initialBatches);
  const [sales] = useState<Sale[]>(initialSales);

  const [isPending, startRtvTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. FILTER SALES FOR GST REPORT
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const saleDate = new Date(s.created_at).toISOString().split('T')[0];
      const matchBranch = selectedBranch === 'all' || s.branch_id === selectedBranch;
      const matchDate = saleDate >= startDate && saleDate <= endDate;
      return matchBranch && matchDate;
    });
  }, [sales, selectedBranch, startDate, endDate]);

  // 2. GST REPORT CALCULATIONS (MRP-Inclusive Back-Worked Slabs)
  const gstReportData = useMemo(() => {
    // slab calculations: 0%, 5%, 12%, 18%
    const summary: Record<number, { taxable: number; cgst: number; sgst: number; total: number }> = {
      0: { taxable: 0, cgst: 0, sgst: 0, total: 0 },
      5: { taxable: 0, cgst: 0, sgst: 0, total: 0 },
      12: { taxable: 0, cgst: 0, sgst: 0, total: 0 },
      18: { taxable: 0, cgst: 0, sgst: 0, total: 0 },
    };

    let totalTaxableValue = 0;
    let totalTaxCollected = 0;
    let grandGrossTotal = 0;

    filteredSales.forEach((sale) => {
      // Back-work tax totals from sale total
      // Since our items inside sales can have different tax rates, let's distribute proportional discount.
      // If we don't have items loaded, fallback to using the sale.tax_amount and sale.subtotal directly
      // but let's assume we fetch items or calculate based on the sale properties.
      // Wait, let's split the sale total based on its tax slabs
      // If the sale is simple, we distribute the tax based on the subtotal.
      // Let's do a reliable back-work from sale subtotal and tax_amount
      const total = Number(sale.total);
      const tax = Number(sale.tax_amount);
      const sub = Number(sale.subtotal); // base value before tax
      
      totalTaxableValue += sub;
      totalTaxCollected += tax;
      grandGrossTotal += total;

      // Split into slabs based on average tax rate or fallback to 12% default slab
      // Let's say if we don't have item-level details, we assign it to the 12% default slab,
      // or we can calculate the effective rate: rate = (tax / sub) * 100
      const rate = sub > 0 ? Math.round((tax / sub) * 100) : 12;
      
      // Map effective rate to nearest standard slab
      let slab = 12;
      if (rate <= 2) slab = 0;
      else if (rate <= 8) slab = 5;
      else if (rate <= 15) slab = 12;
      else slab = 18;

      if (!summary[slab]) {
        summary[slab] = { taxable: 0, cgst: 0, sgst: 0, total: 0 };
      }
      summary[slab].taxable += sub;
      summary[slab].cgst += tax / 2;
      summary[slab].sgst += tax / 2;
      summary[slab].total += total;
    });

    return {
      summary,
      totalTaxableValue,
      totalTaxCollected,
      grandGrossTotal,
    };
  }, [filteredSales]);

  // 3. FILTER BATCHES FOR EXPIRY REPORT
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const matchBranch = selectedBranch === 'all' || b.branch_id === selectedBranch;
      if (!matchBranch) return false;

      const expiryDate = new Date(b.expiry_date);
      const today = new Date();
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (expiryHorizon === 'expired') {
        return diffDays < 0;
      } else if (expiryHorizon === '30') {
        return diffDays >= 0 && diffDays <= 30;
      } else if (expiryHorizon === '60') {
        return diffDays >= 0 && diffDays <= 60;
      } else if (expiryHorizon === '90') {
        return diffDays >= 0 && diffDays <= 90;
      }
      return true;
    });
  }, [batches, selectedBranch, expiryHorizon]);

  // Expiry Report Valuation Summaries
  const expirySummaries = useMemo(() => {
    let expiredValue = 0;
    let nearExpiryValue = 0; // within 90 days
    let totalStockValue = 0;
    let expiredCount = 0;
    let nearExpiryCount = 0;

    batches.forEach((b) => {
      const matchBranch = selectedBranch === 'all' || b.branch_id === selectedBranch;
      if (!matchBranch) return;

      const value = b.quantity_available * Number(b.selling_price);
      totalStockValue += value;

      const expiryDate = new Date(b.expiry_date);
      const today = new Date();
      const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        expiredValue += value;
        expiredCount++;
      } else if (diffDays <= 90) {
        nearExpiryValue += value;
        nearExpiryCount++;
      }
    });

    return {
      expiredValue,
      nearExpiryValue,
      totalStockValue,
      expiredCount,
      nearExpiryCount,
    };
  }, [batches, selectedBranch]);

  // 4. RTV (RETURN TO VENDOR) SUBMIT HANDLER
  const handleRtv = (batchId: string) => {
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return;

    const confirmMsg = `Are you sure you want to trigger Return-to-Vendor (RTV) for Batch "${batch.batch_number}" of "${batch.products?.name}"?\nThis will deduct all remaining ${batch.quantity_available} units of stock and log a supplier return.`;
    if (!confirm(confirmMsg)) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    startRtvTransition(async () => {
      const res = await returnBatchToSupplier(batchId, 'RTV: Return of Expired/Near-Expiry stock');
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(`RTV process completed successfully for batch ${batch.batch_number}`);
        // Locally update batch quantity available to 0 to reflect instantly
        setBatches((prev) =>
          prev.map((b) => (b.id === batchId ? { ...b, quantity_available: 0 } : b))
        );
      }
    });
  };

  // 5. EXPORT GSTR DATA (JSON & CSV)
  const handleExport = (format: 'json' | 'csv', type: 'GSTR-1' | 'GSTR-3B') => {
    let content = '';
    let mimeType = '';
    let fileName = '';

    if (type === 'GSTR-1') {
      const data = filteredSales.map((s) => ({
        invoice_number: s.invoice_number,
        date: new Date(s.created_at).toLocaleString(),
        customer_name: s.customers?.name || 'Walk-in',
        customer_phone: s.customers?.phone || 'N/A',
        taxable_value: Number(s.subtotal).toFixed(2),
        cgst_collected: (Number(s.tax_amount) / 2).toFixed(2),
        sgst_collected: (Number(s.tax_amount) / 2).toFixed(2),
        igst_collected: '0.00',
        total_value: Number(s.total).toFixed(2),
        payment_mode: s.payment_mode,
      }));

      if (format === 'json') {
        content = JSON.stringify(data, null, 2);
        mimeType = 'application/json';
        fileName = `GSTR_1_Report_${startDate}_to_${endDate}.json`;
      } else {
        const headers = 'Invoice No,Date,Customer,Phone,Taxable Value,CGST,SGST,IGST,Gross Total,Payment Mode\n';
        const rows = data
          .map(
            (r) =>
              `"${r.invoice_number}","${r.date}","${r.customer_name}","${r.customer_phone}",${r.taxable_value},${r.cgst_collected},${r.sgst_collected},${r.igst_collected},${r.total_value},"${r.payment_mode}"`
          )
          .join('\n');
        content = headers + rows;
        mimeType = 'text/csv';
        fileName = `GSTR_1_Report_${startDate}_to_${endDate}.csv`;
      }
    } else {
      // GSTR-3B slab summary
      const slabs = gstReportData.summary;
      const data = Object.keys(slabs).map((rateStr) => {
        const rate = Number(rateStr);
        const slabData = slabs[rate];
        return {
          gst_rate: `${rate}%`,
          taxable_turnover: slabData.taxable.toFixed(2),
          cgst_amount: slabData.cgst.toFixed(2),
          sgst_amount: slabData.sgst.toFixed(2),
          igst_amount: '0.00',
          gross_total: slabData.total.toFixed(2),
        };
      });

      if (format === 'json') {
        content = JSON.stringify(data, null, 2);
        mimeType = 'application/json';
        fileName = `GSTR_3B_Summary_${startDate}_to_${endDate}.json`;
      } else {
        const headers = 'GST Rate Slab,Taxable Value (Turnover),CGST Liability,SGST Liability,IGST Liability,Gross Output Value\n';
        const rows = data
          .map(
            (r) =>
              `"${r.gst_rate}",${r.taxable_turnover},${r.cgst_amount},${r.sgst_amount},${r.igst_amount},${r.gross_total}`
          )
          .join('\n');
        content = headers + rows;
        mimeType = 'text/csv';
        fileName = `GSTR_3B_Summary_${startDate}_to_${endDate}.csv`;
      }
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Regulatory Reports & Audit</h1>
          <p className="text-sm text-slate-500">
            Export GST filings ledger and review expiring shelf batches for Return-to-Vendor (RTV)
          </p>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="rx-card p-4 bg-white grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-[10px] font-bold text-slate-650 uppercase tracking-wider">Scoping Branch</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-800 outline-none focus:border-teal-500"
          >
            <option value="all">All Branches (HQ Consolidation)</option>
            {initialBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>

        {activeTab === 'gst' ? (
          <>
            <div>
              <label className="block text-[10px] font-bold text-slate-650 uppercase tracking-wider">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-800 outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-650 uppercase tracking-wider">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-800 outline-none focus:border-teal-500"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-[10px] font-bold text-slate-650 uppercase tracking-wider">Expiry Horizon</label>
            <select
              value={expiryHorizon}
              onChange={(e) => setExpiryHorizon(e.target.value as any)}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-800 outline-none focus:border-teal-500"
            >
              <option value="all">All Batches</option>
              <option value="expired">Expired Batches (Block List)</option>
              <option value="30">Expiring in 30 Days</option>
              <option value="60">Expiring in 60 Days</option>
              <option value="90">Expiring in 90 Days</option>
            </select>
          </div>
        )}
        
        <div className="flex justify-end">
          <button
            onClick={() => {
              setSelectedBranch('all');
              setStartDate(new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0]);
              setEndDate(new Date().toISOString().split('T')[0]);
              setExpiryHorizon('all');
            }}
            className="flex items-center justify-center gap-1 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition cursor-pointer py-2 px-4 text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset Filters
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('gst')}
          className={`pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'gst'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <FileSpreadsheet className="h-4 w-4" />
            GST Tax Report (GSTR-1 / GSTR-3B)
          </div>
        </button>

        <button
          onClick={() => setActiveTab('expiry')}
          className={`pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'expiry'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            Expiry Analysis & RTV Manager
          </div>
        </button>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB CONTENTS */}
      {activeTab === 'gst' ? (
        <div className="space-y-6">
          {/* KPI Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rx-card p-5 bg-white flex items-center gap-4">
              <div className="p-3.5 rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
                <IndianRupee className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gross Outward Turnover</span>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                  ₹{gstReportData.grandGrossTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
              </div>
            </div>

            <div className="rx-card p-5 bg-white flex items-center gap-4">
              <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <IndianRupee className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Taxable value</span>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                  ₹{gstReportData.totalTaxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
              </div>
            </div>

            <div className="rx-card p-5 bg-white flex items-center gap-4">
              <div className="p-3.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <IndianRupee className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">GST Collected (CGST/SGST)</span>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                  ₹{gstReportData.totalTaxCollected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
              </div>
            </div>
          </div>

          {/* GSTR-3B Slab Breakdown */}
          <div className="rx-card p-6 bg-white space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">GSTR-3B Self-Declaration Slab Summary</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('csv', 'GSTR-3B')}
                  className="flex items-center justify-center gap-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-650"
                >
                  <Download className="h-3.5 w-3.5 text-teal-650" />
                  Export CSV
                </button>
                <button
                  onClick={() => handleExport('json', 'GSTR-3B')}
                  className="flex items-center justify-center gap-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-650"
                >
                  <Download className="h-3.5 w-3.5 text-teal-650" />
                  Export JSON
                </button>
              </div>
            </div>

            <div className="overflow-hidden border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b">
                    <th className="p-3">GST Slab Rate</th>
                    <th className="p-3 text-right">Taxable Turnover (INR)</th>
                    <th className="p-3 text-right">CGST Collected (INR)</th>
                    <th className="p-3 text-right">SGST Collected (INR)</th>
                    <th className="p-3 text-right">IGST Collected (INR)</th>
                    <th className="p-3 text-right">Gross Output Turnover</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {Object.keys(gstReportData.summary).map((rateStr) => {
                    const rate = Number(rateStr);
                    const slab = gstReportData.summary[rate];
                    return (
                      <tr key={rate} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-900">GST {rate}% Slab</td>
                        <td className="p-3 text-right font-mono">₹{slab.taxable.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono">₹{slab.cgst.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono">₹{slab.sgst.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono">₹0.00</td>
                        <td className="p-3 text-right font-mono font-bold">₹{slab.total.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* GSTR-1 Sales Register List */}
          <div className="rx-card p-6 bg-white space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">GSTR-1 Outward Supplies Register</h2>
                <p className="text-xs text-slate-500 mt-0.5">List of all bills generated in scope</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('csv', 'GSTR-1')}
                  className="flex items-center justify-center gap-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-650"
                >
                  <Download className="h-3.5 w-3.5 text-teal-650" />
                  Export GSTR-1 CSV
                </button>
                <button
                  onClick={() => handleExport('json', 'GSTR-1')}
                  className="flex items-center justify-center gap-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-650"
                >
                  <Download className="h-3.5 w-3.5 text-teal-650" />
                  Export GSTR-1 JSON
                </button>
              </div>
            </div>

            <div className="overflow-hidden border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b">
                    <th className="p-3">Invoice No</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3 text-right">Taxable Value</th>
                    <th className="p-3 text-right">CGST</th>
                    <th className="p-3 text-right">SGST</th>
                    <th className="p-3 text-right">Gross Total</th>
                    <th className="p-3 text-center">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs text-slate-650">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No sales recorded for the selected date range.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-900">{s.invoice_number}</td>
                        <td className="p-3">{new Date(s.created_at).toLocaleDateString()}</td>
                        <td className="p-3">{s.customers?.name || 'Walk-in'}</td>
                        <td className="p-3 text-right font-mono">₹{Number(s.subtotal).toFixed(2)}</td>
                        <td className="p-3 text-right font-mono">₹{(Number(s.tax_amount) / 2).toFixed(2)}</td>
                        <td className="p-3 text-right font-mono">₹{(Number(s.tax_amount) / 2).toFixed(2)}</td>
                        <td className="p-3 text-right font-mono font-semibold">₹{Number(s.total).toFixed(2)}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-100 border text-[10px] font-semibold uppercase text-slate-600">
                            {s.payment_mode}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Expiry Analysis Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rx-card p-5 bg-white flex items-center gap-4">
              <div className="p-3.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                <PackageX className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expired Stock Value</span>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                  ₹{expirySummaries.expiredValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <span className="text-[10px] text-rose-600 block mt-0.5 font-bold">
                  {expirySummaries.expiredCount} batch(es) expired (Hard-Blocked)
                </span>
              </div>
            </div>

            <div className="rx-card p-5 bg-white flex items-center gap-4">
              <div className="p-3.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Near-Expiry Value (90 Days)</span>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                  ₹{expirySummaries.nearExpiryValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <span className="text-[10px] text-amber-600 block mt-0.5 font-semibold">
                  {expirySummaries.nearExpiryCount} batch(es) expiring soon
                </span>
              </div>
            </div>

            <div className="rx-card p-5 bg-white flex items-center gap-4">
              <div className="p-3.5 rounded-xl bg-teal-50 text-teal-600 border border-teal-100">
                <IndianRupee className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Active Stock Valuation</span>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                  ₹{expirySummaries.totalStockValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <span className="text-[10px] text-teal-600 block mt-0.5 font-semibold">
                  Including unexpired batches
                </span>
              </div>
            </div>
          </div>

          {/* Expiry Analysis List & RTV Actions */}
          <div className="rx-card p-6 bg-white space-y-4">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-3">Expiry Register & Return-To-Vendor (RTV) Ledger</h2>

            <div className="overflow-hidden border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b">
                    <th className="p-3">Medicine Description</th>
                    <th className="p-3">Batch Number</th>
                    <th className="p-3">Expiry Date</th>
                    <th className="p-3 text-center">Remaining Qty</th>
                    <th className="p-3 text-right">Selling Price</th>
                    <th className="p-3 text-right">Value (INR)</th>
                    <th className="p-3">Supplier Name</th>
                    <th className="p-3 text-center">RTV Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs text-slate-650">
                  {filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No batches match the selected Expiry Horizon filter.
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map((b) => {
                      const value = b.quantity_available * Number(b.selling_price);
                      const isExpired = new Date(b.expiry_date) < new Date();
                      
                      const expiryDate = new Date(b.expiry_date);
                      const today = new Date();
                      const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      
                      let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      let statusText = 'Normal';
                      if (diffDays < 0) {
                        badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                        statusText = 'Expired';
                      } else if (diffDays <= 90) {
                        badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                        statusText = `Expiring in ${diffDays}d`;
                      }

                      return (
                        <tr key={b.id} className="hover:bg-slate-50/50">
                          <td className="p-3">
                            <div className="font-semibold text-slate-900">{b.products?.name || 'Unknown Product'}</div>
                            <div className="text-[10px] text-slate-500">
                              {b.products?.generic_name || 'Generic'} {b.products?.hsn_code && `| HSN: ${b.products.hsn_code}`}
                            </div>
                          </td>
                          <td className="p-3 font-mono font-semibold text-slate-900">{b.batch_number}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold ${badgeColor}`}>
                              {b.expiry_date} ({statusText})
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold text-slate-800">{b.quantity_available}</td>
                          <td className="p-3 text-right font-mono">₹{Number(b.selling_price).toFixed(2)}</td>
                          <td className="p-3 text-right font-mono font-semibold">₹{value.toFixed(2)}</td>
                          <td className="p-3 text-slate-700">{b.suppliers?.name || 'N/A'}</td>
                          <td className="p-3 text-center">
                            {b.quantity_available > 0 ? (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleRtv(b.id)}
                                className="inline-flex items-center gap-1 rounded bg-rose-50 hover:bg-rose-100 border border-rose-250 text-[10px] font-semibold text-rose-700 py-1 px-2.5 transition cursor-pointer"
                              >
                                {isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin text-rose-700" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                Return (RTV)
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium italic">Returned</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
