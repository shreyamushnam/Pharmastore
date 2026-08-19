import { createAdminClient } from '@/lib/supabase/server';
import { getExpiryStatus } from '@/lib/utils/expiry';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // We use the Admin Client to bypass RLS for system cron updates
    const supabase = await createAdminClient();

    // 1. Check Low Stock Items
    const { data: products } = await supabase
      .from('products')
      .select('id, name, reorder_level, unit');

    const { data: summaries } = await supabase
      .from('product_stock_summary')
      .select('*');

    const resolvedProducts = products || [];
    const resolvedSummaries = summaries || [];

    let lowStockCount = 0;

    for (const p of resolvedProducts) {
      const stock = resolvedSummaries.find((s) => s.product_id === p.id)?.total_stock ?? 0;
      if (stock < p.reorder_level) {
        const message = `Alert: Product "${p.name}" is low on stock. Current level: ${stock} ${p.unit || 'units'} (Reorder threshold: ${p.reorder_level})`;

        // Check if an unread notification with the same message already exists
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('type', 'low_stock')
          .eq('message', message)
          .eq('is_read', false)
          .maybeSingle();

        if (!existing) {
          await supabase.from('notifications').insert([
            {
              type: 'low_stock',
              message,
              target_role: 'all',
            },
          ]);
          lowStockCount++;
        }
      }
    }

    // 2. Check Expiry Alerts
    const { data: batches } = await supabase
      .from('batches')
      .select('id, batch_number, expiry_date, quantity_available, products(name)')
      .gt('quantity_available', 0);

    const resolvedBatches = batches || [];
    let expiryAlertCount = 0;

    for (const b of resolvedBatches) {
      const statusInfo = getExpiryStatus(b.expiry_date);
      if (statusInfo.status === 'expired' || statusInfo.status === 'critical') {
        const productName = (b.products as any)?.name || 'Unknown Product';
        const isExpired = statusInfo.status === 'expired';
        const message = isExpired
          ? `Urgent: Batch "${b.batch_number}" of "${productName}" has EXPIRED on ${b.expiry_date}. Immediately remove from active inventory!`
          : `Warning: Batch "${b.batch_number}" of "${productName}" is nearing expiry. Expiring on ${b.expiry_date} (${statusInfo.label}).`;

        // Check if an unread notification with the same message already exists
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('type', 'expiry_alert')
          .eq('message', message)
          .eq('is_read', false)
          .maybeSingle();

        if (!existing) {
          await supabase.from('notifications').insert([
            {
              type: 'expiry_alert',
              message,
              target_role: 'all',
            },
          ]);
          expiryAlertCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      triggeredLowStockNotifications: lowStockCount,
      triggeredExpiryNotifications: expiryAlertCount,
    });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'An internal cron error occurred' },
      { status: 500 }
    );
  }
}
