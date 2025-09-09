import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { paymentsApi } from '../api';

interface InvoiceDetail {
  id: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  gross_amount: number;
  deposit_deducted: number;
  net_amount: number;
  status: string;
  notes?: string;
  group: { id: number; name: string } | null;
  topups: { id: number; amount: number; description?: string; created_at: string }[];
  payments: { id: number; amount: number; date: string; method?: string; reference_number?: string; notes?: string }[];
  total_paid: number;
  remaining_amount: number;
}

const DepositGroupInvoiceDetail: React.FC = () => {
  const { invoiceId } = useParams();
  const [data, setData] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await paymentsApi.fetchDepositGroupInvoiceDetail(Number(invoiceId));
        setData(res.data?.data || res.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch invoice');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [invoiceId]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!data) return null;

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Deposit Group Invoice</h1>
          <div className="text-sm text-gray-600">{data.group?.name || '-'}</div>
        </div>
        <button onClick={() => window.print()} className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">Print</button>
      </div>

      <div id="print-area">
      {/* Header styled like a professional invoice */}
      <div className="bg-blue-700 text-white p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="text-3xl font-extrabold tracking-wide">INVOICE</div>
          <div className="text-right text-sm">
            <div className="font-semibold">{data.group?.name || '-'}</div>
            <div>PT Angkutan Sejahtera</div>
            <div>Jl. Raya Tangerang No. 123</div>
            <div>Tangerang, Banten 15117</div>
            <div>info@angkutansejahtera.com</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <div className="text-sm text-gray-500">Invoice #</div>
          <div className="font-semibold">{data.invoice_number}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Invoice Date</div>
          <div className="font-semibold">{new Date(data.invoice_date).toLocaleDateString('id-ID')}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Due Date</div>
          <div className="font-semibold">{data.due_date ? new Date(data.due_date).toLocaleDateString('id-ID') : '-'}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Status</div>
          <div className="font-semibold">{data.status}</div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-semibold mb-2">Ringkasan</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><div className="text-sm text-gray-500">Gross</div><div className="font-semibold">{formatCurrency(data.gross_amount)}</div></div>
          <div>
            <div className="text-sm text-gray-500">Initial Deposit</div>
            <div className="font-semibold">{formatCurrency((data.topups && data.topups.length > 0) ? data.topups[0].amount : data.deposit_deducted)}</div>
          </div>
          <div><div className="text-sm text-gray-500">Net</div><div className="font-semibold">{formatCurrency(data.net_amount)}</div></div>
          <div><div className="text-sm text-gray-500">Remaining</div><div className="font-semibold text-red-600">{formatCurrency(data.remaining_amount)}</div></div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-semibold mb-2">Riwayat Top-up</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-gray-500">Tanggal</th>
              <th className="px-3 py-2 text-left text-gray-500">Keterangan</th>
              <th className="px-3 py-2 text-left text-gray-500">Jumlah</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.topups.length > 0 ? data.topups.map(t => (
              <tr key={t.id}>
                <td className="px-3 py-2">{new Date(t.created_at).toLocaleDateString('id-ID')}</td>
                <td className="px-3 py-2">{t.description || 'Top-up'}</td>
                <td className="px-3 py-2 font-medium">{formatCurrency(t.amount)}</td>
              </tr>
            )) : (
              <tr><td colSpan={3} className="px-3 py-2 text-gray-500">Tidak ada top-up</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Pembayaran</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-gray-500">Tanggal</th>
              <th className="px-3 py-2 text-left text-gray-500">Metode</th>
              <th className="px-3 py-2 text-left text-gray-500">Referensi</th>
              <th className="px-3 py-2 text-left text-gray-500">Jumlah</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.payments.length > 0 ? data.payments.map(p => (
              <tr key={p.id}>
                <td className="px-3 py-2">{new Date(p.date).toLocaleDateString('id-ID')}</td>
                <td className="px-3 py-2">{p.method || '-'}</td>
                <td className="px-3 py-2">{p.reference_number || '-'}</td>
                <td className="px-3 py-2 font-medium">{formatCurrency(p.amount)}</td>
              </tr>
            )) : (
              <tr><td colSpan={4} className="px-3 py-2 text-gray-500">Belum ada pembayaran</td></tr>
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
};

export default DepositGroupInvoiceDetail;


