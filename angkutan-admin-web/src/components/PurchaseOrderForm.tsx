// src/components/PurchaseOrderForm.tsx
import React, { useState, useEffect } from "react";

interface PurchaseOrderFormData {
  customer_name: string;
  item_name: string;
  total_quantity: string;
  unit: string;
  unit_price: string;
  load_location: string;
  unload_location: string;
  notes: string;
  recordAsAdjustment?: boolean;
}

interface PurchaseOrderFormProps {
  initialData?: any;
  onSubmit: (data: PurchaseOrderFormData) => void;
  isLoading: boolean;
  buttonText?: string;
  isEditMode?: boolean;
}

const PurchaseOrderForm: React.FC<PurchaseOrderFormProps> = ({
  initialData = {},
  onSubmit,
  isLoading,
  buttonText = "Submit",
  isEditMode = false,
}) => {
  const [formData, setFormData] = useState<PurchaseOrderFormData>({
    customer_name: "",
    item_name: "",
    total_quantity: "",
    unit: "ton",
    unit_price: "",
    load_location: "",
    unload_location: "",
    notes: "",
  });

  const unitOptions = [
    { value: "kilogram", label: "Kilogram (kg)", shortLabel: "kg" },
    { value: "ton", label: "Ton", shortLabel: "ton" },
    { value: "kubik", label: "Kubik (m³)", shortLabel: "m³" },
  ];

  const calculateTotal = () => {
    const quantity = parseFloat(formData.total_quantity) || 0;
    const price = parseFloat(formData.unit_price) || 0;

    switch (formData.unit) {
      case "kilogram":
        return quantity * price;
      case "ton":
        return quantity * 1000 * price; // Convert ton to kg
      case "kubik":
        return quantity * price; // Direct kubik pricing
      default:
        return quantity * price;
    }
  };

  // 🎯 NEW: Get current unit display
  const getCurrentUnitDisplay = () => {
    const selectedUnit = unitOptions.find((u) => u.value === formData.unit);
    return selectedUnit?.shortLabel || formData.unit;
  };

  // 🎯 NEW: Get price conversion display
  const getPriceConversionDisplay = () => {
    const price = parseFloat(formData.unit_price) || 0;

    if (formData.unit === "ton" && price > 0) {
      const pricePerTon = price * 1000;
      return ` (Rp ${pricePerTon.toLocaleString("id-ID")}/ton)`;
    }
    return "";
  };

  // 🎯 NEW: Get pricing strategy explanation
  const getPricingExplanation = () => {
    switch (formData.unit) {
      case "kilogram":
        return "Harga per kilogram";
      case "ton":
        return "Harga per kilogram (akan dikalikan 1000 untuk perhitungan per ton)";
      case "kubik":
        return "Harga per meter kubik";
      default:
        return "";
    }
  };

  // Update form data when initialData changes
  useEffect(() => {
    if (isEditMode && initialData) {
      setFormData({
        customer_name: initialData.customer_name || "",
        item_name: initialData.item_name || "",
        unit: initialData.unit || "ton",
        total_quantity: initialData.total_quantity?.toString() || "",
        unit_price: initialData.unit_price?.toString() || "",
        load_location: initialData.load_location || "",
        unload_location: initialData.unload_location || "",
        notes: initialData.notes || "",
      });
    }
  }, [initialData, isEditMode]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 bg-white p-8 rounded-lg shadow-md"
    >
      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label
            htmlFor="customer_name"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Customer Name *
          </label>
          <input
            type="text"
            id="customer_name"
            name="customer_name"
            value={formData.customer_name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={isLoading}
            placeholder="e.g., PT WIKA BETON"
          />
        </div>

        <div>
          <label
            htmlFor="item_name"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Item Name *
          </label>
          <input
            type="text"
            id="item_name"
            name="item_name"
            value={formData.item_name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={isLoading}
            placeholder="e.g., Abu Batu, Pasir, Split"
          />
        </div>
      </div>

      {/* 🎯 ENHANCED: Quantity, Unit, and Price */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label
            htmlFor="total_quantity"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Total Quantity ({getCurrentUnitDisplay()}) *
          </label>
          <input
            type="number"
            id="total_quantity"
            name="total_quantity"
            value={formData.total_quantity}
            onChange={handleChange}
            step="0.01"
            min="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={isLoading}
            placeholder="e.g., 200.00"
          />
        </div>

        {/* 🎯 NEW: Unit Selector */}
        <div>
          <label
            htmlFor="unit"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Unit *
          </label>
          <select
            id="unit"
            name="unit"
            value={formData.unit}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            disabled={isLoading}
          >
            {unitOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {getPricingExplanation()}
          </p>
        </div>

        {/* 🎯 ENHANCED: Dynamic Unit Price */}
        <div>
          <label
            htmlFor="unit_price"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Unit Price (Rp/{getCurrentUnitDisplay()})
            {getPriceConversionDisplay() && (
              <span className="text-xs text-gray-500 block">
                {getPriceConversionDisplay()}
              </span>
            )}
          </label>
          <input
            type="number"
            id="unit_price"
            name="unit_price"
            value={formData.unit_price}
            onChange={handleChange}
            step="0.01"
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
            placeholder={`e.g., ${
              formData.unit === "kubik"
                ? "150000"
                : formData.unit === "kilogram"
                ? "10000"
                : "10000"
            }`}
          />
          {formData.unit_price && formData.unit === "ton" && (
            <div className="mt-1 text-xs text-blue-600">
              {parseFloat(formData.unit_price) > 0 &&
                `Rp ${(parseFloat(formData.unit_price) * 1000).toLocaleString(
                  "id-ID"
                )}/ton`}
            </div>
          )}
        </div>
      </div>

      {/* 🎯 ENHANCED: Total Amount Display */}
      {formData.total_quantity && formData.unit_price && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">
              Estimated Total Amount:
            </span>
            <div className="text-right">
              <span className="text-lg font-semibold text-blue-600">
                Rp {calculateTotal().toLocaleString("id-ID")}
              </span>
            </div>
          </div>

          {/* 🎯 NEW: Calculation Breakdown */}
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>Quantity:</span>
              <span>
                {formData.total_quantity} {getCurrentUnitDisplay()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Unit Price:</span>
              <span>
                Rp {parseFloat(formData.unit_price).toLocaleString("id-ID")}/
                {getCurrentUnitDisplay()}
              </span>
            </div>
            {formData.unit === "ton" && (
              <div className="flex justify-between text-blue-600">
                <span>Calculation:</span>
                <span>
                  {formData.total_quantity} ton × 1000 kg/ton × Rp{" "}
                  {parseFloat(formData.unit_price).toLocaleString("id-ID")}/kg
                </span>
              </div>
            )}
            {formData.unit === "kubik" && (
              <div className="flex justify-between text-green-600">
                <span>Calculation:</span>
                <span>
                  {formData.total_quantity} m³ × Rp{" "}
                  {parseFloat(formData.unit_price).toLocaleString("id-ID")}/m³
                </span>
              </div>
            )}
            {formData.unit === "kilogram" && (
              <div className="flex justify-between text-purple-600">
                <span>Calculation:</span>
                <span>
                  {formData.total_quantity} kg × Rp{" "}
                  {parseFloat(formData.unit_price).toLocaleString("id-ID")}/kg
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Location Information (Optional) */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Location Information (Optional)
        </h3>
        <p className="text-sm text-gray-600">
          You can leave these empty and specify locations when creating delivery
          orders.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="load_location"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Load Location
            </label>
            <textarea
              id="load_location"
              name="load_location"
              value={formData.load_location}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
              placeholder="e.g., Quarry Jonggol, Bogor"
            />
          </div>

          <div>
            <label
              htmlFor="unload_location"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Unload Location
            </label>
            <textarea
              id="unload_location"
              name="unload_location"
              value={formData.unload_location}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
              placeholder="e.g., Proyek Tol Cibitung, Bekasi"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
          placeholder="Additional notes or requirements..."
        />
      </div>

      {isEditMode && (
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="recordAsAdjustment"
              name="recordAsAdjustment"
              type="checkbox"
              checked={formData.recordAsAdjustment || false}
              onChange={(e) => setFormData({ 
                ...formData, 
                recordAsAdjustment: e.target.checked 
              })}
              className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="recordAsAdjustment" className="font-medium text-gray-700">
              Record as quantity adjustment
            </label>
            <p className="text-gray-500">
              Check this to keep the initial quantity unchanged
            </p>
          </div>
        </div>
      )}


      {/* Submit Button */}
      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-md disabled:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {isLoading ? "Saving..." : buttonText}
        </button>
      </div>
    </form>
  );
};

export default PurchaseOrderForm;
