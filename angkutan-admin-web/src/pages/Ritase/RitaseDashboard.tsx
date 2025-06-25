// src/pages/Ritase/RitaseDashboard.tsx
import React, { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../api/axiosConfig";

interface PurchaseOrder {
  id: number;
  po_number: string;
  customer_name: string;
  item_name: string;
  total_quantity: number;
  total_amount: number;
  order_date: string;
  status: string;
  deliveryOrders: DeliveryOrder[];
  payment_summary: {
    total_dos: number;
    completed_dos: number;
    aggregated_status:
      | "lunas"
      | "deposit"
      | "awaiting_confirmation"
      | "proses_tagihan"
      | "no_completed_do";
    lunas_count: number;
    deposit_count: number;
    awaiting_count: number;
    proses_count: number;
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
    payment_percentage: number;
  };
}

interface DeliveryOrder {
  id: number;
  do_number: string;
  status: string;
  payment_status: string;
  ongkosan: number;
  final_amount: number;
  vehicle: {
    license_plate: string;
    type: string;
  };
  driver: {
    username: string;
    driverProfile?: {
      full_name: string;
    };
  };
}

interface DashboardStats {
  total_pos: number;
  lunas_pos: number;
  deposit_pos: number;
  awaiting_pos: number;
  proses_pos: number;
  total_revenue: number;
  total_paid: number;
  total_remaining: number;
}

const RitaseDashboard: React.FC = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    period: "month",
    payment_status: "all",
    start_date: "",
    end_date: "",
  });

  const fetchRitaseData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.period !== "custom") {
        params.append("period", filters.period);
      }
      if (filters.start_date && filters.end_date) {
        params.append("start_date", filters.start_date);
        params.append("end_date", filters.end_date);
      }
      if (filters.payment_status !== "all") {
        params.append("payment_status", filters.payment_status);
      }

      const response = await apiClient.get(
        `/ritase/purchase-orders?${params.toString()}`
      );

      setPurchaseOrders(response.data.purchase_orders || []);
      setDashboardStats(response.data.dashboard_stats);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch ritase data");
      console.error("Error fetching ritase data:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchRitaseData();
  }, [fetchRitaseData]);

  const getPaymentStatusColor = (status: string) => {
    const colors = {
      lunas: "bg-green-100 text-green-800",
      deposit: "bg-yellow-100 text-yellow-800",
      awaiting_confirmation: "bg-blue-100 text-blue-800",
      proses_tagihan: "bg-gray-100 text-gray-800",
      no_completed_do: "bg-red-100 text-red-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getPaymentStatusText = (status: string) => {
    const statusMap = {
      lunas: "LUNAS",
      deposit: "DEPOSIT",
      awaiting_confirmation: "MENUNGGU KONFIRMASI",
      proses_tagihan: "PROSES TAGIHAN",
      no_completed_do: "BELUM ADA DO SELESAI",
    };
    return statusMap[status as keyof typeof statusMap] || status.toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading ritase data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Dashboard Ritase
            </h1>
            <p className="text-gray-600 mt-1">
              Kelola pembayaran Purchase Order dan Delivery Order
            </p>
          </div>
          <div className="flex space-x-3">
            {/* Period Filter */}
            <select
              value={filters.period}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, period: e.target.value }))
              }
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="week">7 Hari Terakhir</option>
              <option value="month">Bulan Ini</option>
              <option value="year">Tahun Ini</option>
            </select>

            {/* Payment Status Filter */}
            <select
              value={filters.payment_status}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  payment_status: e.target.value,
                }))
              }
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">Semua Status</option>
              <option value="lunas">Lunas</option>
              <option value="deposit">Deposit</option>
              <option value="awaiting_confirmation">Menunggu Konfirmasi</option>
              <option value="proses_tagihan">Proses Tagihan</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dashboard Stats Cards */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white shadow-md rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">PO</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Purchase Orders</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardStats.total_pos}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow-md rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">✓</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Lunas</p>
                <p className="text-2xl font-bold text-green-600">
                  {dashboardStats.lunas_pos}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow-md rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">₪</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Deposit</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {dashboardStats.deposit_pos}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow-md rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">⏳</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Menunggu</p>
                <p className="text-2xl font-bold text-blue-600">
                  {dashboardStats.awaiting_pos}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Financial Summary */}
      {dashboardStats && (
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Ringkasan Keuangan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-sm text-gray-600">Total Tagihan</label>
              <p className="text-2xl font-bold text-gray-900">
                Rp {dashboardStats.total_revenue.toLocaleString("id-ID")}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Sudah Dibayar</label>
              <p className="text-2xl font-bold text-green-600">
                Rp {dashboardStats.total_paid.toLocaleString("id-ID")}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Sisa Tagihan</label>
              <p className="text-2xl font-bold text-red-600">
                Rp {dashboardStats.total_remaining.toLocaleString("id-ID")}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progress Pembayaran</span>
              <span>
                {dashboardStats.total_revenue > 0
                  ? (
                      (dashboardStats.total_paid /
                        dashboardStats.total_revenue) *
                      100
                    ).toFixed(1)
                  : 0}
                %
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-green-600 h-3 rounded-full transition-all duration-300"
                style={{
                  width:
                    dashboardStats.total_revenue > 0
                      ? `${Math.min(
                          (dashboardStats.total_paid /
                            dashboardStats.total_revenue) *
                            100,
                          100
                        )}%`
                      : "0%",
                }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Orders List */}
      <div className="bg-white shadow-md rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Purchase Orders</h2>
          <p className="text-gray-600">
            Klik PO untuk melihat detail pembayaran dan DO
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PO Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DO Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Tagihan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sudah Dibayar
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status Pembayaran
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {purchaseOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center">
                      <svg
                        className="h-12 w-12 text-gray-400 mb-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p>Tidak ada Purchase Order ditemukan</p>
                      <p className="text-sm">
                        Coba ubah filter periode atau status pembayaran
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {po.po_number}
                        </div>
                        <div className="text-sm text-gray-500">
                          {po.item_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {po.customer_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {po.payment_summary.completed_dos}/
                        {po.payment_summary.total_dos} DO Selesai
                      </div>
                      <div className="text-xs text-gray-500">
                        {po.payment_summary.lunas_count} Lunas,{" "}
                        {po.payment_summary.deposit_count} Deposit
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        Rp{" "}
                        {po.payment_summary.total_amount.toLocaleString(
                          "id-ID"
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-green-600">
                        Rp{" "}
                        {po.payment_summary.paid_amount.toLocaleString("id-ID")}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(
                          po.payment_summary.aggregated_status
                        )}`}
                      >
                        {getPaymentStatusText(
                          po.payment_summary.aggregated_status
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-green-600 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(
                                po.payment_summary.payment_percentage,
                                100
                              )}%`,
                            }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-600">
                          {po.payment_summary.payment_percentage.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/ritase/po/${po.id}`}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RitaseDashboard;
