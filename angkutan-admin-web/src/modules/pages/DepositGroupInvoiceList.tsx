import React, { useEffect, useState } from "react";
import { paymentsApi } from "../payments/api";
import toast from "react-hot-toast";

interface DGInvoice {
  id: number;
  invoice_number: string;
  group: { id: number; name: string } | null;
  invoice_date: string;
  due_date: string;
  gross_amount: number;
  deposit_deducted: number;
  net_amount: number;
  status: string;
  notes?: string;
  total_paid: number;
  remaining_amount: number;
  topups?: { id: number; amount: number; description?: string; created_at: string }[];
}

const DepositGroupInvoiceList: React.FC = () => {
  const [invoices, setInvoices] = useState<DGInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ status: "all", page: 1, limit: 20 });

  useEffect(() => {
    fetchInvoices();
  }, [filters]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await paymentsApi.fetchDepositGroupInvoices(filters as any);
      setInvoices(res.data?.data?.invoices || res.data?.invoices || []);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch invoices");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount || 0);

  const handlePay = async (invoiceId: number, remaining: number) => {
    const input = window.prompt("Masukkan jumlah pembayaran (Rp)", String(remaining));
    if (input === null) return;
    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Jumlah tidak valid");
      return;
    }
    try {
      await paymentsApi.recordDepositGroupPayment(invoiceId, { payment_amount: amount });
      toast.success("Pembayaran dicatat");
      fetchInvoices();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal mencatat pembayaran");
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Deposit Group Invoices</h1>
        <div className="space-x-2">
          <select
            className="border rounded px-2 py-1 text-sm"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="all">All</option>
            <option value="issued">Issued</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {error && <div className="text-red-600 mb-3 text-sm">{error}</div>}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="overflow-x-auto bg-white rounded shadow">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Group</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Gross</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Deposit</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Net</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Top-ups</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">
                    <a href={`/payments/deposit-groups/invoices/${inv.id}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{inv.invoice_number}</a>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">{inv.group?.name || "-"}</td>
                  <td className="px-4 py-2 text-sm">{formatCurrency(inv.gross_amount)}</td>
                  <td className="px-4 py-2 text-sm">{formatCurrency(inv.deposit_deducted)}</td>
                  <td className="px-4 py-2 text-sm">{formatCurrency(inv.net_amount)}</td>
                  <td className="px-4 py-2 text-sm">{formatCurrency(inv.total_paid)}</td>
                  <td className="px-4 py-2 text-sm font-semibold">{formatCurrency(inv.remaining_amount)}</td>
                  <td className="px-4 py-2 text-xs">
                    <span className={`px-2 py-1 rounded-full ${inv.status === 'paid' ? 'bg-green-100 text-green-800' : inv.status === 'issued' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{inv.status}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {inv.topups && inv.topups.length > 0 ? (
                      <div className="space-y-1">
                        {inv.topups.map(t => (
                          <div key={t.id} className="flex items-center justify-between">
                            <span>{new Date(t.created_at).toLocaleDateString('id-ID')}</span>
                            <span className="ml-2">{t.description || 'Top-up'}</span>
                            <span className="ml-2 font-medium">{formatCurrency(t.amount)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-sm">
                    <div className="inline-flex gap-2">
                      <a
                        href={`/payments/deposit-groups/invoices/${inv.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        View / Print
                      </a>
                      <button
                        onClick={() => handlePay(inv.id, inv.remaining_amount)}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        disabled={inv.remaining_amount <= 0}
                      >
                        Pay
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500 text-sm">No invoices found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DepositGroupInvoiceList;


