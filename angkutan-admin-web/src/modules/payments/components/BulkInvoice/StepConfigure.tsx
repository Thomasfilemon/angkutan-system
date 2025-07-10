import React, { useState, useEffect } from "react";

interface StepConfigureProps {
  selectedDOs: number[];
  totalAmount: number;
  customer: string;
  onConfigChange: (config: InvoiceConfig) => void;
  onNext: () => void;
  onBack: () => void;
}

interface InvoiceConfig {
  invoice_number: string;
  pph_percentage: number;
  due_date: string;
  notes: string;
}

const StepConfigure: React.FC<StepConfigureProps> = ({
  selectedDOs,
  totalAmount,
  customer,
  onConfigChange,
  onNext,
  onBack,
}) => {
  const [config, setConfig] = useState<InvoiceConfig>({
    invoice_number: "",
    pph_percentage: 0.5,
    due_date: "",
    notes: "",
  });

  const [calculatedAmounts, setCalculatedAmounts] = useState({
    gross: totalAmount,
    pph: 0,
    net: totalAmount,
  });

  useEffect(() => {
    // Auto-generate invoice number
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const autoInvoiceNumber = `BULK/${year}/${month}/AUTO`;

    // Auto-generate due date (30 days from now)
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const autoNotes = `Bulk invoice for ${customer} - ${selectedDOs.length} delivery orders`;

    const initialConfig = {
      ...config,
      invoice_number: autoInvoiceNumber,
      due_date: dueDate.toISOString().split("T")[0],
      notes: autoNotes,
    };

    setConfig(initialConfig);
    onConfigChange(initialConfig);
  }, [selectedDOs, customer, totalAmount]);

  useEffect(() => {
    // Recalculate amounts when PPH percentage changes
    const pphAmount = (totalAmount * config.pph_percentage) / 100;
    const netAmount = totalAmount - pphAmount;

    setCalculatedAmounts({
      gross: totalAmount,
      pph: pphAmount,
      net: netAmount,
    });
  }, [config.pph_percentage, totalAmount]);

  const handleConfigChange = (
    field: keyof InvoiceConfig,
    value: string | number
  ) => {
    const updatedConfig = { ...config, [field]: value };
    setConfig(updatedConfig);
    onConfigChange(updatedConfig);
  };

  const validateConfig = () => {
    if (!config.invoice_number.trim()) {
      alert("Invoice number is required");
      return false;
    }
    if (config.pph_percentage < 0 || config.pph_percentage > 100) {
      alert("PPH percentage must be between 0-100%");
      return false;
    }
    if (!config.due_date) {
      alert("Due date is required");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateConfig()) {
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Configure Bulk Invoice
        </h3>
        <p className="text-sm text-gray-600">
          Set invoice details and tax configuration for {selectedDOs.length}{" "}
          delivery orders.
        </p>
      </div>

      {/* Selection Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600">Customer</div>
            <div className="font-medium">{customer}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Delivery Orders</div>
            <div className="font-medium">{selectedDOs.length} selected</div>
          </div>
        </div>
      </div>

      {/* Invoice Configuration Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column - Invoice Details */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invoice Number
            </label>
            <input
              type="text"
              value={config.invoice_number}
              onChange={(e) =>
                handleConfigChange("invoice_number", e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., BULK/2025/07/001"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty for auto-generation
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date
            </label>
            <input
              type="date"
              value={config.due_date}
              onChange={(e) => handleConfigChange("due_date", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PPH Percentage (%)
            </label>
            <input
              type="number"
              value={config.pph_percentage}
              onChange={(e) =>
                handleConfigChange(
                  "pph_percentage",
                  parseFloat(e.target.value) || 0
                )
              }
              step="0.01"
              min="0"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={config.notes}
              onChange={(e) => handleConfigChange("notes", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Additional notes for this bulk invoice..."
            />
          </div>
        </div>

        {/* Right Column - Financial Summary */}
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-3">
              Financial Summary
            </h4>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-blue-700">Gross Amount:</span>
                <span className="font-medium text-blue-900">
                  Rp {calculatedAmounts.gross.toLocaleString("id-ID")}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-blue-700">
                  PPH {config.pph_percentage}%:
                </span>
                <span className="font-medium text-red-600">
                  -Rp {calculatedAmounts.pph.toLocaleString("id-ID")}
                </span>
              </div>

              <div className="border-t border-blue-200 pt-3">
                <div className="flex justify-between">
                  <span className="text-blue-700 font-medium">Net Amount:</span>
                  <span className="font-semibold text-blue-900 text-lg">
                    Rp {calculatedAmounts.net.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Preview Invoice Details */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Invoice Preview</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Invoice Number:</span>
                <span className="font-medium">
                  {config.invoice_number || "Auto-generated"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Issue Date:</span>
                <span className="font-medium">
                  {new Date().toLocaleDateString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Due Date:</span>
                <span className="font-medium">
                  {config.due_date
                    ? new Date(config.due_date).toLocaleDateString("id-ID")
                    : "Not set"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Customer:</span>
                <span className="font-medium">{customer}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-6 border-t">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Review & Create Invoice
        </button>
      </div>
    </div>
  );
};

export default StepConfigure;
