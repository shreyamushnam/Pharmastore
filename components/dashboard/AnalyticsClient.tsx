'use client';

import { useState } from 'react';
import {
  TrendingUp,
  Activity,
  DollarSign,
  Percent,
  AlertTriangle,
  Archive,
  Layers,
  ArrowRight,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

interface AnalyticsData {
  stockValuation: {
    cost: number;
    mrp: number;
    selling: number;
    marginVal: number;
    marginPercent: number;
    projectedTax: number;
  };
  expiryLoss: {
    cost: number;
    mrp: number;
  };
  supplierReturnsCredits: number;
  dailyTrends: Array<{ date: string; total: number }>;
  paymentMode: {
    cash: number;
    card: number;
    upi: number;
  };
  topSelling: Array<{ name: string; quantity: number; revenue: number }>;
}

interface AnalyticsClientProps {
  data: AnalyticsData;
}

export default function AnalyticsClient({ data }: AnalyticsClientProps) {
  // Chart calculation settings
  const dailyTrends = data.dailyTrends || [];
  const maxTotal = Math.max(...dailyTrends.map((t) => t.total), 1);
  
  // Dimensions for SVG line chart
  const svgWidth = 600;
  const svgHeight = 220;
  const padX = 50;
  const padY = 30;
  const chartW = svgWidth - padX * 2;
  const chartH = svgHeight - padY * 2;

  // Generate SVG coordinate points
  const points = dailyTrends.map((t, idx) => {
    const x = padX + (idx / Math.max(1, dailyTrends.length - 1)) * chartW;
    const y = svgHeight - padY - (t.total / maxTotal) * chartH;
    return { x, y, date: t.date, total: t.total };
  });

  const lineD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = points.length > 0 
    ? `${lineD} L ${points[points.length - 1].x} ${svgHeight - padY} L ${points[0].x} ${svgHeight - padY} Z`
    : '';

  // Payment totals
  const payData = data.paymentMode || { cash: 0, card: 0, upi: 0 };
  const payTotal = payData.cash + payData.card + payData.upi || 1;
  const payCashPercent = (payData.cash / payTotal) * 100;
  const payCardPercent = (payData.card / payTotal) * 100;
  const payUpiPercent = (payData.upi / payTotal) * 100;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-teal-600" />
          Financial Intelligence & Margins
        </h1>
        <p className="text-sm text-slate-500">
          Executive analytics covering retail performance, catalog valuations, tax liabilities, and expiry leakage
        </p>
      </div>

      {/* Primary KPI Widgets */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Cost valuation */}
        <div className="rx-card p-5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Catalog Valuation (Cost)</span>
            <DollarSign className="h-4 w-4 text-teal-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            ₹{data.stockValuation.cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-400">Total capital locked in inventory</div>
        </div>

        {/* Expected MRP valuation */}
        <div className="rx-card p-5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Catalog Valuation (MRP)</span>
            <DollarSign className="h-4 w-4 text-sky-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 font-mono">
            ₹{data.stockValuation.mrp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-400">Retail sales potential at maximum MRP</div>
        </div>

        {/* Expected margin */}
        <div className="rx-card p-5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Profit Margin</span>
            <Percent className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 font-mono">
            {data.stockValuation.marginPercent.toFixed(2)}%
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Estimated profit: ₹{data.stockValuation.marginVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>

        {/* Credit Returns valuation */}
        <div className="rx-card p-5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Recovered Returns</span>
            <ShieldCheck className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-600 font-mono">
            ₹{data.supplierReturnsCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-400">Returned near-expiry lots (last 30 days)</div>
        </div>
      </div>

      {/* Main Charts & Leakage Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sales Trend Chart (Left/Center) */}
        <div className="lg:col-span-2 rx-card p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-teal-600" />
            POS Daily Sales Revenue (Last 30 Days)
          </h3>

          {/* SVG line chart */}
          <div className="relative w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto min-w-[500px]"
            >
              {/* Definitions for Gradients */}
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1={padX} y1={padY} x2={svgWidth - padX} y2={padY} stroke="#e2e8f0" strokeDasharray="3,3" />
              <line x1={padX} y1={padY + chartH / 2} x2={svgWidth - padX} y2={padY + chartH / 2} stroke="#e2e8f0" strokeDasharray="3,3" />
              <line x1={padX} y1={svgHeight - padY} x2={svgWidth - padX} y2={svgHeight - padY} stroke="#cbd5e1" />

              {/* Area path */}
              {areaD && <path d={areaD} fill="url(#chartGradient)" />}

              {/* Line path */}
              {lineD && (
                <path
                  d={lineD}
                  fill="none"
                  stroke="#0d9488"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}

              {/* Dots & Labels */}
              {points.map((p, idx) => (
                <g key={idx}>
                  <circle cx={p.x} cy={p.y} r="3.5" fill="#0d9488" stroke="#ffffff" strokeWidth="1.5" />
                  {/* Date labels on horizontal axis */}
                  <text
                    x={p.x}
                    y={svgHeight - 10}
                    fill="#64748b"
                    fontSize="9"
                    textAnchor="middle"
                    className="font-mono font-semibold"
                  >
                    {p.date}
                  </text>
                  {/* Amount labels on hover (simulated via standard text tags at endpoints) */}
                  {(idx === 0 || idx === points.length - 1) && (
                    <text
                      x={p.x}
                      y={p.y - 8}
                      fill="#0f172a"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                      className="font-mono"
                    >
                      ₹{Math.round(p.total)}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* GST Liability & Expiry Leakage Card (Right) */}
        <div className="rx-card p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              Inventory Expiry Losses
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Value of medicines currently in stock that have passed their expiry date
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-left">
              <div className="text-[10px] uppercase font-bold text-rose-800">Loss at Cost</div>
              <div className="text-xl font-bold font-mono text-rose-900 mt-1">
                ₹{data.expiryLoss.cost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
              <div className="text-[10px] uppercase font-bold text-slate-600">Loss at Retail</div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                ₹{data.expiryLoss.mrp.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <Archive className="h-4 w-4 text-amber-700" />
                Projected Tax Liabilities
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Estimated GST (CGST/SGST) to be paid upon selling active catalog items
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
              <div className="text-[10px] uppercase font-bold text-amber-800">Estimated GST Payable</div>
              <div className="text-xl font-bold font-mono text-amber-900 mt-1">
                ₹{data.stockValuation.projectedTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Billing modes & Top Sellers */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Payment Modes */}
        <div className="rx-card p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-teal-600" />
            Billing Payment Channels
          </h3>
          <div className="space-y-4">
            {/* Cash */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">Cash Transactions</span>
                <span className="font-mono text-slate-800 font-semibold">
                  ₹{payData.cash.toLocaleString()} ({payCashPercent.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600" style={{ width: `${payCashPercent}%` }} />
              </div>
            </div>

            {/* UPI */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">UPI Payments</span>
                <span className="font-mono text-slate-800 font-semibold">
                  ₹{payData.upi.toLocaleString()} ({payUpiPercent.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-600" style={{ width: `${payUpiPercent}%` }} />
              </div>
            </div>

            {/* Card */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">Card Terminals</span>
                <span className="font-mono text-slate-800 font-semibold">
                  ₹{payData.card.toLocaleString()} ({payCardPercent.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600" style={{ width: `${payCardPercent}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Top Products */}
        <div className="rx-card p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-teal-600" />
            Top Selling Medicines
          </h3>
          <div className="divide-y divide-slate-200">
            {data.topSelling.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center">No sales registered yet.</div>
            ) : (
              data.topSelling.map((prod, idx) => (
                <div key={idx} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-500">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-slate-900">{prod.name}</span>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-mono text-slate-800 font-semibold">₹{prod.revenue.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-500">{prod.quantity} units sold</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
