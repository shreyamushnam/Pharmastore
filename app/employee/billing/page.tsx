import { getPOSProducts } from '@/lib/actions/products';
import POSBillingClient from '@/components/billing/POSBillingClient';

export const dynamic = 'force-dynamic';

export default async function POSBillingPage() {
  const products = await getPOSProducts();
  return <POSBillingClient products={products as any} />;
}
