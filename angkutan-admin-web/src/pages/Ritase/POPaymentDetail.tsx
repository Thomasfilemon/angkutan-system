// src/pages/Ritase/POPaymentDetail.tsx
import React, { useState, useCallback, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import apiClient from "../../api/axiosConfig";

interface PODetailData {
  purchase_order: {
    id: number;
    po_number: string;
    customer_name: string;
    item_name: string;
    total_quantity: number;
    unit_price: number;
    total_amount: number;
    load_location: string;
    unload_location: string;
    order_date: string;
    status: string;
    notes?: string;
  };
  financial_summary: {
    total_quantity: number;
    delivered_quantity: number;
    remaining_quantity: number;
    total_contract_value: number;
    total_billable_amount: number;
    total_paid_amount: number;
    total_remaining_amount: number;
    payment_percentage: number;
  };
  completed_delivery_orders: DOWithPayments[];
  non_completed_delivery_orders: DeliveryOrder[];
  summary: {
    total_dos: number;
    completed_dos: number;
    payment_ready_dos: number;
  };
}

interface DOWithPayments {
  id: number;
  do_number: string;
  customer_name: string;
  item_name: string;
  minimal_load_quantity: number;
  actual_load_quantity?: number;
  unit_price: number;
  total_amount: number;
  trip_allowance: number;
  gaji: number;
  ongkosan: number;
  final_amount?: number;
  load_location: string;
  unload_location: string;
  payment_status: string;
  payment_confirmation_status: string;
  status: string;
  created_at: string;
  completed_at?: string;
  vehicle?: {
    license_plate: string;
    type: string;
  };
  driver?: {
    username: string;
    driverProfile?: {
      full_name: string;
    };
  };
  payment_details: {
    total_invoiced: number;
    total_paid: number;
    remaining_amount: number;
    payment_percentage: number;
    payment_count: number;
    invoice_count: number;
    last_payment_date?: string;
  };
  payments: Payment[];
  invoices: Invoice[];
}

interface Payment {
  id: number;
  payment_amount: number;
  payment_date: string;
  payment_type: string;
  payment_reference?: string;
  notes?: string;
}

interface Invoice {
  id: number;
  invoice_number: string;
  invoice_amount: number;
  net_amount: number;
  pph_amount: number;
  invoice_date: string;
  due_date?: string;
  status: string;
}

interface DeliveryOrder {
  id: number;
  do_number: string;
  status: string;
  payment_status: string;
  minimal_load_quantity: number;
  actual_load_quantity?: number;
  vehicle?: {
    license_plate: string;
  };
  driver?: {
    username: string;
    driverProfile?: {
      full_name: string;
    };
  };
}

const POPaymentDetail: React.FC = () => {
  // ✅ SAFE HELPER FUNCTIONS (Add these)
  const safeNumber = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  };

  const formatCurrency = (
    value: string | number | null | undefined
  ): string => {
    return `Rp ${safeNumber(value).toLocaleString("id-ID")}`;
  };

  const formatQuantity = (
    value: string | number | null | undefined
  ): string => {
    return `${safeNumber(value).toLocaleString("id-ID")} Ton`;
  };

  const calculateBillableAmount = (
    quantity: string | number | null | undefined,
    unitPrice: string | number | null | undefined
  ): number => {
    return safeNumber(quantity) * safeNumber(unitPrice);
  };

  const calculateVariance = (
    paidAmount: string | number | null | undefined,
    billableAmount: number
  ): number => {
    return safeNumber(paidAmount) - billableAmount;
  };

  const calculateDOFinancials = (do_item: any, po: any) => {
    const quantity = safeNumber(
      do_item.actual_load_quantity || do_item.minimal_load_quantity
    );
    const unitPrice = safeNumber(po.unit_price);
    const paidAmount = safeNumber(financialSummary.total_paid_amount);

    const billableAmount = quantity * unitPrice;
    const variance = paidAmount - billableAmount;

    return {
      quantity,
      unitPrice,
      billableAmount,
      paidAmount,
      variance,
      isOverpaid: variance > 0,
      isUnderpaid: variance < 0,
    };
  };

  const { poId } = useParams<{ poId: string }>();
  const navigate = useNavigate();

  const [poData, setPOData] = useState<PODetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"completed" | "pending">(
    "completed"
  );

  const fetchPODetail = useCallback(async () => {
    if (!poId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get(`/ritase/purchase-orders/${poId}`);
      setPOData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch PO details");
      console.error("Error fetching PO details:", err);
    } finally {
      setLoading(false);
    }
  }, [poId]);

  useEffect(() => {
    fetchPODetail();
  }, [fetchPODetail]);

  const getPaymentStatusColor = (status: string) => {
    const colors = {
      lunas: "bg-green-100 text-green-800 border-green-200",
      deposit: "bg-yellow-100 text-yellow-800 border-yellow-200",
      awaiting_confirmation: "bg-blue-100 text-blue-800 border-blue-200",
      proses_tagihan: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return (
      colors[status as keyof typeof colors] ||
      "bg-gray-100 text-gray-800 border-gray-200"
    );
  };

  const getStatusColor = (status: string) => {
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading PO details...</p>
        </div>
      </div>
    );
  }

  if (error || !poData) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex">
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
            <h3 className="text-sm font-medium text-red-800">
              Error Loading PO
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error || "Purchase Order not found"}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={() => navigate("/ritase")}
                className="bg-red-100 px-4 py-2 rounded-md text-red-800 hover:bg-red-200 transition-colors"
              >
                ← Back to Ritase Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const po = poData.purchase_order;
  const financialSummary = poData.financial_summary;

  return (
    <div className="space-y-6 pb-8">
      {/* ✅ Hero Header Card */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-xl rounded-lg overflow-hidden">
        <div className="px-6 py-8">
          <div className="flex justify-between items-start mb-6">
            <button
              onClick={() => navigate("/ritase")}
              className="flex items-center px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
            >
              <svg
                className="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Dashboard
            </button>
            <div className="text-right">
              <span className="text-blue-100 text-sm">Purchase Order</span>
              <h1 className="text-3xl font-bold text-white">{po.po_number}</h1>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* PO Information */}
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                  {po.customer_name}
                </h2>
                <p className="text-blue-100 text-lg">{po.item_name}</p>
              </div>

              <div className="bg-white/10 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-100">Contract Value</span>
                    <p className="text-white font-semibold">
                      {formatCurrency(po.total_amount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-100">Total Quantity</span>
                    <p className="text-white font-semibold">
                      {formatQuantity(po.total_quantity)}
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-100">Order Date</span>
                    <p className="text-white font-semibold">
                      {new Date(po.order_date).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-100">Status</span>
                    <p className="text-white font-semibold capitalize">
                      {po.status}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Overview */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white">
                Progress Overview
              </h3>

              {/* Quantity Progress */}
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-blue-100">Delivery Progress</span>
                  <span className="text-white font-bold">
                    {(
                      (financialSummary.delivered_quantity /
                        financialSummary.total_quantity) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-3 mb-2">
                  <div
                    className="bg-white h-3 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        (financialSummary.delivered_quantity /
                          financialSummary.total_quantity) *
                          100,
                        100
                      )}%`,
                    }}
                  ></div>
                </div>
                <div className="text-sm text-blue-100">
                  {formatQuantity(financialSummary.delivered_quantity)} /{" "}
                  {formatQuantity(financialSummary.total_quantity)}
                </div>
              </div>

              {/* Payment Progress */}
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-blue-100">Payment Progress</span>
                  <span className="text-white font-bold">
                    {financialSummary.payment_percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-3 mb-2">
                  <div
                    className="bg-green-400 h-3 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        financialSummary.payment_percentage,
                        100
                      )}%`,
                    }}
                  ></div>
                </div>
                <div className="text-sm text-blue-100">
                  {formatCurrency(financialSummary.total_paid_amount)} /{" "}
                  {formatCurrency(financialSummary.total_billable_amount)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Total Tagihan
          </h3>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(financialSummary.total_billable_amount)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            From {poData.summary.completed_dos} completed DO
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Sudah Dibayar
          </h3>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(financialSummary.total_paid_amount)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {financialSummary.payment_percentage.toFixed(1)}% of total
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Sisa Tagihan
          </h3>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(financialSummary.total_remaining_amount)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Outstanding amount</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Delivery Orders
          </h3>
          <p className="text-2xl font-bold text-orange-600">
            {poData.summary.completed_dos}/{poData.summary.total_dos}
          </p>
          <p className="text-xs text-gray-500 mt-1">Completed / Total</p>
        </div>
      </div>

      {/* ✅ Location Information */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Route Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <svg
                className="h-4 w-4 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 11l5-5m0 0l5 5m-5-5v12"
                />
              </svg>
            </div>
            <div>
              <h4 className="font-medium text-gray-900">Loading Location</h4>
              <p className="text-gray-600">{po.load_location}</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="h-4 w-4 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 13l-5 5m0 0l-5-5m5 5V6"
                />
              </svg>
            </div>
            <div>
              <h4 className="font-medium text-gray-900">Unloading Location</h4>
              <p className="text-gray-600">{po.unload_location}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ DO Management Tabs */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("completed")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "completed"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Completed DOs ({poData.completed_delivery_orders.length})
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "pending"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Pending DOs ({poData.non_completed_delivery_orders.length})
            </button>
          </nav>
        </div>

        {/* ✅ Completed DOs Tab */}
        {activeTab === "completed" && (
          <div className="p-6">
            {poData.completed_delivery_orders.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="h-16 w-16 text-gray-400 mx-auto mb-4"
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
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Completed DOs
                </h3>
                <p className="text-gray-500">
                  Belum ada Delivery Order yang selesai untuk PO ini.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {poData.completed_delivery_orders.map((do_item) => (
                  <div
                    key={do_item.id}
                    className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">
                          {do_item.do_number}
                        </h4>
                        <p className="text-gray-600">
                          {do_item.vehicle?.license_plate} •{" "}
                          {do_item.driver?.driverProfile?.full_name ||
                            do_item.driver?.username}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${getPaymentStatusColor(
                            do_item.payment_status
                          )}`}
                        >
                          {do_item.payment_status.toUpperCase()}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            do_item.status
                          )}`}
                        >
                          COMPLETED
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                      {/* ✅ Calculated Amount */}
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <h5 className="text-sm font-medium text-blue-800 mb-1">
                          Harga Ritase
                        </h5>
                        <p className="text-sm text-blue-600">
                          {formatQuantity(
                            do_item.actual_load_quantity ||
                              do_item.minimal_load_quantity
                          )}{" "}
                          × {formatCurrency(po.unit_price)} /ton
                        </p>
                        <p className="text-lg font-bold text-blue-800">
                          {formatCurrency(
                            calculateBillableAmount(
                              do_item.actual_load_quantity ||
                                do_item.minimal_load_quantity,
                              po.unit_price
                            )
                          )}
                        </p>
                      </div>

                      {/* Pajak dan Biaya Lain */}
                      <div className="bg-yellow-50 p-3 rounded-lg">
                        <h5 className="text-sm font-medium text-yellow-800 mb-1">
                          PPH dan Biaya Lainnya
                        </h5>
                        <p className="text-sm text-yellow-600">
                          {formatCurrency(
                            calculateBillableAmount(
                              do_item.actual_load_quantity ||
                                do_item.minimal_load_quantity,
                              po.unit_price
                            )
                          )}{" "}
                          × 5%
                        </p>
                        <p className="text-lg font-bold text-yellow-800">
                          {formatCurrency(
                            financialSummary.total_billable_amount
                          )}
                        </p>
                      </div>

                      {/* ✅ Actual Payment */}
                      <div className="bg-green-50 p-3 rounded-lg">
                        <h5 className="text-sm font-medium text-green-800 mb-1">
                          Pembayaran Aktual
                        </h5>
                        <p className="text-lg font-bold text-green-800">
                          {formatCurrency(
                            do_item.payment_details.total_paid ||
                              do_item.ongkosan
                          )}
                        </p>
                        <p className="text-xs text-green-600">
                          {do_item.payment_details.payment_count} payments
                        </p>
                      </div>

                      {/* ✅ NEW: Payment Variance */}
                      <div
                        className={`p-3 rounded-lg ${
                          calculateVariance(
                            do_item.payment_details.total_paid ||
                              do_item.ongkosan,
                            calculateBillableAmount(
                              do_item.actual_load_quantity ||
                                do_item.minimal_load_quantity,
                              po.unit_price
                            )
                          ) >= 0
                            ? "bg-yellow-50 border border-yellow-200"
                            : "bg-red-50 border border-red-200"
                        }`}
                      >
                        <h5
                          className={`text-sm font-medium mb-1 ${
                            calculateVariance(
                              do_item.payment_details.total_paid ||
                                do_item.ongkosan,
                              calculateBillableAmount(
                                do_item.actual_load_quantity ||
                                  do_item.minimal_load_quantity,
                                po.unit_price
                              )
                            ) >= 0
                              ? "text-yellow-800"
                              : "text-red-800"
                          }`}
                        >
                          Selisih
                        </h5>
                        <p
                          className={`text-lg font-bold ${
                            calculateVariance(
                              do_item.payment_details.total_paid ||
                                do_item.ongkosan,
                              calculateBillableAmount(
                                do_item.actual_load_quantity ||
                                  do_item.minimal_load_quantity,
                                po.unit_price
                              )
                            ) >= 0
                              ? "text-yellow-800"
                              : "text-red-800"
                          }`}
                        >
                          {calculateVariance(
                            do_item.payment_details.total_paid ||
                              do_item.ongkosan,
                            calculateBillableAmount(
                              do_item.actual_load_quantity ||
                                do_item.minimal_load_quantity,
                              po.unit_price
                            )
                          ) >= 0
                            ? "+"
                            : ""}
                          {formatCurrency(
                            Math.abs(
                              calculateVariance(
                                do_item.payment_details.total_paid ||
                                  do_item.ongkosan,
                                calculateBillableAmount(
                                  do_item.actual_load_quantity ||
                                    do_item.minimal_load_quantity,
                                  po.unit_price
                                )
                              )
                            )
                          )}
                        </p>
                        <p
                          className={`text-xs ${
                            calculateVariance(
                              do_item.payment_details.total_paid ||
                                do_item.ongkosan,
                              calculateBillableAmount(
                                do_item.actual_load_quantity ||
                                  do_item.minimal_load_quantity,
                                po.unit_price
                              )
                            ) >= 0
                              ? "text-yellow-600"
                              : "text-red-600"
                          }`}
                        >
                          {calculateVariance(
                            do_item.payment_details.total_paid ||
                              do_item.ongkosan,
                            calculateBillableAmount(
                              do_item.actual_load_quantity ||
                                do_item.minimal_load_quantity,
                              po.unit_price
                            )
                          ) >= 0
                            ? "Lebih"
                            : "Kurang"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      {/* Quantity Info */}
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <h5 className="text-sm font-medium text-blue-800 mb-1">
                          Quantity
                        </h5>
                        <p className="text-sm text-blue-600">
                          Target:{" "}
                          {formatQuantity(do_item.minimal_load_quantity)}
                        </p>
                        {do_item.actual_load_quantity && (
                          <p className="text-sm text-blue-600">
                            Actual:{" "}
                            {formatQuantity(do_item.actual_load_quantity)}
                          </p>
                        )}
                      </div>

                      {/* Financial Info */}
                      <div className="bg-green-50 p-3 rounded-lg">
                        <h5 className="text-sm font-medium text-green-800 mb-1">
                          Financial
                        </h5>
                        <p className="text-sm text-green-600">
                          Amount:{" "}
                          {formatCurrency(
                            do_item.payment_details.total_paid ||
                              do_item.ongkosan
                          )}
                        </p>
                        <p className="text-xs text-green-500">
                          {do_item.payment_details.payment_percentage.toFixed(
                            1
                          )}
                          % paid
                        </p>
                      </div>

                      {/* Payment Info */}
                      <div className="bg-yellow-50 p-3 rounded-lg">
                        <h5 className="text-sm font-medium text-yellow-800 mb-1">
                          Payments
                        </h5>
                        <p className="text-sm text-yellow-600">
                          {do_item.payment_details.payment_count} payments
                        </p>
                        <p className="text-sm text-yellow-600">
                          {do_item.payment_details.invoice_count} invoices
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col space-y-2">
                        <Link
                          to={`/ritase/do/${do_item.id}/payment`}
                          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors text-center"
                        >
                          Manage Payment
                        </Link>
                        <Link
                          to={`/delivery-orders/${do_item.id}`}
                          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-200 transition-colors text-center"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>

                    {/* ✅ COMPLETELY REFACTORED - Payment Status with Variance Alert */}
                    {(() => {
                      // ✅ Calculate once, use multiple times
                      const financials = calculateDOFinancials(do_item, po);
                      const hasSignificantVariance =
                        Math.abs(financials.variance) > 1000;

                      if (!hasSignificantVariance) return null;

                      return (
                        <div
                          className={`border rounded-lg p-3 ${
                            financials.isOverpaid
                              ? "bg-blue-50 border-blue-200"
                              : "bg-red-50 border-red-200"
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span
                              className={`text-sm font-medium ${
                                financials.isOverpaid
                                  ? "text-blue-700"
                                  : "text-red-700"
                              }`}
                            >
                              {financials.isOverpaid
                                ? "💰 Customer overpaid - consider refund or credit note"
                                : "⚠️ Payment incomplete - follow up required"}
                            </span>
                            <span
                              className={`text-sm font-bold ${
                                financials.isOverpaid
                                  ? "text-blue-700"
                                  : "text-red-700"
                              }`}
                            >
                              {financials.variance >= 0 ? "+" : ""}
                              {formatCurrency(Math.abs(financials.variance))}
                            </span>
                          </div>

                          {/* ✅ Additional Details */}
                          <div className="mt-2 text-xs text-gray-600">
                            <p>
                              Terhitung:{" "}
                              {formatCurrency(financials.billableAmount)}
                            </p>
                            <p>
                              Dibayar: {formatCurrency(financials.paidAmount)}
                            </p>
                            <p>
                              Selisih:{" "}
                              {(
                                (Math.abs(financials.variance) /
                                  financials.billableAmount) *
                                100
                              ).toFixed(1)}
                              %
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Quick Payment Summary */}
                    {do_item.payment_details.remaining_amount > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-red-700">
                            Outstanding:{" "}
                            {formatCurrency(
                              do_item.payment_details.remaining_amount
                            )}
                          </span>
                          {do_item.payment_details.last_payment_date && (
                            <span className="text-xs text-red-500">
                              Last payment:{" "}
                              {new Date(
                                do_item.payment_details.last_payment_date
                              ).toLocaleDateString("id-ID")}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ✅ Pending DOs Tab */}
        {activeTab === "pending" && (
          <div className="p-6">
            {poData.non_completed_delivery_orders.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="h-16 w-16 text-green-400 mx-auto mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  All DOs Completed
                </h3>
                <p className="text-gray-500">
                  Semua Delivery Order untuk PO ini sudah selesai.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {poData.non_completed_delivery_orders.map((do_item) => (
                  <Link
                    key={do_item.id}
                    to={`/delivery-orders/${do_item.id}`}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium text-gray-900">
                        {do_item.do_number}
                      </h4>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                          do_item.status
                        )}`}
                      >
                        {do_item.status.replace("_", " ").toUpperCase()}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      <p>🚛 {do_item.vehicle?.license_plate}</p>
                      <p>
                        👨‍💼{" "}
                        {do_item.driver?.driverProfile?.full_name ||
                          do_item.driver?.username}
                      </p>
                      <p>📦 {formatQuantity(do_item.minimal_load_quantity)}</p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <span className="text-xs text-blue-600">
                        Click untuk detail →
                      </span>
                    </div>
                  </Link>
                ))}

                {/* Add New DO Card */}
                <Link
                  to={`/trips/po/${po.id}/create-do`}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center justify-center"
                >
                  <div className="text-center text-gray-600">
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
                    <p className="text-sm font-medium">Add New DO</p>
                  </div>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ✅ Quick Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to={`/trips/po/${po.id}/create-do`}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors text-center"
          >
            + Create New DO
          </Link>

          <button
            onClick={() =>
              window.open(`/api/web/ritase/export?po_id=${po.id}`, "_blank")
            }
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
          >
            📊 Export Report
          </button>

          <Link
            to={`/trips/po/${po.id}/edit`}
            className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors text-center"
          >
            ✏️ Edit PO
          </Link>
        </div>
      </div>
    </div>
  );
};

export default POPaymentDetail;
