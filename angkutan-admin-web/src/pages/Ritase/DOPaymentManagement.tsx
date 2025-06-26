// src/pages/Ritase/DOPaymentManagement.tsx
import React, { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import apiClient from "../../api/axiosConfig";

interface DOPaymentData {
  delivery_order: {
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
    purchaseOrder?: {
      po_number: string;
      customer_name: string;
      unit_price: number;
    };
  };
  payment_summary: {
    original_amount: number;
    final_amount: number;
    calculated_bill: number;
    total_invoiced: number;
    total_paid: number;
    total_pph: number;
    remaining_amount: number;
    payment_percentage: number;
    payment_status: string;
    confirmation_status: string;
  };
  payments: Payment[];
  invoices: Invoice[];
  adjustments: PriceAdjustment[];
  system_settings: {
    default_pph_percentage: number;
  };
}

interface Payment {
  id: number;
  payment_amount: number;
  payment_date: string;
  payment_type: string;
  payment_reference?: string;
  bank_account?: string;
  notes?: string;
  attachment_url?: string;
  created_at: string;
}

interface Invoice {
  id: number;
  invoice_number: string;
  invoice_amount: number;
  net_amount: number;
  pph_amount: number;
  pph_percentage: number;
  invoice_date: string;
  due_date?: string;
  status: string;
  notes?: string;
}

interface PriceAdjustment {
  id: number;
  adjustment_type: string;
  original_amount: number;
  adjustment_amount: number;
  final_amount: number;
  reason: string;
  created_at: string;
}

interface NewInvoice {
  invoice_number: string;
  invoice_amount: number;
  due_date: string;
  pph_percentage: number;
  notes: string;
}

interface NewPayment {
  payment_amount: number;
  payment_date: string;
  payment_type: string;
  payment_reference: string;
  bank_account: string;
  notes: string;
}

interface NewAdjustment {
  adjustment_type: string;
  adjustment_amount: number;
  reason: string;
}

const DOPaymentManagement: React.FC = () => {
  const { doId } = useParams<{ doId: string }>();
  const navigate = useNavigate();

  const [doData, setDOData] = useState<DOPaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "invoices" | "payments" | "adjustments"
  >("overview");
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [newInvoice, setNewInvoice] = useState<NewInvoice>({
    invoice_number: "",
    invoice_amount: 0,
    due_date: "",
    pph_percentage: 0.5,
    notes: "",
  });

  const [newPayment, setNewPayment] = useState<NewPayment>({
    payment_amount: 0,
    payment_date: new Date().toISOString().split("T")[0],
    payment_type: "transfer",
    payment_reference: "",
    bank_account: "",
    notes: "",
  });

  const [newAdjustment, setNewAdjustment] = useState<NewAdjustment>({
    adjustment_type: "price_override",
    adjustment_amount: 0,
    reason: "",
  });

  // Helper functions
  // ✅ SAFE STRING HELPERS (Add these)
  const safeString = (value: string | null | undefined): string => {
    return value || "";
  };

  const safeReplace = (
    value: string | null | undefined,
    searchValue: string,
    replaceValue: string
  ): string => {
    if (typeof value !== "string") return "";
    return value.replace(searchValue, replaceValue);
  };

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
    quantity: number,
    unitPrice: number
  ): number => {
    return quantity * unitPrice;
  };

  const calculatePPH = (amount: number, percentage: number): number => {
    return (amount * percentage) / 100;
  };

  const calculateNetAmount = (
    grossAmount: number,
    pphAmount: number
  ): number => {
    return grossAmount - pphAmount;
  };

  const fetchDOPaymentData = useCallback(async () => {
    if (!doId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get(
        `/ritase/delivery-orders/${doId}/payment`
      );
      setDOData(response.data);

      // Initialize form with calculated values
      if (response.data.delivery_order) {
        const do_item = response.data.delivery_order;
        const calculatedAmount = calculateBillableAmount(
          safeNumber(
            do_item.actual_load_quantity || do_item.minimal_load_quantity
          ),
          safeNumber(do_item.purchaseOrder?.unit_price || do_item.unit_price)
        );

        setNewInvoice((prev) => ({
          ...prev,
          invoice_amount: calculatedAmount,
          pph_percentage:
            response.data.system_settings?.default_pph_percentage || 0.5,
          invoice_number: `INV/${
            safeReplace(do_item?.do_number, "DO-", "") || "NEW"
          }`,
        }));
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to fetch DO payment data"
      );
      console.error("Error fetching DO payment data:", err);
    } finally {
      setLoading(false);
    }
  }, [doId]);

  useEffect(() => {
    fetchDOPaymentData();
  }, [fetchDOPaymentData]);

  const handleConfirmForPayment = async () => {
    if (!doData?.delivery_order) return;

    try {
      setSubmitting(true);
      const calculatedAmount = calculateBillableAmount(
        safeNumber(
          doData.delivery_order.actual_load_quantity ||
            doData.delivery_order.minimal_load_quantity
        ),
        safeNumber(
          doData.delivery_order.purchaseOrder?.unit_price ||
            doData.delivery_order.unit_price
        )
      );

      await apiClient.post(`/ritase/delivery-orders/${doId}/confirm`, {
        final_amount: calculatedAmount,
        notes: "Confirmed for payment processing",
      });

      await fetchDOPaymentData(); // Refresh data
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to confirm DO for payment"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doId) return;

    try {
      setSubmitting(true);
      await apiClient.post(
        `/ritase/delivery-orders/${doId}/invoice`,
        newInvoice
      );

      setShowInvoiceForm(false);
      setNewInvoice({
        invoice_number: "",
        invoice_amount: 0,
        due_date: "",
        pph_percentage: 0.5,
        notes: "",
      });
      await fetchDOPaymentData();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create invoice");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doId) return;

    try {
      setSubmitting(true);
      await apiClient.post(
        `/ritase/delivery-orders/${doId}/payment`,
        newPayment
      );

      setShowPaymentForm(false);
      setNewPayment({
        payment_amount: 0,
        payment_date: new Date().toISOString().split("T")[0],
        payment_type: "transfer",
        payment_reference: "",
        bank_account: "",
        notes: "",
      });
      await fetchDOPaymentData();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doId) return;

    try {
      setSubmitting(true);
      await apiClient.post(
        `/ritase/delivery-orders/${doId}/adjustment`,
        newAdjustment
      );

      setShowAdjustmentForm(false);
      setNewAdjustment({
        adjustment_type: "price_override",
        adjustment_amount: 0,
        reason: "",
      });
      await fetchDOPaymentData();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create adjustment");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      awaiting_confirmation: "bg-yellow-100 text-yellow-800 border-yellow-200",
      confirmed: "bg-blue-100 text-blue-800 border-blue-200",
      lunas: "bg-green-100 text-green-800 border-green-200",
      deposit: "bg-orange-100 text-orange-800 border-orange-200",
      proses_tagihan: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return (
      colors[status as keyof typeof colors] ||
      "bg-gray-100 text-gray-800 border-gray-200"
    );
  };

  const getPaymentTypeIcon = (type: string) => {
    const icons = {
      cash: "💵",
      transfer: "🏦",
      check: "📝",
      giro: "🎫",
    };
    return icons[type as keyof typeof icons] || "💳";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading payment management...</p>
        </div>
      </div>
    );
  }

  if (error || !doData) {
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
              Error Loading Payment Data
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error || "Delivery Order payment data not found"}</p>
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

  const do_item = doData.delivery_order;
  const paymentSummary = doData.payment_summary;

  // Calculate variance and billable amount
  const billableQuantity = safeNumber(
    do_item.actual_load_quantity || do_item.minimal_load_quantity
  );
  const unitPrice = safeNumber(
    do_item.purchaseOrder?.unit_price || do_item.unit_price
  );
  const calculatedBillableAmount = calculateBillableAmount(
    billableQuantity,
    unitPrice
  );
  const paymentVariance = paymentSummary.total_paid - calculatedBillableAmount;
  const isOverpaid = paymentVariance > 0;
  const isUnderpaid = paymentVariance < 0;

  return (
    <div className="space-y-6 pb-8">
      {/* ✅ Header with Navigation */}
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
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
            Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Payment Management
            </h1>
            <p className="text-gray-600">
              {do_item.do_number} • {do_item.customer_name}
            </p>
          </div>
        </div>

        {/* Quick Status */}
        <div className="flex items-center space-x-3">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
              paymentSummary?.payment_status || "pending"
            )}`}
          />
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
              paymentSummary?.payment_status || "unknown"
            )}`}
          />
          {(paymentSummary?.payment_status || "UNKNOWN")
            .replace("_", " ")
            .toUpperCase()}
        </div>
      </div>

      {/* ✅ DO Overview Card */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 shadow-xl rounded-lg overflow-hidden">
        <div className="px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  DO Information
                </h2>
                <div className="bg-white/10 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-100">Vehicle:</span>
                    <span className="text-white font-medium">
                      {do_item.vehicle?.license_plate}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-100">Driver:</span>
                    <span className="text-white font-medium">
                      {do_item.driver?.driverProfile?.full_name ||
                        do_item.driver?.username}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-100">Quantity:</span>
                    <span className="text-white font-medium">
                      {formatQuantity(billableQuantity)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-100">Unit Price:</span>
                    <span className="text-white font-medium">
                      {formatCurrency(unitPrice)}/ton
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Financial Summary
                </h3>
                <div className="bg-white/10 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-purple-100">Calculated Bill:</span>
                    <span className="text-white font-bold">
                      {formatCurrency(paymentSummary.calculated_bill)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-100">Total Paid:</span>
                    <span className="text-white font-bold">
                      {formatCurrency(paymentSummary.total_paid)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-100">Remaining:</span>
                    <span className="text-white font-bold">
                      {formatCurrency(paymentSummary.remaining_amount)}
                    </span>
                  </div>

                  {/* Variance Alert */}
                  {Math.abs(paymentVariance) > 1000 && (
                    <div
                      className={`mt-3 p-2 rounded-lg text-sm ${
                        isOverpaid
                          ? "bg-blue-400/20 text-blue-100"
                          : "bg-red-400/20 text-red-100"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>
                          {isOverpaid ? "💰 Overpaid" : "⚠️ Underpaid"}
                        </span>
                        <span className="font-bold">
                          {paymentVariance >= 0 ? "+" : ""}
                          {formatCurrency(Math.abs(paymentVariance))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Progress */}
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Payment Progress
                </h3>
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-purple-100">Completion</span>
                    <span className="text-white font-bold">
                      {Math.min(paymentSummary.payment_percentage, 100).toFixed(
                        1
                      )}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-4 mb-3">
                    <div
                      className="bg-white h-4 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          paymentSummary.payment_percentage,
                          100
                        )}%`,
                      }}
                    ></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-purple-100">Invoices:</span>
                      <div className="text-white font-medium">
                        {doData.invoices.length}
                      </div>
                    </div>
                    <div>
                      <span className="text-purple-100">Payments:</span>
                      <div className="text-white font-medium">
                        {doData.payments.length}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Confirmation Alert */}
      {paymentSummary.confirmation_status === "awaiting_confirmation" && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg
                className="h-8 w-8 text-yellow-600 mr-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <div>
                <h3 className="text-lg font-medium text-yellow-800">
                  DO Ready for Payment
                </h3>
                <p className="text-yellow-700">
                  This DO has been completed and needs confirmation for payment
                  processing.
                </p>
              </div>
            </div>
            <button
              onClick={handleConfirmForPayment}
              disabled={submitting}
              className="bg-yellow-600 text-white px-6 py-3 rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
            >
              {submitting ? "Confirming..." : "Confirm for Payment"}
            </button>
          </div>
        </div>
      )}

      {/* ✅ Navigation Tabs */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {[
              { key: "overview", label: "Overview", count: null },
              {
                key: "invoices",
                label: "Invoices",
                count: doData.invoices.length,
              },
              {
                key: "payments",
                label: "Payments",
                count: doData.payments.length,
              },
              {
                key: "adjustments",
                label: "Adjustments",
                count: doData.adjustments.length,
              },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.key
                    ? "border-purple-500 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      activeTab === tab.key
                        ? "bg-purple-100 text-purple-600"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* ✅ Tab Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Payment Overview</h3>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setShowInvoiceForm(true)}
                  disabled={paymentSummary.confirmation_status !== "confirmed"}
                  className="p-6 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="text-center">
                    <svg
                      className="h-12 w-12 mx-auto mb-3 text-blue-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    <h4 className="font-medium text-gray-900">
                      Create Invoice
                    </h4>
                    <p className="text-sm text-gray-600">
                      Generate new invoice
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setShowPaymentForm(true)}
                  disabled={doData.invoices.length === 0}
                  className="p-6 border-2 border-dashed border-green-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="text-center">
                    <svg
                      className="h-12 w-12 mx-auto mb-3 text-green-500"
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
                    <h4 className="font-medium text-gray-900">
                      Record Payment
                    </h4>
                    <p className="text-sm text-gray-600">Add new payment</p>
                  </div>
                </button>

                <button
                  onClick={() => setShowAdjustmentForm(true)}
                  disabled={paymentSummary.confirmation_status !== "confirmed"}
                  className="p-6 border-2 border-dashed border-yellow-300 rounded-lg hover:border-yellow-400 hover:bg-yellow-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="text-center">
                    <svg
                      className="h-12 w-12 mx-auto mb-3 text-yellow-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    <h4 className="font-medium text-gray-900">
                      Price Adjustment
                    </h4>
                    <p className="text-sm text-gray-600">Modify pricing</p>
                  </div>
                </button>
              </div>

              {/* Recent Activity */}
              <div>
                <h4 className="text-md font-medium mb-4">Recent Activity</h4>
                <div className="space-y-3">
                  {[
                    ...doData.payments.map((payment) => ({
                      type: "payment",
                      data: payment,
                      timestamp: payment.created_at,
                    })),
                    ...doData.invoices.map((invoice) => ({
                      type: "invoice",
                      data: invoice,
                      timestamp: invoice.invoice_date,
                    })),
                    ...doData.adjustments.map((adjustment) => ({
                      type: "adjustment",
                      data: adjustment,
                      timestamp: adjustment.created_at,
                    })),
                  ]
                    .sort(
                      (a, b) =>
                        new Date(b.timestamp).getTime() -
                        new Date(a.timestamp).getTime()
                    )
                    .slice(0, 5)
                    .map((activity, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
                            activity.type === "payment"
                              ? "bg-green-500"
                              : activity.type === "invoice"
                              ? "bg-blue-500"
                              : "bg-yellow-500"
                          }`}
                        >
                          {activity.type === "payment"
                            ? "💰"
                            : activity.type === "invoice"
                            ? "📄"
                            : "⚡"}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {activity.type === "payment" &&
                              `Payment recorded: ${formatCurrency(
                                (activity.data as Payment).payment_amount
                              )}`}
                            {activity.type === "invoice" &&
                              `Invoice created: ${
                                (activity.data as Invoice).invoice_number
                              }`}
                            {activity.type === "adjustment" &&
                              `Price adjustment: ${
                                (activity.data as PriceAdjustment)
                                  .adjustment_type
                              }`}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(activity.timestamp).toLocaleDateString(
                              "id-ID",
                              {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Invoices Tab */}
          {activeTab === "invoices" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Invoice Management</h3>
                <button
                  onClick={() => setShowInvoiceForm(true)}
                  disabled={paymentSummary.confirmation_status !== "confirmed"}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  + Create Invoice
                </button>
              </div>

              {doData.invoices.length === 0 ? (
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
                    No Invoices Yet
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Create your first invoice to start the payment process.
                  </p>
                  <button
                    onClick={() => setShowInvoiceForm(true)}
                    disabled={
                      paymentSummary.confirmation_status !== "confirmed"
                    }
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    Create First Invoice
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {doData.invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            {invoice.invoice_number}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {new Date(invoice.invoice_date).toLocaleDateString(
                              "id-ID"
                            )}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                            invoice.status
                          )}`}
                        >
                          {invoice.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Gross Amount:</span>
                          <span className="font-medium">
                            {formatCurrency(invoice.invoice_amount)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            PPH ({invoice.pph_percentage}%):
                          </span>
                          <span className="font-medium text-red-600">
                            -{formatCurrency(invoice.pph_amount)}
                          </span>
                        </div>
                        <div className="flex justify-between font-semibold border-t pt-2">
                          <span>Net Amount:</span>
                          <span>{formatCurrency(invoice.net_amount)}</span>
                        </div>
                      </div>

                      {invoice.due_date && (
                        <div className="mt-3 text-xs text-gray-500">
                          Due:{" "}
                          {new Date(invoice.due_date).toLocaleDateString(
                            "id-ID"
                          )}
                          {new Date(invoice.due_date) < new Date() &&
                            invoice.status !== "paid" && (
                              <span className="ml-2 text-red-600 font-medium">
                                OVERDUE
                              </span>
                            )}
                        </div>
                      )}

                      {invoice.notes && (
                        <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
                          <strong>Notes:</strong> {invoice.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === "payments" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Payment Records</h3>
                <button
                  onClick={() => setShowPaymentForm(true)}
                  disabled={doData.invoices.length === 0}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  + Record Payment
                </button>
              </div>

              {doData.payments.length === 0 ? (
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
                      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Payments Recorded
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Record payments received from the customer.
                  </p>
                  <button
                    onClick={() => setShowPaymentForm(true)}
                    disabled={doData.invoices.length === 0}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    Record First Payment
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {doData.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="text-2xl">
                            {getPaymentTypeIcon(payment.payment_type)}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {formatCurrency(payment.payment_amount)}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {payment.payment_type.charAt(0).toUpperCase() +
                                payment.payment_type.slice(1)}{" "}
                              •
                              {new Date(
                                payment.payment_date
                              ).toLocaleDateString("id-ID")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          <p>
                            Recorded:{" "}
                            {new Date(payment.created_at).toLocaleDateString(
                              "id-ID"
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {payment.payment_reference && (
                          <div>
                            <span className="text-gray-600">Reference:</span>
                            <p className="font-medium">
                              {payment.payment_reference}
                            </p>
                          </div>
                        )}
                        {payment.bank_account && (
                          <div>
                            <span className="text-gray-600">Bank Account:</span>
                            <p className="font-medium">
                              {payment.bank_account}
                            </p>
                          </div>
                        )}
                      </div>

                      {payment.notes && (
                        <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                          <strong>Notes:</strong> {payment.notes}
                        </div>
                      )}

                      {payment.attachment_url && (
                        <div className="mt-3">
                          <a
                            href={payment.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm hover:bg-blue-200 transition-colors"
                          >
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
                                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                              />
                            </svg>
                            View Receipt
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Adjustments Tab */}
          {activeTab === "adjustments" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Price Adjustments</h3>
                <button
                  onClick={() => setShowAdjustmentForm(true)}
                  disabled={paymentSummary.confirmation_status !== "confirmed"}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
                >
                  + Create Adjustment
                </button>
              </div>

              {doData.adjustments.length === 0 ? (
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
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Adjustments
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Create adjustments for special cases like accidents or
                    additional charges.
                  </p>
                  <button
                    onClick={() => setShowAdjustmentForm(true)}
                    disabled={
                      paymentSummary.confirmation_status !== "confirmed"
                    }
                    className="bg-yellow-600 text-white px-6 py-3 rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
                  >
                    Create First Adjustment
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {doData.adjustments.map((adjustment) => (
                    <div
                      key={adjustment.id}
                      className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-semibold text-gray-900 capitalize">
                            {safeReplace(
                              adjustment?.adjustment_type,
                              "_",
                              " "
                            ) || "Unknown"}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {new Date(adjustment.created_at).toLocaleDateString(
                              "id-ID"
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                        <div>
                          <span className="text-gray-600">Original:</span>
                          <p className="font-medium">
                            {formatCurrency(adjustment.original_amount)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">Adjusted:</span>
                          <p className="font-medium">
                            {formatCurrency(adjustment.adjustment_amount)}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">Final:</span>
                          <p className="font-medium text-blue-600">
                            {formatCurrency(adjustment.final_amount)}
                          </p>
                        </div>
                      </div>

                      <div className="p-3 bg-gray-50 rounded text-sm">
                        <strong>Reason:</strong> {adjustment.reason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ✅ CREATE INVOICE MODAL */}
      {showInvoiceForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Create Invoice</h3>
                <button
                  onClick={() => setShowInvoiceForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    required
                    value={newInvoice.invoice_number}
                    onChange={(e) =>
                      setNewInvoice((prev) => ({
                        ...prev,
                        invoice_number: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="INV/2024/001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newInvoice.due_date}
                    onChange={(e) =>
                      setNewInvoice((prev) => ({
                        ...prev,
                        due_date: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Amount
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={newInvoice.invoice_amount}
                  onChange={(e) =>
                    setNewInvoice((prev) => ({
                      ...prev,
                      invoice_amount: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Calculated: {formatCurrency(calculatedBillableAmount)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PPH Percentage (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={newInvoice.pph_percentage}
                  onChange={(e) =>
                    setNewInvoice((prev) => ({
                      ...prev,
                      pph_percentage: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Real-time Calculation */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">
                  Invoice Calculation
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Gross Amount:</span>
                    <span className="font-medium">
                      {formatCurrency(newInvoice.invoice_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>PPH ({newInvoice.pph_percentage}%):</span>
                    <span className="font-medium text-red-600">
                      -
                      {formatCurrency(
                        calculatePPH(
                          newInvoice.invoice_amount,
                          newInvoice.pph_percentage
                        )
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-blue-200 pt-1">
                    <span>Net Amount:</span>
                    <span>
                      {formatCurrency(
                        calculateNetAmount(
                          newInvoice.invoice_amount,
                          calculatePPH(
                            newInvoice.invoice_amount,
                            newInvoice.pph_percentage
                          )
                        )
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={newInvoice.notes}
                  onChange={(e) =>
                    setNewInvoice((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Additional notes for this invoice..."
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowInvoiceForm(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ RECORD PAYMENT MODAL */}
      {showPaymentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Record Payment</h3>
                <button
                  onClick={() => setShowPaymentForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Amount
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newPayment.payment_amount}
                    onChange={(e) =>
                      setNewPayment((prev) => ({
                        ...prev,
                        payment_amount: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Remaining: {formatCurrency(paymentSummary.remaining_amount)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newPayment.payment_date}
                    onChange={(e) =>
                      setNewPayment((prev) => ({
                        ...prev,
                        payment_date: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select
                  value={newPayment.payment_type}
                  onChange={(e) =>
                    setNewPayment((prev) => ({
                      ...prev,
                      payment_type: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="giro">Giro</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Reference
                  </label>
                  <input
                    type="text"
                    value={newPayment.payment_reference}
                    onChange={(e) =>
                      setNewPayment((prev) => ({
                        ...prev,
                        payment_reference: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Transfer ID, Check number, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Account
                  </label>
                  <input
                    type="text"
                    value={newPayment.bank_account}
                    onChange={(e) =>
                      setNewPayment((prev) => ({
                        ...prev,
                        bank_account: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Account number or name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={newPayment.notes}
                  onChange={(e) =>
                    setNewPayment((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Additional payment details..."
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentForm(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ CREATE ADJUSTMENT MODAL */}
      {showAdjustmentForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">
                  Create Price Adjustment
                </h3>
                <button
                  onClick={() => setShowAdjustmentForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateAdjustment} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adjustment Type
                </label>
                <select
                  value={newAdjustment.adjustment_type}
                  onChange={(e) =>
                    setNewAdjustment((prev) => ({
                      ...prev,
                      adjustment_type: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                >
                  <option value="price_override">Price Override</option>
                  <option value="uj_tambahan">UJ Tambahan</option>
                  <option value="penalty">Penalty</option>
                  <option value="bonus">Bonus</option>
                  <option value="incident">Incident (Kecelakaan)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Amount
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={newAdjustment.adjustment_amount}
                  onChange={(e) =>
                    setNewAdjustment((prev) => ({
                      ...prev,
                      adjustment_amount: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Current: {formatCurrency(calculatedBillableAmount)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Adjustment
                </label>
                <textarea
                  rows={4}
                  required
                  value={newAdjustment.reason}
                  onChange={(e) =>
                    setNewAdjustment((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  placeholder="Explain why this adjustment is necessary..."
                />
              </div>

              {/* Adjustment Preview */}
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">
                  Adjustment Preview
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Original Amount:</span>
                    <span className="font-medium">
                      {formatCurrency(calculatedBillableAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>New Amount:</span>
                    <span className="font-medium">
                      {formatCurrency(newAdjustment.adjustment_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-yellow-200 pt-1">
                    <span>Change:</span>
                    <span
                      className={
                        newAdjustment.adjustment_amount >
                        calculatedBillableAmount
                          ? "text-red-600"
                          : "text-green-600"
                      }
                    >
                      {newAdjustment.adjustment_amount >
                      calculatedBillableAmount
                        ? "+"
                        : ""}
                      {formatCurrency(
                        newAdjustment.adjustment_amount -
                          calculatedBillableAmount
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAdjustmentForm(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ Quick Actions Floating Bar */}
      <div className="fixed bottom-6 right-6 space-y-3">
        <Link
          to={`/delivery-orders/${doId}`}
          className="block w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
          title="View DO Details"
        >
          <svg
            className="h-6 w-6"
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
        </Link>

        <button
          onClick={() => window.print()}
          className="block w-12 h-12 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition-colors flex items-center justify-center"
          title="Print Payment Summary"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default DOPaymentManagement;
