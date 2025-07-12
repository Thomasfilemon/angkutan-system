// src/pages/Ritase/DOPaymentManagement.tsx
import React, { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import apiClient from "../../api/axiosConfig";
import toast from "react-hot-toast";

interface DOPaymentData {
  delivery_order: {
    id: number;
    do_number: string;
    customer_name: string;
    item_name: string;
    minimal_load_quantity: number;
    actual_load_quantity?: number;
    unit_price: number;
    unit: string;
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

  const calculateUnitAwareAmount = (
    quantity: number,
    unit: string,
    unitPrice: number
  ): number => {
    switch (unit) {
      case "kilogram":
        return quantity * unitPrice;
      case "ton":
        return quantity * unitPrice; // Convert ton to kg
      case "kubik":
        return quantity * unitPrice; // Direct volume pricing
      default:
        throw new Error(`Unknown unit: ${unit}`);
    }
  };

  // ✅ Fixed: Dynamic unit formatting
  const formatQuantityWithUnit = (
    value: string | number | null | undefined,
    unit: string
  ): string => {
    const num = safeNumber(value);
    switch (unit) {
      case "kilogram":
        return `${num.toLocaleString("id-ID")} Kg`;
      case "ton":
        return `${num.toLocaleString("id-ID")} Ton`;
      case "kubik":
        return `${num.toLocaleString("id-ID")} m³`;
      default:
        return `${num.toLocaleString("id-ID")} ${unit}`;
    }
  };

  // ✅ Fixed: Dynamic unit price formatting
  const formatUnitPrice = (price: number, unit: string): string => {
    switch (unit) {
      case "ton":
        return `${formatCurrency(price / 1000)}/kg (${formatCurrency(
          price
        )}/ton)`;
      case "kilogram":
        return `${formatCurrency(price)}/kg`;
      case "kubik":
        return `${formatCurrency(price)}/m³`;
      default:
        return `${formatCurrency(price)}/${unit}`;
    }
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

      // ✅ FIXED: Handle wrapped response structure properly
      const responseData = response.data.success
        ? response.data.data
        : response.data;
      setDOData(responseData);

      // ✅ FIXED: Use consistent data structure
      if (responseData.delivery_order) {
        const do_item = responseData.delivery_order;
        const quantity = safeNumber(
          do_item.actual_load_quantity || do_item.minimal_load_quantity
        );
        const unitPrice = safeNumber(
          do_item.purchaseOrder?.unit_price || do_item.unit_price
        );
        const unit = do_item.unit || "ton";

        const calculatedAmount = calculateUnitAwareAmount(
          quantity,
          unit,
          unitPrice
        );

        setNewInvoice((prev) => ({
          ...prev,
          invoice_amount: calculatedAmount,
          pph_percentage:
            responseData.system_settings?.default_pph_percentage || 0.5,
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

  const handleConfirmForBilling = async () => {
    if (!doData?.delivery_order) {
      toast.error("Delivery Order data not found!");
      return;
    }

    try {
      setSubmitting(true);

      // ✅ FIXED: Use the correct endpoint format
      await apiClient.patch(
        `/payments/delivery-orders/${doData.delivery_order.id}/confirm`,
        {
          action: "confirm_for_billing",
          notes: "Confirmed for payment processing",
        }
      );

      toast.success("Delivery Order confirmed for billing successfully!");

      // ✅ FIXED: Refresh data after confirmation
      await fetchDOPaymentData();
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        "Failed to confirm Delivery Order for billing";
      toast.error(errorMsg);
      console.error("Confirmation error:", err);
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

  const getStatusText = (status: string) => {
    const statusMap = {
      awaiting_confirmation: "AWAITING CONFIRMATION",
      confirmed: "CONFIRMED",
      lunas: "LUNAS",
      deposit: "DEPOSIT",
      proses_tagihan: "PROSES TAGIHAN",
      partial: "PARTIAL",
      unpaid: "BELUM LUNAS",
      overpaid: "OVERPAID",
    };
    return (
      statusMap[status as keyof typeof statusMap] ||
      status.replace("_", " ").toUpperCase()
    );
  };

  const getStatusColor = (status: string) => {
    const colors = {
      awaiting_confirmation: "bg-yellow-100 text-yellow-800 border-yellow-300",
      confirmed: "bg-blue-100 text-blue-800 border-blue-300",
      lunas: "bg-green-100 text-green-800 border-green-300",
      deposit: "bg-orange-100 text-orange-800 border-orange-300",
      proses_tagihan: "bg-purple-100 text-purple-800 border-purple-300",
      partial: "bg-amber-100 text-amber-800 border-amber-300",
      unpaid: "bg-red-100 text-red-800 border-red-300",
      overpaid: "bg-cyan-100 text-cyan-800 border-cyan-300",
    };
    return (
      colors[status as keyof typeof colors] ||
      "bg-gray-100 text-gray-800 border-gray-300"
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
                onClick={() => navigate("/ritase/comprehensive")}
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
  const unit = do_item.unit || "ton"; // Fallback to ton

  const canConfirmBilling = () => {
    const confirmationStatus = paymentSummary?.confirmation_status || "pending";
    const deliveryStatus = do_item?.status || "pending";

    return (
      deliveryStatus === "completed" &&
      ["pending", "awaiting_confirmation"].includes(confirmationStatus)
    );
  };

  const canDoActions = () => {
    const confirmationStatus = paymentSummary?.confirmation_status || "pending";
    return confirmationStatus === "confirmed";
  };

  const calculatedBillableAmount = calculateUnitAwareAmount(
    billableQuantity,
    unit,
    unitPrice
  );
  const paymentVariance =
    paymentSummary.total_paid - paymentSummary.calculated_bill;
  const isOverpaid = paymentVariance > 0;

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

            {/* ✅ NEW: Confirmation status indicator */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500">
                Confirmation Status:
              </span>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  paymentSummary?.confirmation_status === "confirmed"
                    ? "bg-green-100 text-green-800"
                    : paymentSummary?.confirmation_status ===
                      "awaiting_confirmation"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {paymentSummary?.confirmation_status
                  ?.replace("_", " ")
                  .toUpperCase() || "PENDING"}
              </span>
            </div>
          </div>
        </div>

        {/* ✅ ENHANCED: Smart action buttons in header */}
        <div className="flex items-center space-x-3">
          {/* Confirmation button if needed */}
          {canConfirmBilling() && (
            <button
              onClick={handleConfirmForBilling}
              disabled={submitting}
              className="bg-yellow-600 text-white px-6 py-2 rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Confirming...
                </>
              ) : (
                <>
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
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Confirm for Billing
                </>
              )}
            </button>
          )}
          {/* Quick Status */}
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
              paymentSummary?.payment_status || "unknown"
            )}`}
          >
            {getStatusText(paymentSummary?.payment_status || "unknown")}
          </span>
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
                    <span className="text-purple-100">Actual Quantity:</span>
                    <span className="text-white font-medium">
                      {formatQuantityWithUnit(billableQuantity, unit)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-100">Unit Price:</span>
                    <span className="text-white font-medium">
                      {formatUnitPrice(unitPrice, unit)}
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
                    <span className="text-purple-100">
                      Calculated Minimum Bill:
                    </span>
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

            {/* ✅ ENHANCED: Better progress bar with proper colors */}
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

                  {/* 🔥 Enhanced Progress Bar */}
                  <div className="w-full bg-white/20 rounded-full h-4 mb-3 overflow-hidden">
                    <div
                      className={`h-4 rounded-full transition-all duration-500 ${
                        paymentSummary.payment_percentage >= 100
                          ? "bg-green-400"
                          : paymentSummary.payment_percentage > 0
                          ? "bg-blue-400"
                          : "bg-gray-400"
                      }`}
                      style={{
                        width: `${Math.min(
                          Math.max(paymentSummary.payment_percentage, 0),
                          100
                        )}%`,
                      }}
                    ></div>
                  </div>

                  {/* Payment Status Indicator */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          paymentSummary.remaining_amount === 0
                            ? "bg-green-400"
                            : paymentSummary.remaining_amount < 0
                            ? "bg-blue-400"
                            : "bg-yellow-400"
                        }`}
                      ></div>
                      <span className="text-purple-100">
                        {paymentSummary.remaining_amount === 0
                          ? "Fully Paid"
                          : paymentSummary.remaining_amount < 0
                          ? "Overpaid"
                          : "Pending"}
                      </span>
                    </div>
                    <span className="text-white font-medium">
                      {paymentSummary.remaining_amount === 0
                        ? "✅"
                        : paymentSummary.remaining_amount < 0
                        ? "💰"
                        : "⏳"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mt-3">
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
      {canConfirmBilling() && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mr-4">
                <svg
                  className="h-6 w-6 text-yellow-600"
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
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                  🚨 Action Required: Confirm DO for Payment Processing
                </h3>
                <div className="text-yellow-700 space-y-1">
                  <p className="font-medium">
                    This Delivery Order is ready for payment processing but
                    needs confirmation first.
                  </p>
                  <div className="text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>
                        DO Status:{" "}
                        <strong>{do_item.status?.toUpperCase()}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span>
                        Confirmation:{" "}
                        <strong>
                          {paymentSummary?.confirmation_status
                            ?.replace("_", " ")
                            .toUpperCase()}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <p className="text-sm mt-2 text-yellow-600">
                    ⚠️ You won't be able to create invoices, record payments, or
                    make adjustments until this DO is confirmed.
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={handleConfirmForBilling}
              disabled={submitting}
              className="bg-yellow-600 text-white px-8 py-3 rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 font-semibold shadow-lg flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Confirming...
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Confirm Now
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ✅ ENHANCED: Success confirmation message */}
      {canDoActions() && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="h-5 w-5 text-green-600"
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
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-green-800">
                ✅ DO Confirmed for Payment Processing
              </h4>
              <p className="text-sm text-green-700">
                You can now create invoices, record payments, and make
                adjustments.
              </p>
            </div>
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
                {/* ✅ NEW: Lock icon for disabled actions */}
                {tab.key !== "overview" && !canDoActions() && (
                  <svg
                    className="w-3 h-3 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
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

              {canConfirmBilling() && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-r-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-semibold text-yellow-800 mb-2">
                        🔐 Confirmation Required
                      </h4>
                      <p className="text-yellow-700 mb-4">
                        This DO must be confirmed before you can perform any
                        payment actions.
                      </p>
                      <div className="text-sm text-yellow-600 space-y-1">
                        <div>• Create invoices</div>
                        <div>• Record payments</div>
                        <div>• Make price adjustments</div>
                      </div>
                    </div>
                    <button
                      onClick={handleConfirmForBilling}
                      disabled={submitting}
                      className="bg-yellow-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-yellow-700 transition-colors disabled:opacity-50 shadow-lg"
                    >
                      {submitting ? "Confirming..." : "Confirm DO"}
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {/* Create Invoice Card */}
                <div
                  onClick={() => {
                    if (!canDoActions()) {
                      toast.error("Please confirm DO for billing first!");
                      return;
                    }
                    setShowInvoiceForm(true);
                  }}
                  className={`cursor-pointer p-6 border-2 border-dashed rounded-lg transition-all ${
                    canDoActions()
                      ? "border-blue-300 hover:border-blue-400 hover:bg-blue-50"
                      : "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                  }`}
                  role="button"
                  tabIndex={0}
                >
                  <div className="text-center">
                    <div className="relative">
                      <svg
                        className={`h-12 w-12 mx-auto mb-3 ${
                          canDoActions() ? "text-blue-500" : "text-gray-400"
                        }`}
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
                      {!canDoActions() && (
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center">
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <h4
                      className={`font-medium ${
                        canDoActions() ? "text-gray-900" : "text-gray-500"
                      }`}
                    >
                      Create Invoice
                    </h4>
                    <p
                      className={`text-sm ${
                        canDoActions() ? "text-gray-600" : "text-gray-400"
                      }`}
                    >
                      {canDoActions()
                        ? "Generate new invoice"
                        : "Requires confirmation"}
                    </p>
                  </div>
                </div>

                {/* Record Payment Card */}
                <div
                  onClick={() => {
                    if (!canDoActions) {
                      toast.error(
                        "Please confirm for billing first before recording payment!"
                      );
                      return;
                    }
                    setShowPaymentForm(true);
                  }}
                  className={`cursor-pointer p-6 border-2 border-dashed border-green-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition-all ${
                    !canDoActions || doData.invoices.length === 0
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                  role="button"
                  tabIndex={0}
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
                </div>

                {/* Price Adjustment Card */}
                <div
                  onClick={() => {
                    if (!canDoActions) {
                      toast.error(
                        "Please confirm for billing first before adjustment!"
                      );
                      return;
                    }
                    setShowAdjustmentForm(true);
                  }}
                  className={`cursor-pointer p-6 border-2 border-dashed border-yellow-300 rounded-lg hover:border-yellow-400 hover:bg-yellow-50 transition-all ${
                    !canDoActions ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  role="button"
                  tabIndex={0}
                >
                  <div className="text-center">
                    <div className="relative">
                      <svg
                        className={`h-12 w-12 mx-auto mb-3 ${
                          canDoActions() ? "text-yellow-500" : "text-gray-400"
                        }`}
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
                      {!canDoActions() && (
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center">
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <h4
                      className={`font-medium ${
                        canDoActions() ? "text-gray-900" : "text-gray-500"
                      }`}
                    >
                      Price Adjustment
                    </h4>
                    <p
                      className={`text-sm ${
                        canDoActions() ? "text-gray-600" : "text-gray-400"
                      }`}
                    >
                      {canDoActions()
                        ? "Modify pricing"
                        : "Requires confirmation"}
                    </p>
                  </div>
                </div>
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
                  onClick={() => {
                    if (!canDoActions()) {
                      toast.error("Please confirm DO for billing first!");
                      return;
                    }
                    setShowInvoiceForm(true);
                  }}
                  disabled={!canDoActions()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Create Invoice
                </button>
              </div>

              {!canDoActions() && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <span className="text-gray-600">
                      Invoice management is locked until DO is confirmed for
                      billing.
                    </span>
                  </div>
                </div>
              )}

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
                          <span className="font-medium text-gray-600">
                            {formatCurrency(invoice.pph_amount)}
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
                  onClick={() => {
                    if (!canDoActions()) {
                      toast.error("Please confirm DO for billing first!");
                      return;
                    }
                    if (doData.invoices.length === 0) {
                      toast.error(
                        "Create an invoice first before recording payment!"
                      );
                      return;
                    }
                    setShowPaymentForm(true);
                  }}
                  disabled={!canDoActions() || doData.invoices.length === 0}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {!canDoActions() || doData.invoices.length === 0 ? (
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
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  ) : (
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
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                  )}
                  + Record Payment
                </button>
              </div>

              {/* ✅ ENHANCED: Smart disabled state warnings */}
              {!canDoActions() && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <div>
                      <p className="font-medium text-gray-700">
                        Payment Recording Locked
                      </p>
                      <p className="text-sm text-gray-600">
                        Please confirm DO for billing to enable payment
                        recording.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ✅ ENHANCED: Invoice requirement warning */}
              {canDoActions() && doData.invoices.length === 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-blue-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div>
                      <p className="font-medium text-blue-700">
                        Invoice Required
                      </p>
                      <p className="text-sm text-blue-600">
                        Create an invoice first before recording payments.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowInvoiceForm(true)}
                      className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Create Invoice
                    </button>
                  </div>
                </div>
              )}

              {doData.payments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="relative">
                    <svg
                      className={`h-16 w-16 mx-auto mb-4 ${
                        canDoActions() && doData.invoices.length > 0
                          ? "text-gray-400"
                          : "text-gray-300"
                      }`}
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
                    {/* ✅ ENHANCED: Lock overlay for disabled state */}
                    {(!canDoActions() || doData.invoices.length === 0) && (
                      <div className="absolute top-4 right-1/2 transform translate-x-1/2">
                        <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Payments Recorded
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {!canDoActions()
                      ? "Payment recording is locked until DO is confirmed for billing."
                      : doData.invoices.length === 0
                      ? "Create an invoice first to enable payment recording."
                      : "Record payments received from the customer."}
                  </p>
                  <button
                    onClick={() => {
                      if (!canDoActions()) {
                        toast.error("Please confirm DO for billing first!");
                        return;
                      }
                      if (doData.invoices.length === 0) {
                        toast.error(
                          "Create an invoice first before recording payment!"
                        );
                        return;
                      }
                      setShowPaymentForm(true);
                    }}
                    disabled={!canDoActions() || doData.invoices.length === 0}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {!canDoActions()
                      ? "Locked - Confirm DO First"
                      : doData.invoices.length === 0
                      ? "Create Invoice First"
                      : "Record First Payment"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* ✅ ENHANCED: Payment summary stats */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {doData.payments.length}
                        </div>
                        <div className="text-sm text-green-700">
                          Total Payments
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(
                            doData.payments.reduce(
                              (sum, p) => sum + p.payment_amount,
                              0
                            )
                          )}
                        </div>
                        <div className="text-sm text-green-700">
                          Total Received
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(
                            paymentSummary.total_invoiced -
                              doData.payments.reduce(
                                (sum, p) => sum + p.payment_amount,
                                0
                              )
                          )}
                        </div>
                        <div className="text-sm text-green-700">
                          Outstanding
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ✅ ENHANCED: Payment cards with better visual design */}
                  {doData.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200 bg-white"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                            <div className="text-2xl">
                              {getPaymentTypeIcon(payment.payment_type)}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-bold text-xl text-gray-900">
                              {formatCurrency(payment.payment_amount)}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {payment.payment_type.charAt(0).toUpperCase() +
                                payment.payment_type.slice(1)}{" "}
                              •{" "}
                              {new Date(
                                payment.payment_date
                              ).toLocaleDateString("id-ID")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-500">
                            Recorded:{" "}
                            {new Date(payment.created_at).toLocaleDateString(
                              "id-ID"
                            )}
                          </div>
                          {/* ✅ ENHANCED: Payment status badge */}
                          <div className="mt-1">
                            <span className="inline-flex px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                              ✅ Confirmed
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ✅ ENHANCED: Better grid layout for payment details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                        {payment.payment_reference && (
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="text-gray-600 font-medium">
                              Reference:
                            </span>
                            <p className="font-semibold text-gray-900 mt-1">
                              {payment.payment_reference}
                            </p>
                          </div>
                        )}
                        {payment.bank_account && (
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <span className="text-gray-600 font-medium">
                              Bank Account:
                            </span>
                            <p className="font-semibold text-gray-900 mt-1">
                              {payment.bank_account}
                            </p>
                          </div>
                        )}
                      </div>

                      {payment.notes && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                          <div className="font-medium text-blue-800 mb-1">
                            Payment Notes:
                          </div>
                          <p className="text-blue-700">{payment.notes}</p>
                        </div>
                      )}

                      {payment.attachment_url && (
                        <div className="mt-4 flex items-center justify-between">
                          <a
                            href={payment.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                          >
                            <svg
                              className="h-4 w-4 mr-2"
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
                          {/* ✅ ENHANCED: Action buttons for payment */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                // Handle edit payment
                                console.log("Edit payment:", payment.id);
                              }}
                              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                // Handle delete payment
                                console.log("Delete payment:", payment.id);
                              }}
                              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
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
                  onClick={() => {
                    if (!canDoActions()) {
                      toast.error("Please confirm DO for billing first!");
                      return;
                    }
                    setShowAdjustmentForm(true);
                  }}
                  disabled={!canDoActions()}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {!canDoActions() ? (
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
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  ) : (
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
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                  )}
                  + Create Adjustment
                </button>
              </div>

              {/* ✅ ENHANCED: Smart disabled state warnings */}
              {!canDoActions() && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <div>
                      <p className="font-medium text-gray-700">
                        Price Adjustments Locked
                      </p>
                      <p className="text-sm text-gray-600">
                        Please confirm DO for billing to enable price
                        adjustments.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {doData.adjustments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="relative">
                    <svg
                      className={`h-16 w-16 mx-auto mb-4 ${
                        canDoActions() ? "text-gray-400" : "text-gray-300"
                      }`}
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
                    {/* ✅ ENHANCED: Lock overlay for disabled state */}
                    {!canDoActions() && (
                      <div className="absolute top-4 right-1/2 transform translate-x-1/2">
                        <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Adjustments
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {!canDoActions()
                      ? "Price adjustments are locked until DO is confirmed for billing."
                      : "Create adjustments for special cases like accidents or additional charges."}
                  </p>
                  <button
                    onClick={() => {
                      if (!canDoActions()) {
                        toast.error("Please confirm DO for billing first!");
                        return;
                      }
                      setShowAdjustmentForm(true);
                    }}
                    disabled={!canDoActions()}
                    className="bg-yellow-600 text-white px-6 py-3 rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {!canDoActions()
                      ? "Locked - Confirm DO First"
                      : "Create First Adjustment"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* ✅ ENHANCED: Adjustment summary stats */}
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">
                          {doData.adjustments.length}
                        </div>
                        <div className="text-sm text-yellow-700">
                          Total Adjustments
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">
                          {formatCurrency(
                            doData.adjustments.reduce(
                              (sum, adj) => sum + adj.adjustment_amount,
                              0
                            )
                          )}
                        </div>
                        <div className="text-sm text-yellow-700">
                          Total Adjustments
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">
                          {formatCurrency(
                            doData.adjustments.reduce(
                              (sum, adj) => sum + adj.final_amount,
                              0
                            )
                          )}
                        </div>
                        <div className="text-sm text-yellow-700">
                          Final Amount
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ✅ ENHANCED: Adjustment cards with better visual design */}
                  {doData.adjustments.map((adjustment) => (
                    <div
                      key={adjustment.id}
                      className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200 bg-white"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                            <svg
                              className="w-6 h-6 text-yellow-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </div>
                          <div>
                            <h4 className="font-bold text-lg text-gray-900 capitalize">
                              {safeReplace(
                                adjustment?.adjustment_type,
                                "_",
                                " "
                              ) || "Unknown"}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {new Date(
                                adjustment.created_at
                              ).toLocaleDateString("id-ID")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {/* ✅ ENHANCED: Adjustment type badge */}
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              adjustment.adjustment_amount > 0
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {adjustment.adjustment_amount > 0
                              ? "📈 Increase"
                              : "📉 Decrease"}
                          </span>
                        </div>
                      </div>

                      {/* ✅ ENHANCED: Better financial overview with visual cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                          <span className="text-gray-600 font-medium block mb-2">
                            Original Amount
                          </span>
                          <p className="font-bold text-xl text-gray-900">
                            {formatCurrency(adjustment.original_amount)}
                          </p>
                        </div>
                        <div
                          className={`p-4 rounded-lg text-center ${
                            adjustment.adjustment_amount > 0
                              ? "bg-green-50"
                              : "bg-red-50"
                          }`}
                        >
                          <span className="text-gray-600 font-medium block mb-2">
                            Adjustment
                          </span>
                          <p
                            className={`font-bold text-xl ${
                              adjustment.adjustment_amount > 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {adjustment.adjustment_amount > 0 ? "+" : ""}
                            {formatCurrency(adjustment.adjustment_amount)}
                          </p>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-lg text-center">
                          <span className="text-gray-600 font-medium block mb-2">
                            Final Amount
                          </span>
                          <p className="font-bold text-xl text-blue-600">
                            {formatCurrency(adjustment.final_amount)}
                          </p>
                        </div>
                      </div>

                      {/* ✅ ENHANCED: Better reason display */}
                      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="font-medium text-yellow-800 mb-2">
                          Adjustment Reason:
                        </div>
                        <p className="text-yellow-700 text-sm leading-relaxed">
                          {adjustment.reason}
                        </p>
                      </div>

                      {/* ✅ ENHANCED: Action buttons for adjustment */}
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          onClick={() => {
                            // Handle edit adjustment
                            console.log("Edit adjustment:", adjustment.id);
                          }}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            // Handle delete adjustment
                            console.log("Delete adjustment:", adjustment.id);
                          }}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                        >
                          Delete
                        </button>
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
