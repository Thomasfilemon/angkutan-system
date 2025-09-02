// src/pages/PurchaseOrderCreate.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/axiosConfig";
import toast from "react-hot-toast";

interface DepositGroup {
  id: number;
  group_name: string;
  balance: number;
  target_quantity?: number;
  remaining_quantity?: number;
  unit?: string;
  status?: string;
  created_at: string;
  updated_at: string;
}

interface ValidationErrors {
  [key: string]: string;
}

const PurchaseOrderCreatePage = () => {
  const navigate = useNavigate();

  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {}
  );
  const [showPreview, setShowPreview] = useState(true);

  // Deposit group states
  const [depositGroups, setDepositGroups] = useState<DepositGroup[]>([]);
  const [selectedDepositGroup, setSelectedDepositGroup] = useState<string>("");

  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Form states
  const [customerName, setCustomerName] = useState("");
  const [itemsInput, setItemsInput] = useState(""); // Temp for typing items
  const [items, setItems] = useState<string[]>([]); // Array of added items
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [unit, setUnit] = useState("ton");
  const [loadLocation, setLoadLocation] = useState("");
  const [unloadLocation, setUnloadLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [poNumberPreview, setPoNumberPreview] = useState("");

  // Suggested items
  const suggestedItems = [
    "Pasir Silika",
    "Batu Split",
    "Semen",
    "Gravel",
    "Sand",
    "Abu Batu",
    "Pasir",
    "Split",
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

  // Fetch deposit groups on mount
  useEffect(() => {
    const fetchDepositGroups = async () => {
      try {
        const response = await apiClient.get("/deposit-groups");
        setDepositGroups(response.data || []);

        // Fetch recent customers
        const customerResponse = await apiClient.get(
          "/purchase-orders/utils/recent-customers"
        );
        if (customerResponse.data?.success) {
          setCustomerSuggestions(customerResponse.data.data);
        }
      } catch (error) {
        console.error("Error fetching deposit groups:", error);
      }
    };

    fetchDepositGroups();
  }, []);

  // Auto-generate PO number preview
  useEffect(() => {
    const today = new Date();
    const yearMonth = `${today.getFullYear()}${String(
      today.getMonth() + 1
    ).padStart(2, "0")}`;
    setPoNumberPreview(`PO-${yearMonth}-XXX`);
  }, []);

  const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomerName(value);
    if (value) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (name: string) => {
    setCustomerName(name);
    setShowSuggestions(false);
  };

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

  // Handle input changes with validation
  const handleChange = (name: string, value: string | number) => {
    if (name === "totalQuantity") {
      const num = parseFloat(value as string);
      setTotalQuantity(isNaN(num) || num < 0 ? 0 : num);
    } else if (name === "orderDate") {
      setOrderDate(value as string);
    } else if (name === "unit") {
      setUnit(value as string);
    }

    // Clear validation error
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Form validation
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

  const handleCreatePO = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error("Please fix the form errors");
      return;
    }

    // Confirm on edge cases
    if (totalQuantity < 1 || items.length > 5) {
      if (!window.confirm("Quantity low or many items—proceed?")) return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        customer_name: customerName.trim(),
        item_name: items.join(", ").trim(), // Multi-item support
        total_quantity: totalQuantity,
        unit,
        load_location: loadLocation.trim() || null,
        unload_location: unloadLocation.trim() || null,
        notes: notes.trim() || null,
        deposit_group_id: selectedDepositGroup || null,
      };

      // Validate payload
      if (!["kilogram", "ton", "kubik"].includes(payload.unit)) {
        throw new Error("Unit must be one of: kilogram, ton, or kubik");
      }

      console.log("Creating PO with payload:", payload);

      const response = await apiClient.post("/purchase-orders", payload);

      if (response.data?.success) {
        toast.success("Purchase Order created successfully!");
        navigate("/trips");
      }
    } catch (err: any) {
      console.error("Error creating PO:", err);

      let errorMessage = "An unknown error occurred.";

      if (err.response?.data) {
        if (err.response.data.message) {
          errorMessage = err.response.data.message;
        } else if (err.response.data.errors) {
          errorMessage = Array.isArray(err.response.data.errors)
            ? err.response.data.errors.join(". ")
            : err.response.data.errors;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      if (errorMessage.includes("unit")) {
        errorMessage = `Unit Error: ${errorMessage}. Please ensure you select a valid unit (kilogram, ton, or kubik).`;
      }

      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate("/trips")}
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
          <span className="font-medium">Back to Purchase Orders</span>
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          Create New Purchase Order
        </h1>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg animate-fadeIn">
          <h3 className="font-semibold mb-2">Error Creating Purchase Order</h3>
          <p>{error}</p>
          {error.includes("unit") && (
            <div className="mt-2 text-sm">
              <p className="font-medium">Valid units are:</p>
              <ul className="list-disc list-inside ml-2">
                <li>
                  <strong>kilogram</strong> - For weight-based pricing per kg
                </li>
                <li>
                  <strong>ton</strong> - For weight-based pricing per kg
                  (converted to tons)
                </li>
                <li>
                  <strong>kubik</strong> - For volume-based pricing per m³
                </li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Main Form */}
      <div className="bg-white shadow-xl rounded-xl border border-gray-100 overflow-hidden">
        <div className="p-8">
          {/* Deposit Group Selection */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Deposit Group (Optional)
            </h3>
            <div className="p-4 bg-blue-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Link to Deposit Group
                <span
                  className="ml-1 text-gray-400 cursor-help"
                  title="Link this PO to a deposit group for pre-paid handling"
                >
                  ℹ️
                </span>
              </label>
              <select
                value={selectedDepositGroup}
                onChange={(e) => setSelectedDepositGroup(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No Deposit Group</option>
                {depositGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.group_name} (Remaining:{" "}
                    {group.remaining_quantity || 0} {group.unit || "ton"})
                  </option>
                ))}
              </select>
              {selectedDepositGroup && (
                <p className="text-sm text-blue-600 mt-1">
                  This PO will be linked to the selected deposit group for
                  pre-paid handling.
                </p>
              )}
            </div>
          </div>

          {/* Basic Information */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">
              PO Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="relative group">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PO Number (Preview)
                  <span
                    className="ml-1 text-gray-400 cursor-help"
                    title="Auto-generated by system on submit"
                  >
                    ℹ️
                  </span>
                </label>
                <input
                  type="text"
                  value={poNumberPreview}
                  readOnly
                  className="w-full px-4 py-3 border rounded-lg bg-gray-50 cursor-not-allowed"
                />
              </div>

              <div className="relative group">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => handleChange("orderDate", e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 ${
                    validationErrors.orderDate
                      ? "border-red-300 bg-red-50"
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
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={handleCustomerNameChange}
                  onFocus={() => customerName && setShowSuggestions(true)}
                  onBlur={() =>
                    setTimeout(() => setShowSuggestions(false), 150)
                  } // Delay to allow click
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 ${
                    validationErrors.customerName
                      ? "border-red-300 bg-red-50"
                      : "border-gray-300"
                  }`}
                  placeholder="PT Example Corp"
                  required
                  autoComplete="off" // Disable browser's default autocomplete
                />
                {validationErrors.customerName && (
                  <p className="text-red-500 text-xs mt-1">
                    {validationErrors.customerName}
                  </p>
                )}
                {/* --- SUGGESTION BOX --- */}
                {showSuggestions && customerSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {customerSuggestions
                      .filter((suggestion) =>
                        suggestion
                          .toLowerCase()
                          .includes(customerName.toLowerCase())
                      )
                      .map((suggestion, index) => (
                        <div
                          key={index}
                          onMouseDown={() => handleSelectSuggestion(suggestion)} // Use onMouseDown to fire before onBlur
                          className="px-4 py-2 text-gray-700 hover:bg-gray-100 cursor-pointer"
                        >
                          {suggestion}
                        </div>
                      ))}
                  </div>
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
                    Items (Type and press comma/Enter){" "}
                    <span className="text-red-500">*</span>
                    <span
                      className="ml-1 text-gray-400 cursor-help"
                      title="Add multiple items, stored as comma-separated"
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
                        ? "border-red-300 bg-red-50"
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
                        ? "border-red-300 bg-red-50"
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
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => handleChange("unit", e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 ${
                      validationErrors.unit
                        ? "border-red-300 bg-red-50"
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
              Specify now or later in delivery orders.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Load Location
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
                <h4 className="text-md font-bold mb-2">{poNumberPreview}</h4>
                <p className="text-sm text-gray-600 mb-1">Date: {orderDate}</p>
                <p className="text-sm text-gray-600 mb-1">
                  Customer: {customerName || "N/A"}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  Items: {items.join(", ") || "None"}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  Quantity: {totalQuantity}{" "}
                  {unitOptions.find((opt) => opt.value === unit)?.shortLabel}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  Load: {loadLocation || "N/A"}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  Unload: {unloadLocation || "N/A"}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  Deposit Group:{" "}
                  {selectedDepositGroup
                    ? depositGroups.find(
                        (g) => g.id.toString() === selectedDepositGroup
                      )?.group_name
                    : "None"}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Notes: {notes || "None"}
                </p>
                <p className="text-xs text-gray-400 mt-4 italic">
                  Preview—submit to create.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-gray-50 px-8 py-6 rounded-b-xl flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate("/trips")}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleCreatePO}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Creating...
              </div>
            ) : (
              "Create Purchase Order"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderCreatePage;
