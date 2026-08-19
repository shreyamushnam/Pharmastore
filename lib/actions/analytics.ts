'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/actions/auth';
import { hasAdminRole } from '@/lib/roles';

export async function getAnalyticsSummary() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasAdminRole(currentUser)) {
      throw new Error('Unauthorized: Admin access required');
    }

    const supabase = await createClient();

    // 1. Fetch active batches for Stock Valuation & Expiry Losses
    const { data: batches, error: batchError } = await supabase
      .from('batches')
      .select('*, products(name, tax_rate)');

    if (batchError) throw batchError;
    const resolvedBatches = batches || [];

    let totalCostValuation = 0;
    let totalMRPValuation = 0;
    let totalSellingValuation = 0;
    let projectedTaxLiability = 0;

    let expiredLossCost = 0;
    let expiredLossMRP = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    resolvedBatches.forEach((b) => {
      const qty = b.quantity_available;
      const isExpired = b.expiry_date < todayStr;

      if (qty > 0) {
        const cost = qty * Number(b.purchase_price);
        const mrp = qty * Number(b.mrp);
        const sell = qty * Number(b.selling_price);
        const taxRate = Number(b.products?.tax_rate ?? 12);
        const tax = sell * (taxRate / 100);

        if (isExpired) {
          expiredLossCost += cost;
          expiredLossMRP += mrp;
        } else {
          totalCostValuation += cost;
          totalMRPValuation += mrp;
          totalSellingValuation += sell;
          projectedTaxLiability += tax;
        }
      }
    });

    const marginValue = totalSellingValuation - totalCostValuation;
    const marginPercent = totalSellingValuation > 0 ? (marginValue / totalSellingValuation) * 100 : 0;

    // 2. Fetch sales from the last 30 days for Sales Trends & Payment Modes
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .gte('created_at', thirtyDaysAgoStr)
      .order('created_at', { ascending: true });

    if (salesError) throw salesError;
    const resolvedSales = sales || [];

    // Daily Sales Aggregation
    const dailySalesMap: { [key: string]: number } = {};
    // Pre-populate last 7 days to make sure the chart is filled
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailySalesMap[dateStr] = 0;
    }

    resolvedSales.forEach((s) => {
      const dateStr = new Date(s.created_at).toISOString().split('T')[0];
      if (dailySalesMap[dateStr] !== undefined) {
        dailySalesMap[dateStr] += Number(s.total);
      } else {
        dailySalesMap[dateStr] = Number(s.total);
      }
    });

    const dailyTrends = Object.entries(dailySalesMap).map(([date, total]) => ({
      date: date.substring(5), // MM-DD
      total,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Payment Mode Distribution
    let cashSales = 0;
    let cardSales = 0;
    let upiSales = 0;

    resolvedSales.forEach((s) => {
      const amt = Number(s.total);
      if (s.payment_mode === 'cash') cashSales += amt;
      else if (s.payment_mode === 'card') cardSales += amt;
      else if (s.payment_mode === 'upi') upiSales += amt;
    });

    // 3. Fetch Top Selling Products
    // Query sale items with their product name relations
    const { data: saleItems, error: itemsError } = await supabase
      .from('sale_items')
      .select('quantity, unit_price, batches(products(name))')
      .order('quantity', { ascending: false });

    if (itemsError) throw itemsError;
    const resolvedItems = saleItems || [];

    const productSalesMap: { [key: string]: { quantity: number; revenue: number } } = {};
    resolvedItems.forEach((item) => {
      const productName = (item.batches as any)?.products?.name || 'Unknown Medicine';
      const qty = item.quantity;
      const rev = qty * Number(item.unit_price);

      if (!productSalesMap[productName]) {
        productSalesMap[productName] = { quantity: 0, revenue: 0 };
      }
      productSalesMap[productName].quantity += qty;
      productSalesMap[productName].revenue += rev;
    });

    const topSelling = Object.entries(productSalesMap)
      .map(([name, data]) => ({
        name,
        quantity: data.quantity,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // 4. Fetch Distributor Returns (Credits Recovered)
    const { data: returns, error: returnError } = await supabase
      .from('stock_movements')
      .select('quantity, batches(purchase_price)')
      .eq('movement_type', 'return')
      .gte('created_at', thirtyDaysAgoStr);

    if (returnError) throw returnError;
    const resolvedReturns = returns || [];

    let totalReturnsValuation = 0;
    resolvedReturns.forEach((r) => {
      const qty = Math.abs(r.quantity); // returns are logged as negative
      const purchasePrice = Number((r.batches as any)?.purchase_price ?? 0);
      totalReturnsValuation += qty * purchasePrice;
    });

    return {
      stockValuation: {
        cost: totalCostValuation,
        mrp: totalMRPValuation,
        selling: totalSellingValuation,
        marginVal: marginValue,
        marginPercent,
        projectedTax: projectedTaxLiability,
      },
      expiryLoss: {
        cost: expiredLossCost,
        mrp: expiredLossMRP,
      },
      supplierReturnsCredits: totalReturnsValuation,
      dailyTrends,
      paymentMode: {
        cash: cashSales,
        card: cardSales,
        upi: upiSales,
      },
      topSelling,
    };
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return null;
  }
}
