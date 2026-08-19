'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  Store,
  FileText,
  Percent,
  AlertCircle,
  Save,
  CheckCircle,
} from 'lucide-react';

export default function AdminSettingsPage() {
  const [storeName, setStoreName] = useState('PharmaStore Retail');
  const [storePhone, setStorePhone] = useState('+91 98765 43210');
  const [storeEmail, setStoreEmail] = useState('contact@pharmastore.com');
  const [storeAddress, setStoreAddress] = useState('Main Market Road, Sector 15, New Delhi');
  const [gstin, setGstin] = useState('07AAAAA1111A1Z1');
  const [defaultTax, setDefaultTax] = useState(12);
  const [defaultReorder, setDefaultReorder] = useState(10);
  
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Load from localStorage on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setStoreName(localStorage.getItem('pims_store_name') || 'PharmaStore Retail');
      setStorePhone(localStorage.getItem('pims_store_phone') || '+91 98765 43210');
      setStoreEmail(localStorage.getItem('pims_store_email') || 'contact@pharmastore.com');
      setStoreAddress(localStorage.getItem('pims_store_address') || 'Main Market Road, Sector 15, New Delhi');
      setGstin(localStorage.getItem('pims_gstin') || '07AAAAA1111A1Z1');
      setDefaultTax(Number(localStorage.getItem('pims_default_tax') || '12'));
      setDefaultReorder(Number(localStorage.getItem('pims_default_reorder') || '10'));
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccess(false);

    setTimeout(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('pims_store_name', storeName);
        localStorage.setItem('pims_store_phone', storePhone);
        localStorage.setItem('pims_store_email', storeEmail);
        localStorage.setItem('pims_store_address', storeAddress);
        localStorage.setItem('pims_gstin', gstin);
        localStorage.setItem('pims_default_tax', defaultTax.toString());
        localStorage.setItem('pims_default_reorder', defaultReorder.toString());
      }
      setIsSaving(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }, 1000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-teal-600" />
          Global Configurations
        </h1>
        <p className="text-sm text-slate-500">
          Manage pharmacy metadata, default taxation rates, billing parameters, and store information
        </p>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>Pharmacy configurations updated successfully!</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: Store info */}
        <div className="rx-card p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
            <Store className="h-4 w-4 text-teal-600" />
            Store Metadata
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Pharmacy / Business Name</label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact Phone</label>
              <input
                type="text"
                value={storePhone}
                onChange={(e) => setStorePhone(e.target.value)}
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Support Email</label>
              <input
                type="email"
                value={storeEmail}
                onChange={(e) => setStoreEmail(e.target.value)}
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Physical Address</label>
              <input
                type="text"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Billing defaults */}
        <div className="rx-card p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
            <FileText className="h-4 w-4 text-teal-600" />
            Billing & Ingestion Defaults
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Pharmacy GSTIN</label>
              <input
                type="text"
                placeholder="GSTIN Number"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Default Tax Rate (GST %)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={defaultTax}
                onChange={(e) => setDefaultTax(Number(e.target.value))}
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-xs text-slate-800 outline-none focus:border-teal-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Default Reorder Level</label>
              <input
                type="number"
                min={1}
                value={defaultReorder}
                onChange={(e) => setDefaultReorder(Number(e.target.value))}
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-xs text-slate-800 outline-none focus:border-teal-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-6 py-3 text-xs font-bold text-white disabled:opacity-50 transition shadow-sm cursor-pointer"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full border-2 border-white border-t-transparent h-4 w-4" />
                Saving Changes...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Configurations
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
