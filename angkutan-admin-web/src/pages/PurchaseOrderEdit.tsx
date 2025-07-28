// src/pages/PurchaseOrderEdit.tsx
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import apiClient from "../api/axiosConfig";
import toast from "react-hot-toast";

interface PurchaseOrderData {
  id: number;
  po_number: string;
  customer_name: string;
  item_name: string;
  total_quantity: number;
  unit: string;
  load_location?: string;
  unload_location?: string;
  notes?: string;
  status: string;
  order_date: string;
  created_at: string;
}

interface ValidationErrors {
  [key: string]: string;
}

const PurchaseOrderEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [poData, setPOData] = useState<PurchaseOrderData | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {}
  );
  const [showPreview, setShowPreview] = useState(true);

  // Form states (pre-filled on load)
  const [customerName, setCustomerName] = useState("");
  const [itemsInput, setItemsInput] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [unit, setUnit] = useState("ton");
  const [loadLocation, setLoadLocation] = useState("");
  const [unloadLocation, setUnloadLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [orderDate, setOrderDate] = useState("");

  // Suggested items
  const suggestedItems = [
    "Pasir Silika",
    "Batu Split",
    "Semen",
    "Gravel",
    "Sand",
  ];

  // Unit options
  const unitOptions = [
    {
      value: "kilogram",
      label: "Kilogram (kg)",
      shortLabel: "kg",
      step: 1,
      explanation: "Weight-based per kg",
    },
    {
      value: "ton",
      label: "Ton",
      shortLabel: "ton",
      step: 0.01,
      explanation: "Weight-based per ton",
    },
    {
      value: "kubik",
      label: "Kubik (m³)",
      shortLabel: "m³",
      step: 0.01,
      explanation: "Volume-based per m³",
    },
  ];

  // Fetch PO data
  useEffect(() => {
    const fetchPO = async () => {
      try {
        setIsPageLoading(true);
        setError(null);
        const response = await apiClient.get(`/purchase-orders/${id}`);
        const data = response.data?.data || response.data;

        if (!data) {
          throw new Error("No purchase order data received");
        }

        if (!data.unit) {
          console.warn('PO missing unit, defaulting to "ton"');
          data.unit = "ton";
        }

        setPOData(data);

        // Pre-fill form
        setCustomerName(data.customer_name || "");
        setItems(
          data.item_name
            ? data.item_name.split(", ").map((i: string) => i.trim())
            : []
        );
        setTotalQuantity(data.total_quantity || 0);
        setUnit(data.unit);
        setLoadLocation(data.load_location || "");
        setUnloadLocation(data.unload_location || "");
        setNotes(data.notes || "");
        setOrderDate(new Date(data.order_date).toISOString().split("T")[0]);
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          "Failed to load PO data.";
        setError(errorMessage);
      } finally {
        setIsPageLoading(false);
      }
    };

    if (id) {
      fetchPO();
    }
  }, [id]);

  // Smart item handling
  const handleItemsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "," || e.key === "Enter") {
      e.preventDefault();
      const newItem = itemsInput.trim();
      if (newItem && !items.includes(newItem)) {
        setItems([...items, newItem]);
        setItemsInput("");
      }
    }
  };

  const handleAddSuggestedItem = (suggested: string) => {
    if (!items.includes(suggested)) {
      setItems([...items, suggested]);
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Handle input change
  const handleChange = (name: string, value: string | number) => {
    if (name === "totalQuantity") {
      const num = parseFloat(value as string);
      setTotalQuantity(isNaN(num) || num < 0 ? 0 : num);
    } else if (name === "orderDate") {
      setOrderDate(value as string);
    } else if (name === "unit") {
      const newUnit = value as string;
      if (
        poData?.unit !== newUnit &&
        window.confirm("Changing unit may affect existing DOs. Proceed?")
      ) {
        setUnit(newUnit);
      }
    }

    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Validation
  const validateForm = (): ValidationErrors => {
    const errors: ValidationErrors = {};

    if (!customerName.trim()) errors.customerName = "Customer name is required";
    if (items.length === 0) errors.items = "Add at least one item";
    if (totalQuantity <= 0)
      errors.totalQuantity = "Total quantity must be greater than 0";
    if (!unitOptions.some((opt) => opt.value === unit))
      errors.unit = "Select a valid unit";
    if (!orderDate) errors.orderDate = "Order date is required";

    return errors;
  };

  const handleUpdatePO = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error("Please fix the form errors");
      return;
    }

    // Safe check for poData existence
    if (!poData) {
      toast.error("PO data not loaded—reload and try again.");
      return;
    }

    // FLEX: Use ?? for safe default if total_quantity undefined (TS happy)
    if (
      totalQuantity < (poData.total_quantity ?? 0) &&
      !window.confirm("Reducing quantity—proceed?")
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        customer_name: customerName.trim(),
        item_name: items.join(", ").trim(),
        total_quantity: totalQuantity,
        unit,
        load_location: loadLocation.trim() || null,
        unload_location: unloadLocation.trim() || null,
        notes: notes.trim() || null,
        order_date: orderDate,
      };

      const response = await apiClient.put(`/purchase-orders/${id}`, payload);

      if (response.data?.success) {
        toast.success("PO updated successfully!");
        navigate(`/trips/po/${id}`);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || "Failed to update PO";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isPageLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error && !poData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>Error: {error}</p>
          <button
            onClick={() => navigate("/trips")}
            className="mt-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Back to Purchase Orders
          </button>
        </div>
      </div>
    );
  }

  if (!poData) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p>Purchase Order not found.</p>
          <button
            onClick={() => navigate("/trips")}
            className="mt-2 bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
          >
            Back to Purchase Orders
          </button>
        </div>
      </div>
    );
  }

  // Unit display helper from your code
  const getUnitDisplay = (unitVal: string) => {
    const unitMap = {
      kilogram: "kg",
      ton: "ton",
      kubik: "m³",
    };
    return unitMap[unitVal as keyof typeof unitMap] || unitVal;
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate(`/trips/po/${id}`)}
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
          <span className="font-medium">Back to Details</span>
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          Edit Purchase Order
        </h1>
      </div>

      {/* Current PO Info Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-8 shadow-sm transition-all duration-300 hover:shadow-md">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Current Purchase Order
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">PO Number:</span>
            <span className="font-medium ml-2">{poData.po_number}</span>
          </div>
          <div>
            <span className="text-gray-600">Status:</span>
            <span className="font-medium ml-2 capitalize">{poData.status}</span>
          </div>
          <div>
            <span className="text-gray-600">Order Date:</span>
            <span className="font-medium ml-2">
              {new Date(poData.order_date).toLocaleDateString("id-ID")}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Created:</span>
            <span className="font-medium ml-2">
              {new Date(poData.created_at).toLocaleDateString("id-ID")}
            </span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Quantity:</span>
              <span className="font-medium ml-2">
                {poData.total_quantity} {getUnitDisplay(poData.unit)}
              </span>
            </div>
            <div className="col-span-2 bg-yellow-50 border border-yellow-200 rounded p-2 text-yellow-800 text-xs">
              ⚠️ Changing unit may affect existing DOs. Proceed with caution.
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg animate-fadeIn">
          <p>{error}</p>
        </div>
      )}

      {/* Edit Form */}
      <div className="bg-white shadow-xl rounded-xl border border-gray-100 overflow-hidden">
        <div className="p-8">
          {/* Basic Information */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">
              PO Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="relative group">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order Date <span className="text-red-500">*</span>
                  <span
                    className="ml-1 text-gray-400 cursor-help"
                    title="Edit if needed."
                  >
                    ℹ️
                  </span>
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => handleChange("orderDate", e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 ${
                    validationErrors.orderDate
                      ? "border-red-300 bg-red-50 animate-shake"
                      : "border-gray-300"
                  }`}
                  required
                />
                {validationErrors.orderDate && (
                  <p className="text-red-500 text-xs mt-1">
                    {validationErrors.orderDate}
                  </p>
                )}
              </div>

              <div className="relative group">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Name <span className="text-red-500">*</span>
                  <span
                    className="ml-1 text-gray-400 cursor-help"
                    title="Edit full customer name."
                  >
                    ℹ️
                  </span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 ${
                    validationErrors.customerName
                      ? "border-red-300 bg-red-50 animate-shake"
                      : "border-gray-300"
                  }`}
                  placeholder="PT Example Corp"
                  required
                />
                {validationErrors.customerName && (
                  <p className="text-red-500 text-xs mt-1">
                    {validationErrors.customerName}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Items & Quantity */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">
              Items & Quantity
            </h3>
            <div className="bg-gray-50 rounded-xl p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="relative group col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Items (Edit/Add, press comma/Enter){" "}
                    <span className="text-red-500">*</span>
                    <span
                      className="ml-1 text-gray-400 cursor-help"
                      title="Edit multiple items, stored as comma-separated."
                    >
                      ℹ️
                    </span>
                  </label>
                  <input
                    type="text"
                    value={itemsInput}
                    onChange={(e) => setItemsInput(e.target.value)}
                    onKeyDown={handleItemsKeyDown}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 ${
                      validationErrors.items
                        ? "border-red-300 bg-red-50 animate-shake"
                        : "border-gray-300"
                    }`}
                    placeholder="Pasir Silika, Batu Split"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {items.map((item, index) => (
                      <span
                        key={index}
                        className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="ml-2 text-red-600 hover:text-red-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  {validationErrors.items && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.items}
                    </p>
                  )}
                  <div className="mt-2">
                    <p className="text-sm text-gray-600">Suggestions:</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {suggestedItems.map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => handleAddSuggestedItem(sug)}
                          className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300 transition"
                        >
                          + {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="relative group">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Quantity <span className="text-red-500">*</span>
                    <span
                      className="ml-1 text-gray-400 cursor-help"
                      title="Positive number, decimals OK."
                    >
                      ℹ️
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={
                      unitOptions.find((opt) => opt.value === unit)?.step ||
                      0.01
                    }
                    value={totalQuantity}
                    onChange={(e) =>
                      handleChange("totalQuantity", e.target.value)
                    }
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 ${
                      validationErrors.totalQuantity
                        ? "border-red-300 bg-red-50 animate-shake"
                        : "border-gray-300"
                    }`}
                    placeholder="2500.00"
                    required
                  />
                  {validationErrors.totalQuantity && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.totalQuantity}
                    </p>
                  )}
                </div>

                <div className="relative group">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unit <span className="text-red-500">*</span>
                    <span
                      className="ml-1 text-gray-400 cursor-help"
                      title="Changing may affect DOs—confirm."
                    >
                      ℹ️
                    </span>
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => handleChange("unit", e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 ${
                      validationErrors.unit
                        ? "border-red-300 bg-red-50 animate-shake"
                        : "border-gray-300"
                    }`}
                  >
                    {unitOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {unitOptions.find((opt) => opt.value === unit)?.explanation}
                  </p>
                  {validationErrors.unit && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.unit}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Locations & Notes */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">
              Locations & Notes (Optional)
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Edit if needed; can specify in DOs later.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Load Location
                  <span
                    className="ml-1 text-gray-400 cursor-help"
                    title="Optional pickup site."
                  >
                    ℹ️
                  </span>
                </label>
                <textarea
                  value={loadLocation}
                  onChange={(e) => setLoadLocation(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 resize-none"
                  placeholder="Quarry Serang, Banten"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unload Location
                  <span
                    className="ml-1 text-gray-400 cursor-help"
                    title="Optional delivery site."
                  >
                    ℹ️
                  </span>
                </label>
                <textarea
                  value={unloadLocation}
                  onChange={(e) => setUnloadLocation(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 resize-none"
                  placeholder="Proyek Jalan Tol Tangerang"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                  <span
                    className="ml-1 text-gray-400 cursor-help"
                    title="Any additional details."
                  >
                    ℹ️
                  </span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 resize-none"
                  placeholder="Additional notes or requirements..."
                />
              </div>
            </div>
          </div>

          {/* PO Preview */}
          <div className="mb-8">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="w-full flex justify-between items-center px-4 py-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
            >
              <h3 className="text-lg font-semibold text-gray-800">
                PO Preview
              </h3>
              <svg
                className={`w-5 h-5 transition-transform duration-200 ${
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
              <div className="mt-4 p-6 bg-white border border-gray-200 rounded-lg shadow-inner animate-fadeIn transition-all duration-300">
                <h4 className="text-md font-bold mb-2">{poData.po_number}</h4>
                <p className="text-sm text-gray-600 mb-1">Date: {orderDate}</p>
                <p className="text-sm text-gray-600 mb-1">
                  Customer: {customerName || "N/A"}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  Items: {items.join(", ") || "None"}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  Quantity: {totalQuantity} {getUnitDisplay(unit)}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  Load: {loadLocation || "N/A"}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  Unload: {unloadLocation || "N/A"}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Notes: {notes || "None"}
                </p>
                <p className="text-xs text-gray-400 mt-4 italic">
                  Preview of changes—submit to update.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-gray-50 px-8 py-6 rounded-b-xl flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(`/trips/po/${id}`)}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdatePO}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Updating...
              </div>
            ) : (
              "Update PO"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderEditPage;
