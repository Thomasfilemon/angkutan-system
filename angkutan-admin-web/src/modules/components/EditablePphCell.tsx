import React, { useState, useEffect } from "react";
import { paymentsApi } from "../payments/api";

interface EditablePphCellProps {
  invoice: {
    id: number;
    pph_percentage: number;
    pph_amount: number;
    net_amount: number;
    invoice_amount: number;
    status: string;
  };
  onUpdate: (invoiceId: number, updatedData: any) => void;
}

const EditablePphCell: React.FC<EditablePphCellProps> = ({
  invoice,
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(invoice.pph_percentage.toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(invoice.pph_percentage.toString());
  }, [invoice.pph_percentage]);

  const handleSave = async () => {
    const newPct = parseFloat(value);

    if (isNaN(newPct) || newPct < 0 || newPct > 100) {
      setError("PPH percentage must be between 0-100");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await paymentsApi.updateInvoice(invoice.id, {
        pph_percentage: newPct,
      });

      onUpdate(invoice.id, response.data.data);
      setIsEditing(false);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to update PPH percentage"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setValue(invoice.pph_percentage.toString());
    setError(null);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const isDisabled =
    invoice.status === "paid" || invoice.status === "cancelled";

  if (isDisabled) {
    return (
      <div className="text-sm text-gray-500">
        {invoice.pph_percentage}%
        <div className="text-xs text-gray-400">
          Rp {invoice.pph_amount.toLocaleString("id-ID")}
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="space-y-1">
        <div className="flex items-center space-x-1">
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            step="0.01"
            min="0"
            max="100"
            className={`w-16 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? "border-red-300 focus:ring-red-500" : "border-gray-300"
            }`}
            autoFocus
            disabled={loading}
          />
          <span className="text-sm text-gray-500">%</span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            ✓
          </button>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>
    );
  }

  return (
    <div
      className="cursor-pointer hover:bg-blue-50 p-1 rounded group transition-colors"
      onClick={() => setIsEditing(true)}
      title="Click to edit PPH percentage"
    >
      <div className="flex items-center space-x-1">
        <span className="text-sm font-medium">{invoice.pph_percentage}%</span>
        <svg
          className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
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
      <div className="text-xs text-gray-500">
        Rp {invoice.pph_amount.toLocaleString("id-ID")}
      </div>
    </div>
  );
};

export default EditablePphCell;
