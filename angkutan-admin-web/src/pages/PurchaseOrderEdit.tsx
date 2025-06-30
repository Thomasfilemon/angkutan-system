// src/pages/PurchaseOrderEdit.tsx
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import apiClient from "../api/axiosConfig";
import PurchaseOrderForm from "../components/PurchaseOrderForm";

interface PurchaseOrderData {
  id: number;
  po_number: string;
  customer_name: string;
  item_name: string;
  total_quantity: number;
  unit: string; // 🎯 NEW: Add unit field
  unit_price?: number;
  total_amount?: number;
  load_location?: string;
  unload_location?: string;
  notes?: string;
  status: string;
  order_date: string;
  created_at: string;
}

const PurchaseOrderEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const [poData, setPOData] = useState<PurchaseOrderData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // 🎯 NEW: Unit display helper
  const getUnitDisplay = (unit: string) => {
    const unitMap = {
      kilogram: "kg",
      ton: "ton",
      kubik: "m³",
    };
    return unitMap[unit as keyof typeof unitMap] || unit;
  };

  useEffect(() => {
    const fetchPO = async () => {
      try {
        setIsPageLoading(true);
        setError(null);
        const response = await apiClient.get(`/purchase-orders/${id}`);

        // Handle both direct data and nested data response
        const data = response.data?.data || response.data;

        if (!data) {
          throw new Error("No purchase order data received");
        }

        // 🎯 NEW: Ensure unit field exists with fallback
        if (!data.unit) {
          console.warn('PO data missing unit field, defaulting to "ton"');
          data.unit = "ton";
        }

        setPOData(data);
      } catch (err: any) {
        console.error("Error fetching PO:", err);
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          "Failed to load purchase order data.";
        setError(errorMessage);
      } finally {
        setIsPageLoading(false);
      }
    };

    if (id) {
      fetchPO();
    }
  }, [id]);

  const handleUpdatePO = async (data: any) => {
    setIsLoading(true);
    setError(null);

    try {
      // 🎯 UPDATED: Validate required fields including unit
      if (
        !data.customer_name ||
        !data.item_name ||
        !data.total_quantity ||
        !data.unit
      ) {
        throw new Error("Please fill in all required fields including unit");
      }

      // Prepare payload with proper data types
      const payload = {
        customer_name: data.customer_name.trim(),
        item_name: data.item_name.trim(),
        total_quantity: parseFloat(data.total_quantity),
        unit: data.unit, // 🎯 NEW: Include unit field
        unit_price: data.unit_price ? parseFloat(data.unit_price) : null,
        load_location: data.load_location?.trim() || null,
        unload_location: data.unload_location?.trim() || null,
        notes: data.notes?.trim() || null,
      };

      // Validate numeric fields
      if (isNaN(payload.total_quantity) || payload.total_quantity <= 0) {
        throw new Error("Total quantity must be a valid positive number");
      }

      // 🎯 NEW: Validate unit field
      if (!["kilogram", "ton", "kubik"].includes(payload.unit)) {
        throw new Error("Unit must be one of: kilogram, ton, or kubik");
      }

      if (
        payload.unit_price !== null &&
        (isNaN(payload.unit_price) || payload.unit_price < 0)
      ) {
        throw new Error("Unit price must be a valid non-negative number");
      }

      // 🎯 NEW: Warn about unit changes that might affect existing DOs
      if (poData && poData.unit !== payload.unit) {
        console.warn(
          `⚠️ Unit changed from ${poData.unit} to ${payload.unit}. This may affect existing delivery orders.`
        );
      }

      console.log("Updating PO with payload:", payload);

      const response = await apiClient.put(`/purchase-orders/${id}`, payload);

      console.log("Update response:", response.data);

      // Navigate back to PO detail page
      navigate(`/trips/po/${id}`);
    } catch (err: any) {
      console.error("Error updating PO:", err);

      let errorMessage = "An unknown error occurred.";

      if (err.response?.data) {
        // Handle different error response formats
        if (err.response.data.message) {
          errorMessage = err.response.data.message;
        } else if (err.response.data.errors) {
          errorMessage = Array.isArray(err.response.data.errors)
            ? err.response.data.errors.join(". ")
            : err.response.data.errors;
        } else if (err.response.data.details) {
          errorMessage = err.response.data.details;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }

      // 🎯 ENHANCED: Better error messages for unit-related issues
      if (errorMessage.includes("unit")) {
        errorMessage = `Unit Error: ${errorMessage}. Please ensure you select a valid unit (kilogram, ton, or kubik).`;
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isPageLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading purchase order data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !poData) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded mb-4">
          <h3 className="font-semibold mb-2">Error Loading Purchase Order</h3>
          <p>{error}</p>
        </div>
        <div className="flex space-x-4">
          <button
            onClick={() => navigate("/trips")}
            className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded"
          >
            ← Back to Purchase Orders
          </button>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  // Not found state
  if (!poData) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-4 rounded mb-4">
          <h3 className="font-semibold mb-2">Purchase Order Not Found</h3>
          <p>The purchase order with ID {id} could not be found.</p>
        </div>
        <button
          onClick={() => navigate("/trips")}
          className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded"
        >
          ← Back to Purchase Orders
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Edit Purchase Order
        </h1>
        <div className="space-x-2">
          <button
            onClick={() => navigate(`/trips/po/${id}`)}
            className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded"
          >
            ← Back to Details
          </button>
          <button
            onClick={() => navigate("/trips")}
            className="bg-gray-600 hover:bg-gray-800 text-white px-4 py-2 rounded"
          >
            📋 All Purchase Orders
          </button>
        </div>
      </div>

      {/* 🎯 ENHANCED: Current PO Info with Unit Display */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Current Purchase Order</h2>
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

        {/* 🎯 NEW: Quantity and Unit Display */}
        <div className="mt-3 pt-3 border-t border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Quantity:</span>
              <span className="font-medium ml-2">
                {poData.total_quantity} {getUnitDisplay(poData.unit)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Unit Price:</span>
              <span className="font-medium ml-2">
                {poData.unit_price
                  ? `Rp ${poData.unit_price.toLocaleString(
                      "id-ID"
                    )}/${getUnitDisplay(poData.unit)}`
                  : "Not set"}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Total Amount:</span>
              <span className="font-semibold text-green-600 ml-2">
                {poData.total_amount
                  ? `Rp ${poData.total_amount.toLocaleString("id-ID")}`
                  : "Not calculated"}
              </span>
            </div>
          </div>
        </div>

        {/* 🎯 NEW: Unit Change Warning */}
        <div className="mt-3 pt-3 border-t border-blue-200">
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
            <p className="text-xs text-yellow-800">
              <strong>⚠️ Note:</strong> Changing the unit may affect
              calculations. Existing delivery orders will retain their original
              unit until manually updated.
            </p>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded mb-6">
          <h3 className="font-semibold mb-2">Update Error</h3>
          <p>{error}</p>
          {/* 🎯 NEW: Helper text for unit-related errors */}
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

      {/* Form */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <PurchaseOrderForm
          initialData={poData}
          onSubmit={handleUpdatePO}
          isLoading={isLoading}
          buttonText="Update Purchase Order"
          isEditMode={true}
        />
      </div>
    </div>
  );
};

export default PurchaseOrderEditPage;
