'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { FileText } from 'lucide-react';

// Dynamically import PDFDownloadLink and InvoicePDFDocument to prevent Next.js SSR build errors
const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);

const InvoicePDFDocument = dynamic(
  () => import('./InvoicePDFDocument'),
  { ssr: false }
);

interface InvoicePDFButtonProps {
  sale: any;
  branch: any;
}

export default function InvoicePDFButton({ sale, branch }: InvoicePDFButtonProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <button 
        type="button"
        disabled
        className="flex w-full items-center justify-center rounded-xl bg-slate-100 border border-slate-200 py-2.5 text-xs font-semibold text-slate-400 gap-1.5"
      >
        <FileText className="h-4 w-4" />
        Preparing A4 Invoice...
      </button>
    );
  }

  return (
    <div className="w-full">
      <PDFDownloadLink
        document={<InvoicePDFDocument sale={sale} branch={branch} />}
        fileName={`Invoice-${sale.invoice_number}.pdf`}
        style={{ textDecoration: 'none' }}
      >
        {({ blob, url, loading, error }: any) => (
          <button
            type="button"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 py-2.5 text-xs font-semibold text-teal-700 gap-1.5 transition cursor-pointer"
          >
            <FileText className="h-4 w-4 text-teal-600" />
            {loading ? 'Generating PDF...' : 'Download A4 PDF Invoice'}
          </button>
        )}
      </PDFDownloadLink>
    </div>
  );
}
