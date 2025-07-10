import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { paymentsApi } from "../api";
import EditablePphCell from "../components/EditablePphCell";

interface Invoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  invoice_amount: number;
  pph_percentage: number;
  pph_amount: number;
  net_amount: number;
  status: string;
  notes: string;
  created_at: string;
  delivery_order: {
    id: number;
    do_number: string;
    customer_name: string;
    item_name: string;
    final_amount: number;
  } | null;
  payment_summary: {
    total_paid: number;
    remaining_amount: number;
    payment_count: number;
    is_fully_paid: boolean;
    is_overdue: boolean;
  };
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const InvoiceList: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: "all",
    customer: "",
    page: 1,
    sort: "created_at",
    order: "DESC",
  });

  useEffect(() => {
    fetchInvoices();
  }, [filters]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await paymentsApi.fetchInvoices(filters);
      setInvoices(response.data.data.invoices);
      setPagination(response.data.data.pagination);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch invoices");
      console.error("Error fetching invoices:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvoiceUpdate = (invoiceId: number, updatedData: any) => {
    setInvoices((prev) =>
      prev.map((invoice) =>
        invoice.id === invoiceId ? { ...invoice, ...updatedData } : invoice
      )
    );
  };

  const handleStatusUpdate = async (invoiceId: number, newStatus: string) => {
    try {
      await paymentsApi.updateInvoiceStatus(invoiceId, { status: newStatus });
      handleInvoiceUpdate(invoiceId, { status: newStatus });
    } catch (err: any) {
      console.error("Error updating status:", err);
      alert(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleExport = async (format: "excel" | "csv") => {
    try {
      const response = await paymentsApi.exportInvoices({ format, ...filters });

      if (format === "csv") {
        // For CSV, response is direct file content
        const blob = new Blob([response.data], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "invoices.csv";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // For Excel, use json data with a library (you'll need to install xlsx)
        console.log("Excel export data:", response.data.data);
        alert("Excel export will be implemented with xlsx library");
      }
    } catch (err: any) {
      console.error("Export error:", err);
      alert("Export failed");
    }
  };

  const getStatusBadge = (invoice: Invoice) => {
    let className = "inline-flex px-2 py-1 text-xs font-semibold rounded-full ";
    let text = invoice.status;

    if (invoice.payment_summary.is_overdue) {
      className += "bg-red-100 text-red-800";
      text = "Overdue";
    } else if (invoice.payment_summary.is_fully_paid) {
      className += "bg-green-100 text-green-800";
      text = "Paid";
    } else {
      switch (invoice.status) {
        case "issued":
          className += "bg-blue-100 text-blue-800";
          text = "Issued";
          break;
        case "sent":
          className += "bg-yellow-100 text-yellow-800";
          text = "Sent";
          break;
        case "paid":
          className += "bg-green-100 text-green-800";
          text = "Paid";
          break;
        case "cancelled":
          className += "bg-gray-100 text-gray-800";
          text = "Cancelled";
          break;
        default:
          className += "bg-gray-100 text-gray-800";
      }
    }

    return <span className={className}>{text}</span>;
  };

  const handleFilterChange = (key: string, value: string | number) => {
    setFilters((prev) => {
      let newPage: number;
      if (key === "page") {
        newPage = typeof value === "number" ? value : Number(value) || 1;
      } else {
        newPage = 1;
      }
      return {
        ...prev,
        [key]: value,
        page: newPage,
      };
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Invoice Management
            </h1>
            <p className="text-gray-600 mt-2">
              Manage invoices, edit PPH percentages, and track payment status
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => handleExport("csv")}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Export CSV
            </button>
            <button
              onClick={() => handleExport("excel")}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Export Excel
            </button>
            <Link
              to="/payments"
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              ← Back to Overview
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="issued">Issued</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer
            </label>
            <input
              type="text"
              value={filters.customer}
              onChange={(e) => handleFilterChange("customer", e.target.value)}
              placeholder="Search customer..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By
            </label>
            <select
              value={filters.sort}
              onChange={(e) => handleFilterChange("sort", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="created_at">Created Date</option>
              <option value="invoice_date">Invoice Date</option>
              <option value="due_date">Due Date</option>
              <option value="invoice_amount">Amount</option>
              <option value="status">Status</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchInvoices}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Invoices Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invoice Info
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer & DO
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                PPH %
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Net Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Payment
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invoices.length > 0 ? (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {invoice.invoice_number}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(invoice.invoice_date).toLocaleDateString(
                        "id-ID"
                      )}
                    </div>
                    {invoice.due_date && (
                      <div className="text-xs text-gray-400">
                        Due:{" "}
                        {new Date(invoice.due_date).toLocaleDateString("id-ID")}
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {invoice.delivery_order?.customer_name || "N/A"}
                    </div>
                    <div className="text-sm text-gray-500">
                      {invoice.delivery_order?.do_number || "N/A"}
                    </div>
                    <div className="text-xs text-gray-400">
                      {invoice.delivery_order?.item_name || "N/A"}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      Rp {invoice.invoice_amount.toLocaleString("id-ID")}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <EditablePphCell
                      invoice={invoice}
                      onUpdate={handleInvoiceUpdate}
                    />
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      Rp {invoice.net_amount.toLocaleString("id-ID")}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(invoice)}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      Rp{" "}
                      {invoice.payment_summary.total_paid.toLocaleString(
                        "id-ID"
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {invoice.payment_summary.payment_count} payments
                    </div>
                    {invoice.payment_summary.remaining_amount > 0 && (
                      <div className="text-xs text-red-600">
                        Outstanding: Rp{" "}
                        {invoice.payment_summary.remaining_amount.toLocaleString(
                          "id-ID"
                        )}
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {invoice.status !== "paid" &&
                        invoice.status !== "cancelled" && (
                          <select
                            value={invoice.status}
                            onChange={(e) =>
                              handleStatusUpdate(invoice.id, e.target.value)
                            }
                            className="text-xs border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="issued">Issued</option>
                            <option value="sent">Sent</option>
                            <option value="paid">Paid</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        )}

                      <Link
                        to={`/delivery-orders/${invoice.delivery_order?.id}`}
                        className="text-indigo-600 hover:text-indigo-900 text-xs"
                      >
                        View DO
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  <div className="flex flex-col items-center">
                    <svg
                      className="w-12 h-12 text-gray-300 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="text-lg font-medium">No invoices found</p>
                    <p className="text-sm">
                      Try adjusting your filters to see more results.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination - same as DeliveryList */}
        {pagination.pages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() =>
                  handleFilterChange("page", Math.max(1, pagination.page - 1))
                }
                disabled={pagination.page <= 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  handleFilterChange(
                    "page",
                    Math.min(pagination.pages, pagination.page + 1)
                  )
                }
                disabled={pagination.page >= pagination.pages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{" "}
                  <span className="font-medium">
                    {(pagination.page - 1) * pagination.limit + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium">
                    {Math.min(
                      pagination.page * pagination.limit,
                      pagination.total
                    )}
                  </span>{" "}
                  of <span className="font-medium">{pagination.total}</span>{" "}
                  results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  {Array.from(
                    { length: pagination.pages },
                    (_, i) => i + 1
                  ).map((page) => (
                    <button
                      key={page}
                      onClick={() => handleFilterChange("page", page)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        page === pagination.page
                          ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                          : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceList;
