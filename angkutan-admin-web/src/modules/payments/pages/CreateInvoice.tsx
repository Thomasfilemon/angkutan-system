import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiClient from "../../../api/axiosConfig";
import toast from "react-hot-toast";

interface DeliveryOrder {
  id: number;
  do_number: string;
  customer_name: string;
  item_name: string;
  actual_load_quantity: string;
  unit: string;
  unit_price: number;
  financial_summary: {
    actual_total_amount: number;
    ongkosan: number;
    net_profit: number;
  };
  driver: {
    driverProfile: {
      full_name: string;
    };
  };
  vehicle: {
    license_plate: string;
    type: string;
  };
}

interface ValidationErrors {
  [key: string]: string;
}

const CreateInvoice: React.FC = () => {
  const { doId } = useParams<{ doId: string }>();
  const navigate = useNavigate();

  const [doData, setDoData] = useState<DeliveryOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {}
  );
  const [showPreview, setShowPreview] = useState(true); // New: Toggle for preview

  // Form state - status hidden, defaults to 'issued' on submit
  const [form, setForm] = useState({
    invoice_number: "",
    invoice_date: new Date().toISOString().split("T")[0],
    invoice_amount: 0,
    due_date: "",
    pph_percentage: 0.5,
    notes: "",
  });

  // Auto-generate invoice number
  const generateInvoiceNumber = (doNumber: string) => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const doSuffix = doNumber.split("-").pop() || "001";
    return `INV/${year}/${month}/${doSuffix}`;
  };

  // Fetch DO data
  useEffect(() => {
    const fetchDO = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(`/delivery-orders/${doId}`);
        const data = res.data.data;

        setDoData(data);

        const actualAmount =
          data.financial_summary?.actual_total_amount ||
          data.ongkosan ||
          data.total_amount ||
          0;

        const defaultDueDate = new Date();
        defaultDueDate.setDate(defaultDueDate.getDate() + 30);
        const formattedDue = defaultDueDate.toISOString().split("T")[0];

        setForm((prev) => ({
          ...prev,
          invoice_number: generateInvoiceNumber(data.do_number),
          invoice_amount: Number(actualAmount),
          due_date: formattedDue, // Auto-suggest +30 days
        }));
      } catch (err: any) {
        setError(
          err.response?.data?.message || "Failed to fetch delivery order"
        );
      } finally {
        setLoading(false);
      }
    };

    if (doId) {
      fetchDO();
    }
  }, [doId]);

  // Handle back navigation
  const handleBack = () => {
    navigate("/payments/deliveries");
  };

  // Handle input change with smarter PPH/amount handling
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    let newValue: number | string = value;

    if (name === "invoice_amount" || name === "pph_percentage") {
      newValue = parseFloat(value) || 0;
      if (name === "pph_percentage" && (newValue < 0 || newValue > 100)) {
        return; // Prevent invalid input
      }
    }

    setForm((prev) => ({ ...prev, [name]: newValue }));

    // Clear validation error
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Dynamic calculations
  const { pphAmount, netAmount } = useMemo(() => {
    const gross = Number(form.invoice_amount) || 0;
    const pct = Number(form.pph_percentage) || 0;
    const pph = (gross * pct) / 100;
    const net = gross - pph;
    return {
      pphAmount: isNaN(pph) ? 0 : pph,
      netAmount: isNaN(net) ? 0 : net,
    };
  }, [form.invoice_amount, form.pph_percentage]);

  // Form validation
  const validateForm = (): ValidationErrors => {
    const errors: ValidationErrors = {};

    if (!form.invoice_number.trim()) {
      errors.invoice_number = "Invoice number is required";
    }

    if (!form.invoice_date) {
      errors.invoice_date = "Invoice date is required";
    }

    if (form.invoice_amount <= 0) {
      errors.invoice_amount = "Invoice amount must be greater than 0";
    }

    if (form.pph_percentage < 0 || form.pph_percentage > 100) {
      errors.pph_percentage = "PPh percentage must be between 0 and 100";
    }

    return errors;
  };

  // Handle submit with confirm if amount changed from DO
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error("Please fix the form errors");
      return;
    }

    // Confirm if invoice_amount differs from DO
    if (
      doData &&
      form.invoice_amount !== doData.financial_summary.actual_total_amount
    ) {
      if (!window.confirm("Invoice amount differs from DO total. Proceed?"))
        return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        delivery_order_id: Number(doId),
        invoice_number: form.invoice_number,
        invoice_date: form.invoice_date,
        invoice_amount: form.invoice_amount,
        due_date: form.due_date || null,
        pph_percentage: form.pph_percentage,
        pph_amount: pphAmount,
        net_amount: netAmount,
        status: "issued", // FLEX: Fixed to 'issued' per your flow
        notes: form.notes || null,
      };

      await apiClient.post(
        `/payments/delivery-orders/${doId}/invoices`,
        payload
      );
      toast.success("Invoice created successfully!");
      navigate("/payments/deliveries", {
        state: { message: "Invoice created successfully!" },
      });
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message || "Failed to create invoice";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error && !doData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>Error: {error}</p>
          <button
            onClick={handleBack}
            className="mt-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Back to Delivery List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors group"
        >
          <svg
            className="w-5 h-5 group-hover:-translate-x-1 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span className="font-medium">Back to Delivery List</span>
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Create Invoice</h1>
      </div>

      {/* Delivery Order Context Card - Added skeleton loading */}
      {doData ? (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-8 shadow-sm transition-all duration-300 hover:shadow-md">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Delivery Order Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/50 rounded-lg p-3">
              <span className="text-xs text-gray-500 block mb-1">
                DO Number
              </span>
              <span className="font-semibold text-gray-800">
                {doData.do_number}
              </span>
            </div>
            <div className="bg-white/50 rounded-lg p-3">
              <span className="text-xs text-gray-500 block mb-1">Customer</span>
              <span className="font-semibold text-gray-800">
                {doData.customer_name}
              </span>
            </div>
            <div className="bg-white/50 rounded-lg p-3">
              <span className="text-xs text-gray-500 block mb-1">Item</span>
              <span className="font-semibold text-gray-800">
                {doData.item_name}
              </span>
            </div>
            <div className="bg-white/50 rounded-lg p-3">
              <span className="text-xs text-gray-500 block mb-1">
                Quantity & Price
              </span>
              <span className="font-semibold text-gray-800">
                {doData.actual_load_quantity} {doData.unit}
              </span>
              <span className="text-sm text-gray-600 block mt-1">
                Rp{" "}
                {parseFloat(String(doData.unit_price)).toLocaleString("id-ID")}
              </span>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="mt-4 pt-4 border-t border-blue-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center">
                <span className="text-xs text-gray-500 block">
                  Total Amount
                </span>
                <span className="text-lg font-bold text-blue-700">
                  Rp{" "}
                  {doData.financial_summary?.actual_total_amount?.toLocaleString(
                    "id-ID"
                  )}
                </span>
              </div>
              <div className="text-center">
                <span className="text-xs text-gray-500 block">Ongkosan</span>
                <span className="text-lg font-semibold text-green-600">
                  Rp{" "}
                  {doData.financial_summary?.ongkosan?.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="text-center">
                <span className="text-xs text-gray-500 block">Net Profit</span>
                <span className="text-lg font-semibold text-purple-600">
                  Rp{" "}
                  {doData.financial_summary?.net_profit?.toLocaleString(
                    "id-ID"
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-pulse bg-gray-200 rounded-xl p-6 mb-8 h-48" /> // Skeleton
      )}

      {/* Invoice Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-xl rounded-xl border border-gray-100 overflow-hidden"
      >
        <div className="p-8">
          {/* Basic Information */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">
              Invoice Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="relative group">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Number <span className="text-red-500">*</span>
                  <span
                    className="ml-1 text-gray-400 cursor-help"
                    title="Auto-generated, but editable."
                  >
                    ℹ️
                  </span>
                </label>
                <input
                  type="text"
                  name="invoice_number"
                  value={form.invoice_number}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 ${
                    validationErrors.invoice_number
                      ? "border-red-300 bg-red-50 animate-shake"
                      : "border-gray-300"
                  }`}
                  placeholder="INV/2025/001"
                  required
                />
                {validationErrors.invoice_number && (
                  <p className="text-red-500 text-xs mt-1">
                    {validationErrors.invoice_number}
                  </p>
                )}
              </div>

              <div className="relative group">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Date <span className="text-red-500">*</span>
                  <span
                    className="ml-1 text-gray-400 cursor-help"
                    title="Date the invoice is issued."
                  >
                    ℹ️
                  </span>
                </label>
                <input
                  type="date"
                  name="invoice_date"
                  value={form.invoice_date}
                  onChange={(e) => {
                    handleChange(e);
                    // Auto-update due_date suggestion
                    const newDate = new Date(e.target.value);
                    newDate.setDate(newDate.getDate() + 30);
                    setForm((prev) => ({
                      ...prev,
                      due_date: newDate.toISOString().split("T")[0],
                    }));
                  }}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 ${
                    validationErrors.invoice_date
                      ? "border-red-300 bg-red-50 animate-shake"
                      : "border-gray-300"
                  }`}
                  required
                />
                {validationErrors.invoice_date && (
                  <p className="text-red-500 text-xs mt-1">
                    {validationErrors.invoice_date}
                  </p>
                )}
              </div>

              <div className="relative group">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date
                  <span
                    className="ml-1 text-gray-400 cursor-help"
                    title="Auto-suggested +30 days, editable."
                  >
                    ℹ️
                  </span>
                </label>
                <input
                  type="date"
                  name="due_date"
                  value={form.due_date}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
                />
              </div>
            </div>
          </div>

          {/* Financial Details */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">
              Financial Details
            </h3>
            <div className="bg-gray-50 rounded-xl p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="relative group">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invoice Amount (Gross){" "}
                    <span className="text-red-500">*</span>
                    <span
                      className="ml-1 text-gray-400 cursor-help"
                      title="Pre-filled from DO, but adjustable."
                    >
                      ℹ️
                    </span>
                  </label>
                  <input
                    type="number"
                    name="invoice_amount"
                    value={form.invoice_amount}
                    onChange={handleChange}
                    min={0}
                    step="0.01"
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 ${
                      validationErrors.invoice_amount
                        ? "border-red-300 bg-red-50 animate-shake"
                        : "border-gray-300 bg-white"
                    }`}
                    required
                  />
                  {validationErrors.invoice_amount && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.invoice_amount}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Rp {form.invoice_amount.toLocaleString("id-ID")}
                  </p>
                </div>

                <div className="relative group">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PPh Percentage (%)
                    <span
                      className="ml-1 text-gray-400 cursor-help"
                      title="Enter any value 0-100 (decimals OK). Defaults to 0.5."
                    >
                      ℹ️
                    </span>
                  </label>
                  <input
                    type="number"
                    name="pph_percentage"
                    value={form.pph_percentage}
                    onChange={handleChange}
                    min={0}
                    max={100}
                    step="0.01"
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 bg-white ${
                      validationErrors.pph_percentage
                        ? "border-red-300 bg-red-50 animate-shake"
                        : "border-gray-300"
                    }`}
                  />
                  {validationErrors.pph_percentage && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.pph_percentage}
                    </p>
                  )}
                </div>
              </div>

              {/* Calculation Preview - Added animations */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white rounded-lg border border-gray-200 transition-all duration-300 hover:shadow-inner">
                <div className="text-center">
                  <span className="block text-xs text-gray-500 mb-1">
                    Gross Amount
                  </span>
                  <span className="text-lg font-semibold text-blue-600 animate-fadeIn">
                    Rp {form.invoice_amount.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="text-center">
                  <span className="block text-xs text-gray-500 mb-1">
                    PPh Amount ({form.pph_percentage}%)
                  </span>
                  <span className="text-lg font-semibold text-yellow-600 animate-fadeIn">
                    Rp {pphAmount.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="text-center">
                  <span className="block text-xs text-gray-500 mb-1">
                    Net Amount
                  </span>
                  <span className="text-xl font-bold text-green-600 animate-fadeIn">
                    Rp {netAmount.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">
              Additional Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                  <span
                    className="ml-1 text-gray-400 cursor-help"
                    title="Any additional info or terms."
                  >
                    ℹ️
                  </span>
                </label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 resize-none"
                  placeholder="Additional notes or terms..."
                />
              </div>
            </div>
          </div>

          {/* Invoice Preview - New Section */}
          <div className="mb-8">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="w-full flex justify-between items-center px-4 py-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <h3 className="text-lg font-semibold text-gray-800">
                Invoice Preview
              </h3>
              <svg
                className={`w-5 h-5 transition-transform ${
                  showPreview ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {showPreview && (
              <div className="mt-4 p-6 bg-white border border-gray-200 rounded-lg shadow-inner animate-fadeIn">
                <h4 className="text-md font-bold mb-2">
                  {form.invoice_number}
                </h4>
                <p className="text-sm text-gray-600 mb-1">
                  Date: {form.invoice_date}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  Due: {form.due_date || "N/A"}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  Gross: Rp {form.invoice_amount.toLocaleString("id-ID")}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  PPH ({form.pph_percentage}%): Rp{" "}
                  {pphAmount.toLocaleString("id-ID")}
                </p>
                <p className="text-md font-semibold text-green-600">
                  Net: Rp {netAmount.toLocaleString("id-ID")}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Notes: {form.notes || "None"}
                </p>
                <p className="text-xs text-gray-400 mt-4 italic">
                  This is a preview. Submit to create.
                </p>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg animate-fadeIn">
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="bg-gray-50 px-8 py-6 rounded-b-xl flex justify-end gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {saving ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Creating...
              </div>
            ) : (
              "Create Invoice"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateInvoice;
