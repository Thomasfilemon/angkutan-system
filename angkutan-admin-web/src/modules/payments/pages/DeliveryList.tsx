import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { paymentsApi } from "../api";
import toast from "react-hot-toast";

interface DeliveryOrder {
  id: number;
  do_number: string;
  customer_name: string;
  item_name: string;
  final_amount: number;
  payment_status: string;
  status: string;
  completed_at: string | null;
  created_at: string;
  invoice_count: number;
  payment_count: number;
  total_paid: number;
  invoices: {
    id: number;
    invoice_number: string;
    net_amount: number;
    status: string;
  }[];
}

interface PaymentStats {
  total_amount: number;
  total_paid: number;
  total_outstanding: number;
  pending_invoices: number;
  awaiting_confirmation: number;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface Filters {
  status: string;
  customer: string;
  page: number;
}

// Update initial filters
const initialFilters: Filters = {
  status: "pending",
  customer: "",
  page: 1,
};

const DeliveryList: React.FC = () => {
  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([]);
  const navigate = useNavigate();
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters);

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<
    { id: number; invoice_number: string; net_amount: number; status: string }[]
  >([]);
  const [selectedDOId, setSelectedDOId] = useState<number | null>(null);

  useEffect(() => {
    fetchDeliveryOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.customer, filters.page]);

  const fetchDeliveryOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await paymentsApi.fetchDeliveryOrders(filters);
      const orders = response.data.data.delivery_orders;

      setDeliveryOrders(orders);
      setPagination(response.data.data.pagination);

      const calculatedStats = calculateStats(orders);
      setStats(calculatedStats);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to fetch delivery orders"
      );
      console.error("Error fetching delivery orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = useCallback(
    (orders: DeliveryOrder[]): PaymentStats => {
      return orders.reduce(
        (acc, order) => ({
          total_amount: acc.total_amount + order.final_amount,
          total_paid: acc.total_paid + order.total_paid,
          total_outstanding:
            acc.total_outstanding + (order.final_amount - order.total_paid),
          pending_invoices:
            acc.pending_invoices + (order.invoice_count === 0 ? 1 : 0),
          awaiting_confirmation:
            acc.awaiting_confirmation +
            (order.payment_status === "awaiting_confirmation" ? 1 : 0),
        }),
        {
          total_amount: 0,
          total_paid: 0,
          total_outstanding: 0,
          pending_invoices: 0,
          awaiting_confirmation: 0,
        }
      );
    },
    []
  );

  // Add index signature to avoid TS error
  const statusMap: { [key: string]: string } = {
    proses_tagihan: "bg-yellow-100 text-yellow-800",
    awaiting_confirmation: "bg-orange-100 text-orange-800",
    deposit: "bg-blue-100 text-blue-800",
    lunas: "bg-green-100 text-green-800",
  };

  const statusText: { [key: string]: string } = {
    proses_tagihan: "Process Billing",
    awaiting_confirmation: "Awaiting Confirmation",
    deposit: "Partial Payment",
    lunas: "Paid",
  };

  const getStatusBadge = (status: string) => (
    <span
      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
        statusMap[status] || "bg-gray-100 text-gray-800"
      }`}
    >
      {statusText[status] || status}
    </span>
  );

  const handleFilterChange = (key: keyof Filters, value: string | number) => {
    setFilters((prev) => {
      let newFilters = { ...prev, [key]: value };
      if (key !== "page") {
        newFilters.page = 1;
      }

      // Ensure page is always a number
      if (typeof newFilters.page !== "number") {
        newFilters.page = Number(newFilters.page) || 1;
      }
      return newFilters;
    });
  };

  const handleCreateInvoice = (doOrder: DeliveryOrder) => {
    navigate(`/payments/delivery-orders/${doOrder.id}/invoices/create`);
  };

  const handleViewInvoice = (doOrder: DeliveryOrder) => {
    if (
      doOrder.invoice_count === 1 &&
      doOrder.invoices &&
      doOrder.invoices.length === 1
    ) {
      // Langsung navigasi ke detail invoice jika hanya satu
      navigate(
        `/ritase/delivery-orders/${doOrder.id}/invoices/${doOrder.invoices[0].id}`
      );
    } else if (
      doOrder.invoice_count > 1 &&
      doOrder.invoices &&
      doOrder.invoices.length > 1
    ) {
      // Tampilkan modal pilih invoice
      setSelectedInvoices(
        doOrder.invoices.map((inv) => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          net_amount: inv.net_amount,
          status: inv.status,
        }))
      );
      setSelectedDOId(doOrder.id);
      setShowInvoiceModal(true);
    }
  };

  const handleViewDetails = (doOrder: DeliveryOrder) => {
    navigate(`/ritase/delivery-orders/${doOrder.id}/payment`);
  };

  const handleConfirmForBilling = async (doOrder: DeliveryOrder) => {
    try {
      await paymentsApi.confirmForBilling(doOrder.id, {});
      toast.success("Delivery Order confirmed for billing!");
      fetchDeliveryOrders();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          "Failed to confirm Delivery Order for billing"
      );
    }
  };

  const renderActions = (doOrder: DeliveryOrder) => {
    const actions = [];

    // Always show details
    actions.push(
      <button
        key="details"
        onClick={() => handleViewDetails(doOrder)}
        className="px-3 py-1 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
      >
        Details
      </button>
    );

    // Hanya tampilkan tombol Create Invoice jika sudah confirm for billing
    if (
      doOrder.invoice_count === 0 &&
      ["proses_tagihan", "deposit", "lunas"].includes(doOrder.payment_status)
    ) {
      actions.push(
        <button
          key="create-invoice"
          onClick={() => handleCreateInvoice(doOrder)}
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Create Invoice
        </button>
      );
    }

    // View invoices for orders with invoices
    if (
      doOrder.invoice_count > 0 &&
      doOrder.invoices &&
      doOrder.invoices.length > 0
    ) {
      actions.push(
        <button
          key="view-invoice"
          onClick={() => handleViewInvoice(doOrder)}
          className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          View Invoice{doOrder.invoice_count > 1 ? "s" : ""}
        </button>
      );
    }

    // Confirm for Billing for completed DOs that are awaiting confirmation
    if (
      doOrder.status === "completed" &&
      ["pending", "awaiting_confirmation"].includes(doOrder.payment_status)
    ) {
      actions.push(
        <button
          key="confirm-billing"
          onClick={() => handleConfirmForBilling(doOrder)}
          className="px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          Confirm for Billing
        </button>
      );
    }

    return <div className="flex flex-wrap gap-2">{actions}</div>;
  };

  const handleRetry = () => {
    setError(null);
    fetchDeliveryOrders();
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
              Delivery Orders
            </h1>
            <p className="text-gray-600 mt-2">
              Manage delivery orders awaiting payment processing
            </p>
          </div>
          <Link
            to="/payments"
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            ← Back to Overview
          </Link>
        </div>
      </div>

      {loading && !stats ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
            >
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total DOs</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {deliveryOrders.length}
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-blue-600"
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
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="text-2xl font-bold text-blue-600">
                    Rp {stats.total_amount.toLocaleString("id-ID")}
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Outstanding</p>
                  <p className="text-2xl font-bold text-red-600">
                    Rp {stats.total_outstanding.toLocaleString("id-ID")}
                  </p>
                </div>
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L12.732 4.5c-.77-.833-1.732-.833-2.5 0L2.232 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pending Invoices</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {stats.pending_invoices}
                  </p>
                </div>
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-yellow-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Awaiting Confirmation</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {stats.awaiting_confirmation}
                  </p>
                </div>
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-orange-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L12.732 4.5c-.77-.833-1.732-.833-2.5 0L2.232 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* Filters */}
      <div className="bg-white shadow-lg rounded-xl p-6 mb-8 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="pending">Pending Payment</option>
              <option value="all">All Statuses</option>
              <option value="proses_tagihan">Process Billing</option>
              <option value="awaiting_confirmation">
                Awaiting Confirmation
              </option>
              <option value="deposit">Partial Payment</option>
              <option value="lunas">Fully Paid</option>
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={fetchDeliveryOrders}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
            <button
              onClick={() => {
                setFilters(initialFilters);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Quick Stats Summary */}
        <div className="flex items-center gap-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
          <span>
            Showing {deliveryOrders.length} of {pagination.total} results
          </span>
          <span>•</span>
          <span>
            Total Amount: Rp{" "}
            {deliveryOrders
              .reduce((sum, order) => sum + order.final_amount, 0)
              .toLocaleString("id-ID")}
          </span>
          <span>•</span>
          <span>
            Outstanding: Rp{" "}
            {deliveryOrders
              .reduce(
                (sum, order) => sum + (order.final_amount - order.total_paid),
                0
              )
              .toLocaleString("id-ID")}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-red-400 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L12.732 4.5c-.77-.833-1.732-.833-2.5 0L2.232 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">
                Error Loading Data
              </h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
            <button
              onClick={handleRetry}
              className="ml-4 px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Delivery Orders Table */}
      {/* Enhanced Table */}
      <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  DO Information
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Customer & Item
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Financial
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                  Progress
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {deliveryOrders.map((doOrder) => (
                <tr
                  key={doOrder.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        {doOrder.do_number}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(doOrder.created_at).toLocaleDateString(
                          "id-ID",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </span>
                      {doOrder.completed_at && (
                        <span className="text-xs text-green-600">
                          Completed:{" "}
                          {new Date(doOrder.completed_at).toLocaleDateString(
                            "id-ID"
                          )}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        {doOrder.customer_name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {doOrder.item_name}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        Rp {doOrder.final_amount.toLocaleString("id-ID")}
                      </span>
                      {doOrder.total_paid > 0 && (
                        <span className="text-xs text-green-600">
                          Paid: Rp {doOrder.total_paid.toLocaleString("id-ID")}
                        </span>
                      )}
                      {doOrder.final_amount > doOrder.total_paid && (
                        <span className="text-xs text-red-600">
                          Outstanding: Rp{" "}
                          {(
                            doOrder.final_amount - doOrder.total_paid
                          ).toLocaleString("id-ID")}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    {getStatusBadge(doOrder.payment_status)}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-xs text-gray-600">
                          {doOrder.invoice_count} invoices
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-gray-600">
                          {doOrder.payment_count} payments
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-right">
                    {doOrder.status === "completed" ? (
                      // Original actions if completed
                      renderActions(doOrder)
                    ) : (
                      // Replacement: "Lihat DO" link/button if not completed
                      <Link
                        to={`/delivery-orders/${doOrder.id}`} // Assuming this is the view route; adjust as needed
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium transition-colors"
                        aria-label="View Delivery Order"
                      >
                        Lihat DO
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {deliveryOrders.length === 0 && !loading && (
              <tbody>
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center">
                      <svg
                        className="w-16 h-16 text-gray-300 mb-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No delivery orders found
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">
                        {filters.status !== "all" || filters.customer
                          ? "Try adjusting your filters to see more results."
                          : "No delivery orders available for payment processing."}
                      </p>
                      {(filters.status !== "all" || filters.customer) && (
                        <button
                          onClick={() => setFilters(initialFilters)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            )}
          </table>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="bg-white px-6 py-4 flex items-center justify-between border-t border-gray-200">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() =>
                    handleFilterChange("page", Math.max(1, pagination.page - 1))
                  }
                  disabled={pagination.page <= 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <button
                      onClick={() =>
                        handleFilterChange(
                          "page",
                          Math.max(1, pagination.page - 1)
                        )
                      }
                      disabled={pagination.page <= 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>

                    {Array.from(
                      { length: Math.min(pagination.pages, 5) },
                      (_, i) => {
                        const page =
                          pagination.page <= 3
                            ? i + 1
                            : pagination.page - 2 + i;
                        return (
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
                        );
                      }
                    )}

                    <button
                      onClick={() =>
                        handleFilterChange(
                          "page",
                          Math.min(pagination.pages, pagination.page + 1)
                        )
                      }
                      disabled={pagination.page >= pagination.pages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
        {showInvoiceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Select Invoice</h3>
              <ul className="divide-y divide-gray-200 mb-4">
                {selectedInvoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="py-2 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{inv.invoice_number}</div>
                      <div className="text-xs text-gray-500">
                        {inv.status} • Rp{" "}
                        {inv.net_amount.toLocaleString("id-ID")}
                      </div>
                    </div>
                    <button
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                      onClick={() => {
                        navigate(
                          `/ritase/delivery-orders/${selectedDOId}/invoices/${inv.id}`
                        );
                        setShowInvoiceModal(false);
                      }}
                    >
                      View
                    </button>
                  </li>
                ))}
              </ul>
              <button
                className="w-full py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                onClick={() => setShowInvoiceModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryList;
