import React, { useState } from "react";
import { paymentsApi } from "../../payments/api";

interface StepReviewProps {
  selectedDOs: number[];
  totalAmount: number;
  customer: string;
  config: {
    invoice_number: string;
    pph_percentage: number;
    due_date: string;
    notes: string;
  };
  deliveryOrders: Array<{
    id: number;
    do_number: string;
    amount: number;
    item_name: string;
  }>;
  onBack: () => void;
  onSuccess: (invoiceData: any) => void;
}

const StepReview: React.FC<StepReviewProps> = ({
  selectedDOs,
  totalAmount,
  customer,
  config,
  deliveryOrders,
  onBack,
  onSuccess,
}) => {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculatedAmounts = {
    gross: totalAmount,
    pph: (totalAmount * config.pph_percentage) / 100,
    net: totalAmount - (totalAmount * config.pph_percentage) / 100,
  };

  const handleCreateInvoice = async () => {
    try {
      setCreating(true);
      setError(null);

      const payload = {
        do_ids: selectedDOs,
        invoice_number: config.invoice_number,
        pph_percentage: config.pph_percentage,
        due_date: config.due_date,
        notes: config.notes,
      };

      const response = await paymentsApi.createBulkInvoice(payload);
      onSuccess(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create bulk invoice");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Review Bulk Invoice
        </h3>
        <p className="text-sm text-gray-600">
          Please review all details before creating the bulk invoice.
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Invoice Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-medium text-gray-900 mb-4">Invoice Summary</h4>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-600">Invoice Number:</span>
              <div className="font-medium">{config.invoice_number}</div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Customer:</span>
              <div className="font-medium">{customer}</div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Issue Date:</span>
              <div className="font-medium">
                {new Date().toLocaleDateString("id-ID")}
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Due Date:</span>
              <div className="font-medium">
                {new Date(config.due_date).toLocaleDateString("id-ID")}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h5 className="font-medium text-gray-900 mb-3">
              Financial Details
            </h5>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Gross Amount:</span>
                <span className="font-medium">
                  Rp {calculatedAmounts.gross.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  PPH {config.pph_percentage}%:
                </span>
                <span className="font-medium text-red-600">
                  -Rp {calculatedAmounts.pph.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-900">Net Amount:</span>
                  <span className="font-semibold text-green-600">
                    Rp {calculatedAmounts.net.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {config.notes && (
          <div className="mt-4">
            <span className="text-sm text-gray-600">Notes:</span>
            <div className="mt-1 text-sm bg-gray-50 rounded p-3">
              {config.notes}
            </div>
          </div>
        )}
      </div>

      {/* Delivery Orders List */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b">
          <h4 className="font-medium text-gray-900">
            Delivery Orders ({selectedDOs.length})
          </h4>
        </div>

        <div className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
          {deliveryOrders
            .filter((do_) => selectedDOs.includes(do_.id))
            .map((do_) => (
              <div
                key={do_.id}
                className="px-6 py-3 flex justify-between items-center"
              >
                <div>
                  <div className="font-medium text-sm">{do_.do_number}</div>
                  <div className="text-xs text-gray-500">{do_.item_name}</div>
                </div>
                <div className="text-sm font-medium">
                  Rp {do_.amount.toLocaleString("id-ID")}
                </div>
              </div>
            ))}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t">
          <div className="flex justify-between font-medium">
            <span>Total Amount:</span>
            <span>Rp {totalAmount.toLocaleString("id-ID")}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-6 border-t">
        <button
          onClick={onBack}
          disabled={creating}
          className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={handleCreateInvoice}
          disabled={creating}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center"
        >
          {creating && (
            <svg
              className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          )}
          {creating ? "Creating Invoice..." : "Create Bulk Invoice"}
        </button>
      </div>
    </div>
  );
};

export default StepReview;
