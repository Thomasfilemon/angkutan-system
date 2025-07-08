import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { paymentsApi } from "../api";

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

const initialFilters: Filters = {
  status: "pending",
  customer: "",
  page: 1,
};

const DeliveryList: React.FC = () => {
  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters);

  useEffect(() => {
    fetchDeliveryOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.customer, filters.page]);

  const fetchDeliveryOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await paymentsApi.fetchDeliveryOrders(filters);
      setDeliveryOrders(response.data.data.delivery_orders);
      setPagination(response.data.data.pagination);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to fetch delivery orders"
      );
      console.error("Error fetching delivery orders:", err);
    } finally {
      setLoading(false);
    }
  };

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

  // Ensure page is always a number
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

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="pending">Pending Payment</option>
              <option value="all">All Statuses</option>
              <option value="proses_tagihan">Process Billing</option>
              <option value="awaiting_confirmation">
                Awaiting Confirmation
              </option>
              <option value="deposit">Partial Payment</option>
              <option value="lunas">Paid</option>
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

          <div className="flex items-end">
            <button
              onClick={fetchDeliveryOrders}
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

      {/* Delivery Orders Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                DO Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer & Item
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Progress
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {deliveryOrders.length > 0 ? (
              deliveryOrders.map((doOrder) => (
                <tr key={doOrder.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {doOrder.do_number}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(doOrder.created_at).toLocaleDateString("id-ID")}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {doOrder.customer_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {doOrder.item_name}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      Rp {doOrder.final_amount.toLocaleString("id-ID")}
                    </div>
                    {doOrder.total_paid > 0 && (
                      <div className="text-sm text-green-600">
                        Paid: Rp {doOrder.total_paid.toLocaleString("id-ID")}
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(doOrder.payment_status)}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        {doOrder.invoice_count} invoices
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="text-sm text-gray-500">
                        {doOrder.payment_count} payments
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <Link
                        to={`/delivery-orders/${doOrder.id}`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        View Details
                      </Link>

                      {doOrder.payment_status === "proses_tagihan" && (
                        <button className="text-green-600 hover:text-green-900">
                          Create Invoice
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
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
                        d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <p className="text-lg font-medium">
                      No delivery orders found
                    </p>
                    <p className="text-sm">
                      Try adjusting your filters to see more results.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
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

export default DeliveryList;
