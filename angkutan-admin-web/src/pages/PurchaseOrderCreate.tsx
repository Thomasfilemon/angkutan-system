// src/pages/PurchaseOrderCreate.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/axiosConfig";
import PurchaseOrderForm from "../components/PurchaseOrderForm";

const PurchaseOrderCreatePage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCreatePO = async (data: any) => {
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

      const payload = {
        customer_name: data.customer_name.trim(),
        item_name: data.item_name.trim(),
        total_quantity: parseFloat(data.total_quantity),
        unit: data.unit, // 🎯 NEW: Include unit field
        unit_price: data.unit_price ? parseFloat(data.unit_price) : null,
        load_location: data.load_location?.trim() || null,
        unload_location: data.unload_location?.trim() || null,
        notes: data.notes?.trim() || null,
        order_date: new Date().toISOString().split("T")[0], // Current date
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

      // 🎯 NEW: Additional business logic validation
      if (payload.unit === "kubik" && !payload.unit_price) {
        console.warn(
          "Kubik unit selected without unit price - total amount will be 0"
        );
      }

      console.log("Creating PO with payload:", payload);

      const response = await apiClient.post("/purchase-orders", payload);
      console.log("Create response:", response.data);

      // 🎯 ENHANCED: Show success message with unit info
      if (response.data?.data) {
        const createdPO = response.data.data;
        console.log(
          `✅ PO created successfully: ${createdPO.po_number} with ${payload.total_quantity} ${payload.unit}`
        );
      }

      navigate("/trips");
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Create New Purchase Order
        </h1>
        <button
          onClick={() => navigate("/trips")}
          className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded"
        >
          ← Back to Purchase Orders
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded mb-6">
          <h3 className="font-semibold mb-2">Error Creating Purchase Order</h3>
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

      <PurchaseOrderForm
        onSubmit={handleCreatePO}
        isLoading={isLoading}
        buttonText="Create Purchase Order"
      />
    </div>
  );
};

export default PurchaseOrderCreatePage;
