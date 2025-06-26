// src/pages/Ritase/RitaseDashboard.tsx
import React, { useState, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import apiClient from "../../api/axiosConfig";

const safeNumber = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined || isNaN(Number(value))) return 0;
  return Number(value) || 0;
};

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
  quantity_progress: QuantityProgress;
}

interface DeliveryOrder {
  id: number;
  do_number: string;
  status: string;
  payment_status: string;
  minimal_load_quantity: string | number;
  actual_load_quantity?: string | number;
  ongkosan: string | number;
  final_amount: string | number;

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

interface QuantityProgress {
  total_quantity: number;
  delivered_quantity: number;
  remaining_quantity: number;
  delivery_percentage: number;
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
  const navigate = useNavigate();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [expandedPO, setExpandedPO] = useState<number | null>(null);
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

  const togglePOExpansion = (poId: number) => {
    setExpandedPO(expandedPO === poId ? null : poId);
  };

  const getDeliveryStatusColor = (status: string) => {
    const colors = {
      assigned: "bg-gray-100 text-gray-800",
      otw_to_load_location: "bg-blue-100 text-blue-800",
      at_load_location: "bg-yellow-100 text-yellow-800",
      otw_to_unload_location: "bg-orange-100 text-orange-800",
      at_unload_location: "bg-purple-100 text-purple-800",
      otw_to_base: "bg-indigo-100 text-indigo-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getDeliveryStatusText = (status: string) => {
    const statusMap = {
      assigned: "Ditugaskan",
      otw_to_load_location: "Menuju Lokasi Muat",
      at_load_location: "Di Lokasi Muat",
      otw_to_unload_location: "Menuju Lokasi Bongkar",
      at_unload_location: "Di Lokasi Bongkar",
      otw_to_base: "Perjalanan Pulang",
      completed: "Selesai",
      cancelled: "Dibatalkan",
    };
    return statusMap[status as keyof typeof statusMap] || status;
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
            <h1 className="text-2xl font-bold text-gray-900">Ritase</h1>
            <p className="text-gray-600 mt-1">
              Kelola pembayaran Purchase Order dan Delivery Order
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => navigate(`/ritase/comprehensive`)}
              className="flex items-center space-x-2 bg-gray/15 hover:bg-gray/25 px-4 py-2 rounded-lg transition-all duration-200 border border-gray/20 hover:border-black/30"
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
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 0V17"
                />
              </svg>
              <span className="text-sm text-black font-medium">Table View</span>
            </button>
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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Ringkasan Keuangan & Pengiriman
            </h2>
            <div className="flex space-x-2 text-sm text-gray-600">
              <span>💰 Financial</span>
              <span>|</span>
              <span>📦 Quantity</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Financial Summary */}
            <div>
              <h3 className="text-lg font-medium mb-4 text-gray-800">
                Financial Progress
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600">
                    Total Tagihan (Calculated)
                  </label>
                  <p className="text-xl font-bold text-gray-900">
                    Rp {dashboardStats.total_revenue.toLocaleString("id-ID")}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Sudah Dibayar</label>
                  <p className="text-xl font-bold text-green-600">
                    Rp{" "}
                    {Math.min(
                      dashboardStats.total_paid,
                      dashboardStats.total_revenue
                    ).toLocaleString("id-ID")}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Sisa Tagihan</label>
                  <p className="text-xl font-bold text-red-600">
                    Rp{" "}
                    {Math.max(dashboardStats.total_remaining, 0).toLocaleString(
                      "id-ID"
                    )}
                  </p>
                </div>

                {/* ✅ NEW: Payment Variance Display */}
                {dashboardStats.total_paid - dashboardStats.total_revenue !==
                  0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <label className="text-sm font-medium text-yellow-800">
                      Selisih Pembayaran
                    </label>
                    <p
                      className={`text-lg font-bold ${
                        dashboardStats.total_paid -
                          dashboardStats.total_revenue >
                        0
                          ? "text-blue-600"
                          : "text-red-600"
                      }`}
                    >
                      {dashboardStats.total_paid -
                        dashboardStats.total_revenue >
                      0
                        ? "+"
                        : ""}
                      Rp{" "}
                      {Math.abs(
                        dashboardStats.total_paid - dashboardStats.total_revenue
                      ).toLocaleString("id-ID")}
                    </p>
                    <p className="text-xs text-yellow-600">
                      {dashboardStats.total_paid -
                        dashboardStats.total_revenue >
                      0
                        ? "Kelebihan pembayaran dari customer"
                        : "Kekurangan pembayaran dari customer"}
                    </p>
                  </div>
                )}
              </div>

              {/* ✅ Enhanced Progress Bar (Max 100%) */}
              <div className="mt-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Progress Pembayaran</span>
                  <span>
                    {dashboardStats?.total_revenue > 0
                      ? Math.min(
                          (Math.min(
                            dashboardStats.total_paid || 0,
                            dashboardStats.total_revenue
                          ) /
                            dashboardStats.total_revenue) *
                            100,
                          100
                        ).toFixed(1)
                      : "0.0"}
                    %
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-600 h-3 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        dashboardStats.total_revenue > 0
                          ? (Math.min(
                              dashboardStats.total_paid,
                              dashboardStats.total_revenue
                            ) /
                              dashboardStats.total_revenue) *
                              100
                          : 0,
                        100
                      )}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* ✅ NEW: Quantity Summary */}
            <div>
              <h3 className="text-lg font-medium mb-4 text-gray-800">
                Delivery Progress
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600">Total Target</label>
                  <p className="text-xl font-bold text-gray-900">
                    {purchaseOrders
                      .reduce(
                        (sum, po) =>
                          sum + (po.quantity_progress?.total_quantity || 0),
                        0
                      )
                      .toLocaleString("id-ID")}{" "}
                    Ton
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Sudah Dikirim</label>
                  <p className="text-xl font-bold text-blue-600">
                    {purchaseOrders
                      .reduce(
                        (sum, po) =>
                          sum + (po.quantity_progress?.delivered_quantity || 0),
                        0
                      )
                      .toLocaleString("id-ID")}{" "}
                    Ton
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Sisa Target</label>
                  <p className="text-xl font-bold text-orange-600">
                    {purchaseOrders
                      .reduce(
                        (sum, po) =>
                          sum + (po.quantity_progress?.remaining_quantity || 0),
                        0
                      )
                      .toLocaleString("id-ID")}{" "}
                    Ton
                  </p>
                </div>
              </div>

              {/* Quantity Progress Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Progress Pengiriman</span>
                  <span>
                    {(() => {
                      const totalTarget = purchaseOrders.reduce(
                        (sum, po) =>
                          sum + (po.quantity_progress?.total_quantity || 0),
                        0
                      );
                      const totalDelivered = purchaseOrders.reduce(
                        (sum, po) =>
                          sum + (po.quantity_progress?.delivered_quantity || 0),
                        0
                      );
                      return totalTarget > 0
                        ? ((totalDelivered / totalTarget) * 100).toFixed(1)
                        : 0;
                    })()}
                    %
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{
                      width: (() => {
                        const totalTarget = purchaseOrders.reduce(
                          (sum, po) =>
                            sum + (po.quantity_progress?.total_quantity || 0),
                          0
                        );
                        const totalDelivered = purchaseOrders.reduce(
                          (sum, po) =>
                            sum +
                            (po.quantity_progress?.delivered_quantity || 0),
                          0
                        );
                        return totalTarget > 0
                          ? `${Math.min(
                              (totalDelivered / totalTarget) * 100,
                              100
                            )}%`
                          : "0%";
                      })(),
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Enhanced Purchase Orders List with Quantity Progress and Expandable DOs */}
      <div className="bg-white shadow-md rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Purchase Orders</h2>
          <p className="text-gray-600">
            Klik PO untuk melihat detail pembayaran dan DO. Klik ▼ untuk expand
            DO list.
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
                  Quantity Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  DO Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Financial Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status Pembayaran
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
                    colSpan={7}
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
                  <React.Fragment key={po.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <button
                            onClick={() => togglePOExpansion(po.id)}
                            className="mr-3 p-1 rounded hover:bg-gray-100"
                          >
                            <svg
                              className={`h-4 w-4 text-gray-500 transition-transform ${
                                expandedPO === po.id ? "rotate-90" : ""
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </button>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {po.po_number}
                            </div>
                            <div className="text-sm text-gray-500">
                              {po.item_name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {po.customer_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {/* ✅ NEW: Quantity Progress */}
                        <div className="space-y-1">
                          <div className="text-sm text-gray-900">
                            {(
                              po.quantity_progress?.delivered_quantity || 0
                            ).toLocaleString("id-ID")}{" "}
                            /{" "}
                            {(
                              po.quantity_progress?.total_quantity || 0
                            ).toLocaleString("id-ID")}{" "}
                            Ton
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(
                                  po.quantity_progress?.delivery_percentage ||
                                    0,
                                  100
                                )}%`,
                              }}
                            ></div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {(
                              po.quantity_progress?.delivery_percentage || 0
                            ).toFixed(1)}
                            % delivered
                          </div>
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
                        <div className="space-y-1">
                          <div className="text-sm text-gray-900">
                            Rp{" "}
                            {po.payment_summary.paid_amount.toLocaleString(
                              "id-ID"
                            )}{" "}
                            / Rp{" "}
                            {po.payment_summary.total_amount.toLocaleString(
                              "id-ID"
                            )}
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
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
                          <div className="text-xs text-gray-500">
                            {po.payment_summary.payment_percentage.toFixed(1)}%
                            paid
                          </div>
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
                        <Link
                          to={`/ritase/po/${po.id}`}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Detail Payment
                        </Link>
                      </td>
                    </tr>
                    {/* ✅ NEW: Expandable DO List */}
                    {/* ✅ ENHANCED: Horizontal Scrolling DO List */}
                    {expandedPO === po.id && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <h4 className="font-medium text-gray-900">
                                Delivery Orders untuk {po.po_number}
                              </h4>
                              <div className="flex items-center space-x-4 text-sm text-gray-600">
                                <span>
                                  📦 {po.deliveryOrders.length} DO total
                                </span>
                                <span>
                                  ✅{" "}
                                  {
                                    po.deliveryOrders.filter(
                                      (d) => d.status === "completed"
                                    ).length
                                  }{" "}
                                  completed
                                </span>
                                <span>
                                  📊{" "}
                                  {(
                                    po.quantity_progress?.delivery_percentage ||
                                    0
                                  ).toFixed(1)}
                                  % delivered
                                </span>
                              </div>
                            </div>

                            {/* ✅ Horizontal Scrolling Container */}
                            {po.deliveryOrders.length > 0 ? (
                              <div className="overflow-x-auto pb-4">
                                <div
                                  className="flex space-x-4 pb-2"
                                  style={{ minWidth: "max-content" }}
                                >
                                  {po.deliveryOrders.map((do_item) => (
                                    <Link
                                      key={do_item.id}
                                      to={`/delivery-orders/${do_item.id}`}
                                      className="flex-shrink-0 w-80 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 group"
                                    >
                                      <div className="space-y-3">
                                        {/* Header dengan Status */}
                                        <div className="flex justify-between items-start">
                                          <div>
                                            <h5 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                              {do_item.do_number}
                                            </h5>
                                            <p className="text-sm text-gray-600 flex items-center">
                                              <svg
                                                className="h-4 w-4 mr-1"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V9a2 2 0 01-2 2H8m0 0v2m0-2h2m6 4h2"
                                                />
                                              </svg>
                                              {do_item.vehicle?.license_plate}
                                            </p>
                                          </div>
                                          <span
                                            className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getDeliveryStatusColor(
                                              do_item.status
                                            )}`}
                                          >
                                            {getDeliveryStatusText(
                                              do_item.status
                                            )}
                                          </span>
                                        </div>

                                        {/* ✅ Quantity Information Card */}
                                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                          <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                              <span className="text-blue-600 font-medium">
                                                Target:
                                              </span>
                                              <div className="font-bold text-gray-900">
                                                {parseFloat(
                                                  String(
                                                    do_item.minimal_load_quantity
                                                  )
                                                ).toLocaleString("id-ID")}{" "}
                                                Ton
                                              </div>
                                            </div>
                                            <div>
                                              <span className="text-blue-600 font-medium">
                                                Actual:
                                              </span>
                                              <div className="font-bold text-green-600">
                                                {do_item.actual_load_quantity
                                                  ? `${parseFloat(
                                                      String(
                                                        do_item.actual_load_quantity
                                                      )
                                                    ).toLocaleString(
                                                      "id-ID"
                                                    )} Ton`
                                                  : "Pending"}
                                              </div>
                                            </div>
                                          </div>

                                          {/* ✅ Quantity Progress Bar */}
                                          {do_item.actual_load_quantity && (
                                            <div className="mt-3">
                                              <div className="flex justify-between text-xs text-blue-600 mb-1">
                                                <span>Load Efficiency</span>
                                                <span>
                                                  {(() => {
                                                    // ✅ Safe number conversion
                                                    const actualQty = Number(
                                                      do_item.actual_load_quantity
                                                    );
                                                    const minimalQty = Number(
                                                      do_item.minimal_load_quantity
                                                    );
                                                    const efficiency =
                                                      (actualQty / minimalQty) *
                                                      100;
                                                    return efficiency.toFixed(
                                                      1
                                                    );
                                                  })()}
                                                  %
                                                </span>
                                              </div>
                                              <div className="w-full bg-blue-200 rounded-full h-2">
                                                <div
                                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                  style={{
                                                    width: `${Math.min(
                                                      (Number(
                                                        do_item.actual_load_quantity
                                                      ) /
                                                        Number(
                                                          do_item.minimal_load_quantity
                                                        )) *
                                                        100,
                                                      100
                                                    )}%`,
                                                  }}
                                                ></div>
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                        {/* Driver & Vehicle Info */}
                                        <div className="space-y-2 text-sm">
                                          <div className="flex items-center justify-between">
                                            <span className="text-gray-600 flex items-center">
                                              <svg
                                                className="h-4 w-4 mr-1"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                                />
                                              </svg>
                                              Driver:
                                            </span>
                                            <span className="font-medium text-gray-900">
                                              {do_item.driver?.driverProfile
                                                ?.full_name ||
                                                do_item.driver?.username ||
                                                "N/A"}
                                            </span>
                                          </div>

                                          <div className="flex items-center justify-between">
                                            <span className="text-gray-600 flex items-center">
                                              <svg
                                                className="h-4 w-4 mr-1"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                                                />
                                              </svg>
                                              Payment:
                                            </span>
                                            <span
                                              className={`font-medium px-2 py-1 rounded text-xs ${getPaymentStatusColor(
                                                do_item.payment_status
                                              )}`}
                                            >
                                              {getPaymentStatusText(
                                                do_item.payment_status
                                              )}
                                            </span>
                                          </div>

                                          <div className="flex items-center justify-between">
                                            <span className="text-gray-600 flex items-center">
                                              <svg
                                                className="h-4 w-4 mr-1"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                                                />
                                              </svg>
                                              Amount:
                                            </span>
                                            <span className="font-bold text-green-600">
                                              Rp
                                              {(
                                                safeNumber(
                                                  do_item.final_amount
                                                ) ||
                                                safeNumber(do_item.ongkosan)
                                              ).toLocaleString("id-ID")}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Action Hint */}
                                        <div className="pt-3 border-t border-gray-100">
                                          <div className="flex items-center justify-center text-xs text-blue-600 group-hover:text-blue-700">
                                            <svg
                                              className="h-3 w-3 mr-1"
                                              fill="none"
                                              viewBox="0 0 24 24"
                                              stroke="currentColor"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                              />
                                            </svg>
                                            Klik untuk detail lengkap DO
                                          </div>
                                        </div>
                                      </div>
                                    </Link>
                                  ))}

                                  {/* ✅ Add New DO Button */}
                                  <div className="flex-shrink-0 w-80 p-4 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 group">
                                    <Link
                                      to={`/trips/po/${po.id}/create-do`}
                                      className="text-center text-gray-600 group-hover:text-blue-600 transition-colors"
                                    >
                                      <svg
                                        className="h-8 w-8 mx-auto mb-2"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M12 4v16m8-8H4"
                                        />
                                      </svg>
                                      <div className="text-sm font-medium">
                                        Tambah DO Baru
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        Untuk PO ini
                                      </div>
                                    </Link>
                                  </div>
                                </div>

                                {/* ✅ Scroll Hint */}
                                {po.deliveryOrders.length > 2 && (
                                  <div className="text-center mt-2">
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                      ← Scroll horizontal untuk melihat semua DO
                                      →
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center py-8 text-gray-500 bg-white rounded-lg border-2 border-dashed border-gray-300">
                                <svg
                                  className="h-12 w-12 mx-auto mb-4 text-gray-400"
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
                                <p className="mb-2">
                                  Belum ada Delivery Order untuk PO ini
                                </p>
                                <Link
                                  to={`/trips/po/${po.id}/create-do`}
                                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                >
                                  + Buat DO Pertama
                                </Link>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
