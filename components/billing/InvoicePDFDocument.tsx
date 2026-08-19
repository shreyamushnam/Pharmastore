import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register standard fonts
// Note: standard fonts like Helvetica are built-in and offline-safe in react-pdf
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#334155',
    backgroundColor: '#ffffff',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 15,
    marginBottom: 20,
  },
  logoSection: {
    flexDirection: 'column',
  },
  logoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0d9488', // Teal 600
  },
  tagline: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 2,
  },
  branchDetails: {
    fontSize: 8,
    color: '#475569',
    marginTop: 4,
    maxWidth: 200,
  },
  metaSection: {
    alignItems: 'flex-end',
  },
  invoiceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'right',
  },
  metaText: {
    fontSize: 8,
    color: '#475569',
    marginTop: 2,
    textAlign: 'right',
  },
  boldText: {
    fontWeight: 'bold',
    color: '#0f172a',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 4,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  billingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  billToBox: {
    flexDirection: 'column',
    width: '48%',
  },
  billByBox: {
    flexDirection: 'column',
    width: '48%',
    alignItems: 'flex-end',
  },
  infoText: {
    fontSize: 8,
    color: '#475569',
    marginTop: 3,
  },
  table: {
    flexDirection: 'column',
    marginBottom: 25,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    padding: 6,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    padding: 6,
    alignItems: 'center',
  },
  colNo: { width: '4%' },
  colItem: { width: '28%' },
  colHsn: { width: '10%', textAlign: 'center' },
  colBatch: { width: '12%', textAlign: 'center' },
  colExpiry: { width: '10%', textAlign: 'center' },
  colQty: { width: '8%', textAlign: 'center' },
  colPrice: { width: '9%', textAlign: 'right' },
  colGst: { width: '8%', textAlign: 'center' },
  colTotal: { width: '11%', textAlign: 'right' },
  
  headerCell: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#475569',
  },
  cellText: {
    fontSize: 8,
  },
  rightAlign: {
    textAlign: 'right',
  },
  centerAlign: {
    textAlign: 'center',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    paddingTop: 10,
  },
  gstBreakdownBox: {
    width: '55%',
    flexDirection: 'column',
  },
  totalsBox: {
    width: '40%',
    flexDirection: 'column',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 4,
  },
  grandTotalText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0d9488',
  },
  gstTable: {
    flexDirection: 'column',
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  gstHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    padding: 4,
  },
  gstRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    padding: 4,
  },
  gstColSlab: { width: '25%', fontSize: 7, color: '#475569' },
  gstColTaxable: { width: '25%', fontSize: 7, color: '#475569', textAlign: 'right' },
  gstColCgst: { width: '25%', fontSize: 7, color: '#475569', textAlign: 'right' },
  gstColSgst: { width: '25%', fontSize: 7, color: '#475569', textAlign: 'right' },
  
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
  },
  prescriptionLabel: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#e11d48',
    backgroundColor: '#ffe4e6',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
    marginTop: 2,
    alignSelf: 'flex-start',
  }
});

interface InvoicePDFDocumentProps {
  sale: {
    invoice_number: string;
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    created_at: string;
    subtotal: number;
    tax_amount: number;
    discount: number;
    total: number;
    payment_mode: string;
    pharmacist_name: string;
    items: Array<{
      product: {
        name: string;
        generic_name: string | null;
        hsn_code: string | null;
        requires_prescription: boolean;
        unit: string | null;
        pack_size: string | null;
      };
      quantity: number; // in base units (tablets)
      saleUnit: 'strip' | 'unit';
      packSize: number;
      allocations: Array<{
        batchNumber: string;
        expiryDate: string;
        sellingPrice: number; // strip selling price
        quantitySelected: number; // in base units (tablets)
        taxRate: number;
      }>;
    }>;
  };
  branch: {
    name: string;
    code: string;
    location: string | null;
    phone: string | null;
    drug_licence_no?: string | null;
    gstin?: string | null;
  };
}

export default function InvoicePDFDocument({ sale, branch }: InvoicePDFDocumentProps) {
  // Aggregate items into flat lines of allocated batches for rendering
  const invoiceLines: any[] = [];
  
  // Also compile GST slab summaries
  const gstSlabs: Record<number, { taxable: number; cgst: number; sgst: number }> = {};

  const customerName = sale.customer_name || (sale as any).customers?.name || 'Walk-in Customer';
  const customerPhone = sale.customer_phone || (sale as any).customers?.phone || 'N/A';
  const customerAddress = sale.customer_address || (sale as any).customers?.address || 'N/A';
  const pharmacistName = sale.pharmacist_name || (sale as any).profiles?.full_name || 'Active Staff';

  // Check if items are in the DB format
  const isDbFormat = sale.items && sale.items.length > 0 && ('batches' in sale.items[0]);

  if (isDbFormat) {
    sale.items.forEach((dbItem: any) => {
      const quantity = Number(dbItem.quantity);
      const batch = dbItem.batches;
      const product = batch?.products;
      const packSize = parseInt(product?.pack_size || '1') || 1;
      
      const isStrip = (product?.unit === 'strip' && packSize > 1 && quantity % packSize === 0);
      const displayQty = isStrip ? (quantity / packSize) : quantity;
      const displayUnit = isStrip ? 'strip' : (product?.unit || 'unit');
      const unitRate = isStrip ? (Number(dbItem.unit_price) * packSize) : Number(dbItem.unit_price);
      
      const itemTotal = quantity * Number(dbItem.unit_price);
      const taxRate = Number(product?.tax_rate || 12);
      const baseSubtotal = itemTotal / (1 + taxRate / 100);
      const taxTotal = itemTotal - baseSubtotal;

      invoiceLines.push({
        name: product?.name || 'Unknown Medicine',
        generic: product?.generic_name,
        requiresPrescription: product?.requires_prescription || false,
        hsn: product?.hsn_code || 'N/A',
        batchNumber: batch?.batch_number || 'N/A',
        expiryDate: batch?.expiry_date || 'N/A',
        quantity: displayQty,
        unit: displayUnit,
        price: unitRate,
        taxRate,
        total: itemTotal,
      });

      if (!gstSlabs[taxRate]) {
        gstSlabs[taxRate] = { taxable: 0, cgst: 0, sgst: 0 };
      }
      gstSlabs[taxRate].taxable += baseSubtotal;
      gstSlabs[taxRate].cgst += taxTotal / 2;
      gstSlabs[taxRate].sgst += taxTotal / 2;
    });
  } else {
    sale.items.forEach((item) => {
      item.allocations.forEach((alloc) => {
        const quantity = alloc.quantitySelected;
        const isLoose = item.saleUnit === 'unit';
        const packSize = item.packSize;
        
        // Calculate pricing
        const stripPrice = alloc.sellingPrice;
        const unitPrice = isLoose ? (stripPrice / packSize) : stripPrice;
        const itemQty = isLoose ? quantity : (quantity / packSize);
        
        // Totals
        const itemTotal = itemQty * stripPrice; // total paid amount for this batch line
        const baseSubtotal = itemTotal / (1 + alloc.taxRate / 100);
        const taxTotal = itemTotal - baseSubtotal;
        
        // HSN
        const hsn = item.product.hsn_code || 'N/A';
        
        invoiceLines.push({
          name: item.product.name,
          generic: item.product.generic_name,
          requiresPrescription: item.product.requires_prescription,
          hsn,
          batchNumber: alloc.batchNumber,
          expiryDate: alloc.expiryDate,
          quantity: itemQty,
          unit: isLoose ? 'tab/cap' : (item.product.unit || 'strip'),
          price: unitPrice,
          taxRate: alloc.taxRate,
          total: itemTotal,
        });

        // Aggregate GST slab
        const slab = alloc.taxRate;
        if (!gstSlabs[slab]) {
          gstSlabs[slab] = { taxable: 0, cgst: 0, sgst: 0 };
        }
        gstSlabs[slab].taxable += baseSubtotal;
        gstSlabs[slab].cgst += taxTotal / 2;
        gstSlabs[slab].sgst += taxTotal / 2;
      });
    });
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER SECTION */}
        <View style={styles.headerContainer}>
          <View style={styles.logoSection}>
            <Text style={styles.logoText}>{branch.name}</Text>
            <Text style={styles.tagline}>Licensed Pharmacy POS Invoice</Text>
            <Text style={styles.branchDetails}>
              Address: {branch.location || 'N/A'}{'\n'}
              Phone: {branch.phone || 'N/A'}{'\n'}
              DL No: {branch.drug_licence_no || 'N/A'}{'\n'}
              GSTIN: {branch.gstin || 'N/A'}
            </Text>
          </View>
          
          <View style={styles.metaSection}>
            <Text style={styles.invoiceTitle}>TAX INVOICE</Text>
            <Text style={styles.metaText}>
              <Text style={styles.boldText}>Invoice No: </Text>{sale.invoice_number}
            </Text>
            <Text style={styles.metaText}>
              <Text style={styles.boldText}>Date: </Text>{new Date(sale.created_at).toLocaleString()}
            </Text>
            <Text style={styles.metaText}>
              <Text style={styles.boldText}>Payment: </Text>{sale.payment_mode.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* BILLING SECTION */}
        <View style={styles.billingSection}>
          <View style={styles.billToBox}>
            <Text style={styles.sectionTitle}>Bill To (Customer)</Text>
            <Text style={styles.infoText}>
              <Text style={styles.boldText}>Name: </Text>{customerName}
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.boldText}>Phone: </Text>{customerPhone}
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.boldText}>Address: </Text>{customerAddress}
            </Text>
          </View>
          
          <View style={styles.billByBox}>
            <Text style={styles.sectionTitle}>Billed By</Text>
            <Text style={styles.infoText}>
              <Text style={styles.boldText}>Pharmacist: </Text>{pharmacistName}
            </Text>
            <Text style={styles.infoText}>
              <Text style={styles.boldText}>Branch Code: </Text>{branch.code}
            </Text>
          </View>
        </View>

        {/* ITEMS TABLE */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.colNo, styles.headerCell]}>S.N</Text>
            <Text style={[styles.colItem, styles.headerCell]}>Medicine Description</Text>
            <Text style={[styles.colHsn, styles.headerCell, styles.centerAlign]}>HSN</Text>
            <Text style={[styles.colBatch, styles.headerCell, styles.centerAlign]}>Batch</Text>
            <Text style={[styles.colExpiry, styles.headerCell, styles.centerAlign]}>Expiry</Text>
            <Text style={[styles.colQty, styles.headerCell, styles.centerAlign]}>Qty</Text>
            <Text style={[styles.colPrice, styles.headerCell, styles.rightAlign]}>Rate</Text>
            <Text style={[styles.colGst, styles.headerCell, styles.centerAlign]}>GST</Text>
            <Text style={[styles.colTotal, styles.headerCell, styles.rightAlign]}>Total</Text>
          </View>

          {/* Table Rows */}
          {invoiceLines.map((line, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={[styles.colNo, styles.cellText]}>{idx + 1}</Text>
              <View style={styles.colItem}>
                <Text style={[styles.cellText, styles.boldText]}>{line.name}</Text>
                {line.generic && (
                  <Text style={{ fontSize: 6, color: '#64748b', marginTop: 1 }}>{line.generic}</Text>
                )}
                {line.requiresPrescription && (
                  <Text style={styles.prescriptionLabel}>Rx Schedule H</Text>
                )}
              </View>
              <Text style={[styles.colHsn, styles.cellText, styles.centerAlign]}>{line.hsn}</Text>
              <Text style={[styles.colBatch, styles.cellText, styles.centerAlign, { fontFamily: 'Courier' }]}>{line.batchNumber}</Text>
              <Text style={[styles.colExpiry, styles.cellText, styles.centerAlign]}>{line.expiryDate}</Text>
              <Text style={[styles.colQty, styles.cellText, styles.centerAlign]}>
                {line.quantity} {line.unit}
              </Text>
              <Text style={[styles.colPrice, styles.cellText, styles.rightAlign, { fontFamily: 'Courier' }]}>
                {line.price.toFixed(2)}
              </Text>
              <Text style={[styles.colGst, styles.cellText, styles.centerAlign]}>{line.taxRate}%</Text>
              <Text style={[styles.colTotal, styles.cellText, styles.rightAlign, { fontFamily: 'Courier', fontWeight: 'bold' }]}>
                {line.total.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* GST BREAKDOWN & GRAND TOTALS */}
        <View style={styles.summaryContainer}>
          {/* GST Slabs Summary Table */}
          <View style={styles.gstBreakdownBox}>
            <Text style={[styles.sectionTitle, { fontSize: 8 }]}>GST Taxation Breakup</Text>
            <View style={styles.gstTable}>
              <View style={styles.gstHeader}>
                <Text style={styles.gstColSlab}>GST Slabs</Text>
                <Text style={styles.gstColTaxable}>Taxable Amt</Text>
                <Text style={styles.gstColCgst}>CGST Amt</Text>
                <Text style={styles.gstColSgst}>SGST Amt</Text>
              </View>
              {Object.keys(gstSlabs).map((rateStr) => {
                const rate = Number(rateStr);
                const data = gstSlabs[rate];
                return (
                  <View key={rate} style={styles.gstRow}>
                    <Text style={styles.gstColSlab}>GST {rate}% (CGST 6% / SGST 6%)</Text>
                    <Text style={styles.gstColTaxable}>{data.taxable.toFixed(2)}</Text>
                    <Text style={styles.gstColCgst}>{data.cgst.toFixed(2)}</Text>
                    <Text style={styles.gstColSgst}>{data.sgst.toFixed(2)}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Totals Summary */}
          <View style={styles.totalsBox}>
            <Text style={[styles.sectionTitle, { fontSize: 8, textAlign: 'right' }]}>Amount Details</Text>
            <View style={styles.totalRow}>
              <Text style={styles.infoText}>Taxable Subtotal:</Text>
              <Text style={[styles.infoText, { fontFamily: 'Courier' }]}>INR {sale.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.infoText}>CGST + SGST tax:</Text>
              <Text style={[styles.infoText, { fontFamily: 'Courier' }]}>INR {sale.tax_amount.toFixed(2)}</Text>
            </View>
            {sale.discount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.infoText}>Discount Applied:</Text>
                <Text style={[styles.infoText, { fontFamily: 'Courier', color: '#e11d48' }]}>- INR {sale.discount.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.grandTotalRow}>
              <Text style={[styles.grandTotalText]}>Net Paid Amount:</Text>
              <Text style={[styles.grandTotalText, { fontFamily: 'Courier' }]}>INR {sale.total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Thank you for shopping! Get well soon.{'\n'}
            * This is a computer-generated GST-compliant invoice. No signature required. *
          </Text>
        </View>
      </Page>
    </Document>
  );
}
