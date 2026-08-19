'use client';

import { useState, useEffect, useRef, useTransition, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createSale, getSaleDetails } from '@/lib/actions/sales';
import { getExpiryStatus } from '@/lib/utils/expiry';
import { getCurrentUser } from '@/lib/actions/auth';
import { getBranches } from '@/lib/actions/branches';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Barcode,
  Upload,
  CreditCard,
  QrCode,
  DollarSign,
  AlertCircle,
  CheckCircle,
  FileText,
  Printer,
  Camera,
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

import dynamic from 'next/dynamic';
import { allocateBatchesFEFO } from '@/lib/utils/fefo';

const InvoicePDFButton = dynamic(
  () => import('./InvoicePDFButton'),
  { ssr: false }
);

interface Batch {
  id: string;
  batch_number: string;
  quantity_available: number;
  purchase_price: number;
  mrp: number;
  selling_price: number;
  expiry_date: string;
}

interface Product {
  id: string;
  name: string;
  generic_name: string | null;
  requires_prescription: boolean;
  tax_rate: number;
  barcode: string | null;
  unit: string | null;
  pack_size: string | null;
  hsn_code: string | null;
  batches?: Batch[];
}

interface CartItem {
  product: Product;
  quantity: number; // in saleUnit
  saleUnit: 'strip' | 'unit';
  taxRate: number;
}

interface POSBillingClientProps {
  products: Product[];
}

export default function POSBillingClient({ products }: POSBillingClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'upi'>('cash');
  const [discount, setDiscount] = useState<number>(0);
  
  // Prescription upload fields
  const [prescriptionRef, setPrescriptionRef] = useState('');
  const [prescriptionUrl, setPrescriptionUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Checkout feedback
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [createdInvoiceNum, setCreatedInvoiceNum] = useState<string | null>(null);
  const [lastCreatedSale, setLastCreatedSale] = useState<any | null>(null);
  const [currentBranch, setCurrentBranch] = useState<any | null>(null);
  const [pharmacistName, setPharmacistName] = useState('Active Staff');

  useEffect(() => {
    async function loadUserBranch() {
      try {
        const user = await getCurrentUser();
        if (user) {
          setPharmacistName(user.full_name || 'Active Staff');
          const branchesList = await getBranches();
          const userBranch = branchesList.find((b: any) => b.id === user.branch_id);
          if (userBranch) {
            setCurrentBranch(userBranch);
          } else {
            const activeBranch = branchesList.find((b: any) => b.is_active);
            if (activeBranch) {
              setCurrentBranch(activeBranch);
            }
          }
        }
      } catch (err) {
        console.error('Error loading user branch:', err);
      }
    }
    loadUserBranch();
  }, []);
  const [isPending, startTransition] = useTransition();

  // Camera Barcode Scanner State
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Auto-close search list when selecting
  const [showProductList, setShowProductList] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0);

  // Auto-dismiss alert notifications
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 4055); // slightly offset
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Calculated totals using FEFO and pack sizes
  const cartWithAllocations = useMemo(() => {
    return cart.map((item) => {
      const packSize = parseInt(item.product.pack_size || '1') || 1;
      const totalUnitsRequired = item.saleUnit === 'strip' ? item.quantity * packSize : item.quantity;
      const productBatches = item.product.batches || [];
      
      const { allocations, unallocatedQuantity } = allocateBatchesFEFO(
        productBatches.map(b => ({
          id: b.id,
          batch_number: b.batch_number,
          quantity_available: b.quantity_available,
          selling_price: b.selling_price,
          mrp: b.mrp,
          expiry_date: b.expiry_date,
          tax_rate: Number(item.product.tax_rate)
        })),
        totalUnitsRequired
      );

      return {
        ...item,
        packSize,
        totalUnitsRequired,
        allocations,
        unallocatedQuantity,
      };
    });
  }, [cart]);

  const subtotal = useMemo(() => {
    return cartWithAllocations.reduce((sum, item) => {
      const lineSubtotal = item.allocations.reduce((lineSum, alloc) => {
        const lineTotal = (alloc.quantitySelected * alloc.sellingPrice) / item.packSize;
        const lineBase = lineTotal / (1 + alloc.taxRate / 100);
        return lineSum + lineBase;
      }, 0);
      return sum + lineSubtotal;
    }, 0);
  }, [cartWithAllocations]);

  const taxAmount = useMemo(() => {
    return cartWithAllocations.reduce((sum, item) => {
      const lineTax = item.allocations.reduce((lineSum, alloc) => {
        const lineTotal = (alloc.quantitySelected * alloc.sellingPrice) / item.packSize;
        const lineBase = lineTotal / (1 + alloc.taxRate / 100);
        return lineSum + (lineTotal - lineBase);
      }, 0);
      return sum + lineTax;
    }, 0);
  }, [cartWithAllocations]);

  const totalAmount = Math.max(0, subtotal + taxAmount - discount);

  // Check if any cart item requires prescription
  const requiresRx = cart.some((item) => item.product.requires_prescription);

  // Handle barcode scanner initialization
  useEffect(() => {
    if (showScanner) {
      scannerRef.current = new Html5QrcodeScanner(
        'qr-reader',
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scannerRef.current.render(
        (decodedText) => {
          handleBarcodeScan(decodedText);
          setShowScanner(false);
          if (scannerRef.current) {
            scannerRef.current.clear();
          }
        },
        (err) => {}
      );
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((e) => console.log('Error clearing scanner', e));
      }
    };
  }, [showScanner]);

  const handleBarcodeScan = (barcode: string) => {
    const foundProduct = products.find((p) => p.barcode === barcode);
    if (foundProduct) {
      addToCart(foundProduct);
      setSuccessMsg(`Scanned: ${foundProduct.name}`);
    } else {
      setError(`No product registered with barcode: ${barcode}`);
    }
  };

  const addToCart = (product: Product) => {
    setError(null);
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          saleUnit: (product.pack_size && parseInt(product.pack_size) > 1) ? 'strip' : 'unit',
          taxRate: Number(product.tax_rate),
        },
      ];
    });
    setSearchQuery('');
    setShowProductList(false);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const updateUnitType = (productId: string, unit: 'strip' | 'unit') => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, saleUnit: unit } : item
      )
    );
  };

  const handlePrescriptionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `prescriptions/${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('prescriptions')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('prescriptions')
        .getPublicUrl(filePath);

      setPrescriptionUrl(urlData.publicUrl);
      setSuccessMsg('Prescription image uploaded successfully!');
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(`Storage Upload failed: Make sure 'prescriptions' storage bucket is created in Supabase.`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCheckout = () => {
    setError(null);
    setSuccessMsg(null);

    if (cart.length === 0) {
      setError('Please add products to the cart first.');
      return;
    }

    if (requiresRx && !prescriptionRef && !prescriptionUrl) {
      setError('Schedule H/H1/X drugs require a Doctor prescription reference or image upload.');
      return;
    }

    // Check if any item has shortage (unallocated quantity)
    const hasShortage = cartWithAllocations.some((item) => item.unallocatedQuantity > 0);
    if (hasShortage) {
      const shortageItem = cartWithAllocations.find((item) => item.unallocatedQuantity > 0);
      setError(`Insufficient unexpired stock for: ${shortageItem?.product.name}. Short by ${shortageItem?.unallocatedQuantity} unit(s).`);
      return;
    }

    startTransition(async () => {
      const res = await createSale({
        customerName,
        customerPhone,
        customerAddress,
        items: cartWithAllocations.map((item) => ({
          productId: item.product.id,
          quantity: item.totalUnitsRequired,
        })),
        paymentMode,
        discount,
        prescriptionRef: prescriptionRef || undefined,
        prescriptionUrl: prescriptionUrl || undefined,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        setSuccessMsg(`Checkout completed successfully!`);
        setCreatedInvoiceNum(res.invoiceNumber || 'INV-TEMP');
        
        // Fetch the database-authoritative sale details (resolves P4-M1)
        if (res.saleId) {
          const dbSale = await getSaleDetails(res.saleId);
          if (dbSale) {
            setLastCreatedSale(dbSale);
          } else {
            // Fallback to client state in case DB details fetch fails (e.g. offline placeholder mode)
            setLastCreatedSale({
              invoice_number: res.invoiceNumber || 'INV-TEMP',
              customer_name: customerName,
              customer_phone: customerPhone,
              customer_address: customerAddress,
              created_at: new Date().toISOString(),
              subtotal,
              tax_amount: taxAmount,
              discount,
              total: totalAmount,
              payment_mode: paymentMode,
              pharmacist_name: pharmacistName,
              items: [...cartWithAllocations],
            });
          }
        }
        
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setCustomerAddress('');
        setDiscount(0);
        setPrescriptionRef('');
        setPrescriptionUrl('');
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Autocomplete suggestions
  const suggestions = products.filter((p) => {
    if (searchQuery.trim() === '') return false;
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      (p.generic_name && p.generic_name.toLowerCase().includes(query)) ||
      (p.barcode && p.barcode.includes(query))
    );
  });

  return (
    <div className="space-y-6">
      {/* Printable Receipt Block for Browser Print Stylesheet */}
      {createdInvoiceNum && lastCreatedSale && currentBranch && (
        <div className="hidden print:block print:bg-white print:text-black p-4 w-[80mm] mx-auto text-xs font-mono">
          <div className="text-center font-bold text-base">{currentBranch.name}</div>
          <div className="text-center">DL No: {currentBranch.drug_licence_no || 'N/A'}</div>
          <div className="text-center">GSTIN: {currentBranch.gstin || 'N/A'}</div>
          <div className="text-center">Phone: {currentBranch.phone || 'N/A'}</div>
          <div className="border-t border-dashed my-2" />
          <div>Invoice: {createdInvoiceNum}</div>
          <div>Date: {new Date(lastCreatedSale.created_at).toLocaleString()}</div>
          <div>Customer: {lastCreatedSale.customer_name || 'Walk-in'}</div>
          <div className="border-t border-dashed my-2" />
          <table className="w-full text-left text-[10px]">
            <thead>
              <tr className="border-b">
                <th>Item/Batch</th>
                <th className="text-center">Qty</th>
                <th className="text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {lastCreatedSale.items.map((item: any, idx: number) => 
                item.allocations.map((alloc: any, aIdx: number) => {
                  const isLoose = item.saleUnit === 'unit';
                  const itemQty = isLoose ? alloc.quantitySelected : (alloc.quantitySelected / item.packSize);
                  return (
                    <tr key={`${idx}-${aIdx}`} className="align-top">
                      <td>
                        <div>{item.product.name}</div>
                        <div className="text-[8px] text-slate-500">
                          B: {alloc.batchNumber} | HSN: {item.product.hsn_code || 'N/A'}
                        </div>
                      </td>
                      <td className="text-center">{itemQty}</td>
                      <td className="text-right">₹{(itemQty * (alloc.sellingPrice / (isLoose ? item.packSize : 1))).toFixed(2)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className="border-t border-dashed my-2" />
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>₹{lastCreatedSale.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>CGST + SGST tax:</span>
            <span>₹{lastCreatedSale.tax_amount.toFixed(2)}</span>
          </div>
          {lastCreatedSale.discount > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Discount:</span>
              <span>-₹{lastCreatedSale.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t border-dashed pt-1">
            <span>Net Paid Amount:</span>
            <span>₹{lastCreatedSale.total.toFixed(2)}</span>
          </div>
          <div className="text-center mt-4">Thank you! Get well soon.</div>
        </div>
      )}

      {/* POS UI wrapper (hidden during browser print) */}
      <div className="print:hidden grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Side: Product Search & Cart */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rx-card p-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
              <ShoppingCart className="h-5 w-5 text-teal-600" />
              Counter Billing Terminal
            </h2>

            {/* Barcode scanner view */}
            {showScanner && (
              <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500">Position barcode in the box</span>
                  <button
                    onClick={() => setShowScanner(false)}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Close Camera
                  </button>
                </div>
                <div id="qr-reader" className="mx-auto max-w-sm" />
              </div>
            )}

            {/* Product Lookup Area */}
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Search className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  placeholder="Scan barcode or type medicine name to add..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowProductList(true);
                    setActiveSuggestionIdx(0);
                  }}
                  onFocus={() => setShowProductList(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActiveSuggestionIdx((prev) => 
                        Math.min(suggestions.length - 1, prev + 1)
                      );
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActiveSuggestionIdx((prev) => Math.max(0, prev - 1));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (suggestions[activeSuggestionIdx]) {
                        addToCart(suggestions[activeSuggestionIdx]);
                      }
                    } else if (e.key === 'Escape') {
                      setShowProductList(false);
                    }
                  }}
                  className="block w-full rounded-xl border border-slate-350 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              {/* Camera Scanner Toggle */}
              <button
                onClick={() => setShowScanner(!showScanner)}
                className="flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 px-4 border border-slate-300 text-slate-700 gap-1.5 transition cursor-pointer"
                title="Scan Barcode using Device Camera"
              >
                <Camera className="h-5 w-5 text-teal-600" />
                <span className="hidden sm:inline text-xs font-semibold">Camera Scan</span>
              </button>
            </div>

            {/* Autocomplete Suggestions Box */}
            {showProductList && suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl divide-y divide-slate-100">
                {suggestions.map((p, idx) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors ${
                      idx === activeSuggestionIdx 
                        ? 'bg-teal-50 text-teal-900' 
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-800">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.generic_name || 'Composition N/A'}</div>
                    </div>
                    <div className="text-right">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 border border-slate-200">GST: {p.tax_rate}%</span>
                      {p.requires_prescription && (
                        <span className="ml-1.5 rounded bg-rose-50 border border-rose-200 px-2 py-0.5 text-xs text-rose-700">Rx</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Cart Table */}
            <div className="mt-6">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Billing Cart</h3>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="rx-table-header border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="p-3">Medicine Description</th>
                      <th className="p-3 text-center">Unit Type</th>
                      <th className="p-3">Allocated Batch</th>
                      <th className="p-3 text-center">Quantity</th>
                      <th className="p-3 text-right">Price</th>
                      <th className="p-3 text-right">Total (GST)</th>
                      <th className="p-3 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-650">
                    {cartWithAllocations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          Your billing cart is empty. Scan or search items above to begin.
                        </td>
                      </tr>
                    ) : (
                      cartWithAllocations.map((item) => {
                        const hasPackSize = item.packSize > 1;
                        // Calculate total line amount
                        const lineTotal = item.allocations.reduce((sum, alloc) => sum + (alloc.quantitySelected * alloc.sellingPrice) / item.packSize, 0);
                        
                        return (
                          <tr key={item.product.id} className="rx-table-row">
                            <td className="p-3">
                              <div className="font-semibold text-slate-900">{item.product.name}</div>
                              <div className="text-[10px] text-slate-500">
                                {item.product.generic_name || 'Generic'} {item.product.hsn_code && `| HSN: ${item.product.hsn_code}`} {item.product.requires_prescription && (
                                  <span className="ml-1 text-rose-600 font-semibold">[Prescription Req.]</span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              {hasPackSize ? (
                                <select
                                  value={item.saleUnit}
                                  onChange={(e) => updateUnitType(item.product.id, e.target.value as 'strip' | 'unit')}
                                  className="rounded-lg border border-slate-350 bg-white py-1 px-2 text-[10px] text-slate-805 outline-none focus:border-teal-500"
                                >
                                  <option value="strip">Strips (x{item.packSize})</option>
                                  <option value="unit">Tablets (Loose)</option>
                                </select>
                              ) : (
                                <span className="text-[10px] text-slate-550 font-semibold uppercase">
                                  Units ({item.product.unit || 'pcs'})
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="space-y-1">
                                {item.allocations.length === 0 ? (
                                  <span className="text-rose-600 font-semibold text-[10px] flex items-center gap-1">
                                    <AlertCircle className="h-3.5 w-3.5" /> No active stock
                                  </span>
                                ) : (
                                  item.allocations.map((alloc, aIdx) => {
                                    const isNearExpiry = getExpiryStatus(alloc.expiryDate).status !== 'ok';
                                    return (
                                      <div key={aIdx} className="font-mono text-[9px] text-slate-700 flex flex-col border-l border-slate-200 pl-1.5">
                                        <span className="font-semibold">
                                          {alloc.batchNumber} ({item.saleUnit === 'unit' ? alloc.quantitySelected : (alloc.quantitySelected / item.packSize)} {item.saleUnit === 'unit' ? 'tab' : 'str'})
                                        </span>
                                        <span className={isNearExpiry ? 'text-amber-600 font-bold' : 'text-slate-500'}>
                                          Exp: {alloc.expiryDate}
                                        </span>
                                      </div>
                                    );
                                  })
                                )}
                                {item.unallocatedQuantity > 0 && item.allocations.length > 0 && (
                                  <span className="text-rose-600 font-semibold text-[9px] block">
                                    Shortage: {item.saleUnit === 'unit' ? item.unallocatedQuantity : (item.unallocatedQuantity / item.packSize)} {item.saleUnit === 'unit' ? 'tab' : 'str'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <div className="inline-flex items-center rounded-lg bg-slate-50 p-0.5 border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.product.id, -1)}
                                  className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-8 font-bold text-slate-800 text-center text-xs">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.product.id, 1)}
                                  className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            <td className="p-3 text-right text-slate-700 font-mono font-semibold">
                              {item.allocations.length > 0 ? (
                                <>
                                  ₹{((item.allocations[0].sellingPrice) / (item.saleUnit === 'unit' ? item.packSize : 1)).toFixed(2)}
                                  <span className="text-[9px] text-slate-500 block">
                                    {item.saleUnit === 'unit' ? '/tab' : '/str'}
                                  </span>
                                </>
                              ) : (
                                '₹0.00'
                              )}
                            </td>
                            <td className="p-3 text-right text-slate-700 font-mono font-bold">
                              ₹{lineTotal.toFixed(2)}
                              <span className="text-[9px] text-slate-500 font-normal block">
                                GST {item.taxRate}%
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.product.id, -item.quantity)}
                                className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
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
          </div>
        </div>

        {/* Right Side: Customer info, prescription upload & Checkout */}
        <div className="space-y-6">
          <div className="rx-card p-6 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3">Checkout Details</h2>

            {/* Customer Details Form */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Customer Details</h3>
              <div>
                <label className="block text-[10px] font-bold text-slate-650 uppercase">Mobile Number</label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765 43210"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-650 uppercase">Customer Name</label>
                <input
                  type="text"
                  placeholder="e.g. Anand Kumar"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-650 uppercase">Billing Address</label>
                <input
                  type="text"
                  placeholder="City, Pin Code"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Prescription Mandatory Gate */}
            {requiresRx && (
              <div className="space-y-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                <div className="flex gap-2 text-xs font-semibold text-rose-700">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>Prescription Gate (Schedule H/H1/X)</span>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-650 uppercase">Prescription Ref / No *</label>
                  <input
                    type="text"
                    required
                    placeholder="Doctor Reg / Slip Ref"
                    value={prescriptionRef}
                    onChange={(e) => setPrescriptionRef(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-rose-200 bg-white py-2 px-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-650 uppercase">Upload Prescription Image *</label>
                  <div className="relative mt-1 flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-4 px-3 text-slate-500 hover:border-slate-400 transition">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePrescriptionUpload}
                      disabled={isUploading}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                    <div className="flex flex-col items-center gap-1.5 text-center">
                      <Upload className="h-5 w-5 text-slate-400" />
                      <span className="text-[10px]">
                        {isUploading ? 'Uploading file...' : 'Choose image or drag here'}
                      </span>
                    </div>
                  </div>
                  {prescriptionUrl && (
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-700 font-semibold">
                      <CheckCircle className="h-4 w-4" />
                      Uploaded successfully! <a href={prescriptionUrl} target="_blank" rel="noreferrer" className="underline">View public link</a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Financial Summary */}
            <div className="space-y-3 border-t border-slate-200 pt-4 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal (estimated):</span>
                <span className="font-mono text-slate-700">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>CGST / SGST split:</span>
                <span className="font-mono text-slate-700">₹{taxAmount.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-650 uppercase">Discount (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                  className="block w-24 rounded-xl border border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-800 outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-100 pt-3">
                <span>Net Total:</span>
                <span className="font-mono text-teal-600">₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Mode */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Mode</h3>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode('cash')}
                  className={`flex flex-col items-center justify-center rounded-xl p-3 border transition cursor-pointer ${
                    paymentMode === 'cash'
                      ? 'bg-teal-50 border-teal-500 text-teal-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <DollarSign className="h-5 w-5 mb-1" />
                  <span className="text-[10px] font-semibold">Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('upi')}
                  className={`flex flex-col items-center justify-center rounded-xl p-3 border transition cursor-pointer ${
                    paymentMode === 'upi'
                      ? 'bg-teal-50 border-teal-500 text-teal-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <QrCode className="h-5 w-5 mb-1" />
                  <span className="text-[10px] font-semibold">UPI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('card')}
                  className={`flex flex-col items-center justify-center rounded-xl p-3 border transition cursor-pointer ${
                    paymentMode === 'card'
                      ? 'bg-teal-50 border-teal-500 text-teal-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <CreditCard className="h-5 w-5 mb-1" />
                  <span className="text-[10px] font-semibold">Card</span>
                </button>
              </div>
            </div>

            {/* Error alerts */}
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <div>{successMsg}</div>
                  {createdInvoiceNum && (
                    <div className="mt-1 font-bold">Invoice generated: {createdInvoiceNum}</div>
                  )}
                </div>
              </div>
            )}

             {/* Print & Action Buttons */}
            <div className="space-y-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                disabled={isPending || cart.length === 0}
                onClick={handleCheckout}
                className="flex w-full items-center justify-center rounded-xl bg-teal-600 hover:bg-teal-700 py-3 text-sm font-semibold text-white shadow-md disabled:opacity-50 transition cursor-pointer"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Allocating Stock FEFO...
                  </>
                ) : (
                  'Generate Bill & Checkout'
                )}
              </button>

              {createdInvoiceNum && lastCreatedSale && currentBranch && (
                <div className="space-y-2 pt-2 border-t border-dashed border-slate-200">
                  <InvoicePDFButton sale={lastCreatedSale} branch={currentBranch} />
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="flex w-full items-center justify-center rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 py-2.5 text-xs font-semibold text-slate-700 gap-1.5 transition cursor-pointer"
                  >
                    <Printer className="h-4 w-4 text-teal-600" />
                    Print Thermal Invoice (Ctrl+P)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple loader helper inside actions
function Loader2({ className }: { className?: string }) {
  return <div className={`animate-spin rounded-full border-2 border-slate-950 border-t-transparent ${className}`} style={{ borderTopColor: 'transparent' }} />;
}
