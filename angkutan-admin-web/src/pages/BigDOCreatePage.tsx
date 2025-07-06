// src/pages/BigDOCreatePage.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api/axiosConfig";
import { toast } from "react-hot-toast";

interface AvailableDO {
  id: number;
  do_number: string;
  customer_name: string;
  item_name: string;
  minimal_load_quantity: number;
  unit: string;
  unit_price: number;
  total_amount: number;
  driver_name: string;
  vehicle_info: string;
  purchaseOrder: {
    po_number: string;
    customer_name: string;
  };
}

interface TambahanForm {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  pickup_location: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  delivery_location: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  notes: string;
}

const BigDOCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [availableDOs, setAvailableDOs] = useState<AvailableDO[]>([]);
  const [selectedMainDO, setSelectedMainDO] = useState<AvailableDO | null>(
    null
  );
  const [tambahan, setTambahan] = useState<TambahanForm[]>([]);
  const [bigDOData, setBigDOData] = useState({
    total_trip_allowance: 0,
    total_gaji: 0,
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [fetchingDOs, setFetchingDOs] = useState(true);

  const initialTambahanForm: TambahanForm = {
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    item_name: "",
    quantity: 0,
    unit: "ton",
    unit_price: 0,
    pickup_location: "",
    pickup_latitude: undefined,
    pickup_longitude: undefined,
    delivery_location: "",
    delivery_latitude: undefined,
    delivery_longitude: undefined,
    notes: "",
  };

  // Fetch available DOs
  const fetchAvailableDOs = async () => {
    try {
      setFetchingDOs(true);
      const response = await apiClient.get(
        "/big-delivery-orders/available-dos"
      );

      // Handle response format
      const data = response.data.success ? response.data.data : response.data;
      setAvailableDOs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to fetch available DOs"
      );
      setAvailableDOs([]);
    } finally {
      setFetchingDOs(false);
    }
  };

  useEffect(() => {
    fetchAvailableDOs();
  }, []);

  // Calculate tambahan amount
  const calculateTambahanAmount = (
    quantity: number,
    unit: string,
    unitPrice: number
  ): number => {
    switch (unit) {
      case "kilogram":
        return quantity * unitPrice;
      case "ton":
        return quantity * 1000 * unitPrice;
      case "kubik":
        return quantity * unitPrice;
      default:
        return quantity * unitPrice;
    }
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString("id-ID")}`;
  };

  const addTambahan = () => {
    setTambahan([...tambahan, { ...initialTambahanForm }]);
  };

  const removeTambahan = (index: number) => {
    setTambahan(tambahan.filter((_, i) => i !== index));
  };

  const updateTambahan = (
    index: number,
    field: keyof TambahanForm,
    value: any
  ) => {
    const updatedTambahan = [...tambahan];
    updatedTambahan[index] = { ...updatedTambahan[index], [field]: value };
    setTambahan(updatedTambahan);
  };

  const calculateTotalRevenue = () => {
    const mainDOAmount = selectedMainDO?.total_amount || 0;
    const tambahanTotal = tambahan.reduce((sum, t) => {
      return sum + calculateTambahanAmount(t.quantity, t.unit, t.unit_price);
    }, 0);
    return mainDOAmount + tambahanTotal;
  };

  const handleCreateBigDO = async () => {
    if (!selectedMainDO) {
      toast.error("Please select a main delivery order");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        main_delivery_order_id: selectedMainDO.id,
        total_trip_allowance: bigDOData.total_trip_allowance,
        total_gaji: bigDOData.total_gaji,
        notes: bigDOData.notes,
        tambahan: tambahan.map((t) => ({
          ...t,
          total_amount: calculateTambahanAmount(
            t.quantity,
            t.unit,
            t.unit_price
          ),
        })),
      };

      const response = await apiClient.post("/big-delivery-orders", payload);

      const bigDO = response.data.success ? response.data.data : response.data;

      toast.success("Big DO created successfully!");
      navigate(`/big-dos/${bigDO.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create Big DO");
    } finally {
      setLoading(false);
    }
  };

  if (fetchingDOs) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading available DOs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Create Big Delivery Order
          </h1>
          <p className="text-gray-600">
            Combine a main DO with additional tambahan deliveries
          </p>
        </div>
        <button
          onClick={() => navigate("/big-dos")}
          className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
        >
          ← Back to Big DOs
        </button>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        {[1, 2, 3].map((stepNum) => (
          <div key={stepNum} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= stepNum
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {stepNum}
            </div>
            <span
              className={`ml-2 text-sm ${
                step >= stepNum ? "text-blue-600" : "text-gray-500"
              }`}
            >
              {stepNum === 1 && "Select Main DO"}
              {stepNum === 2 && "Add Tambahan"}
              {stepNum === 3 && "Finalize"}
            </span>
            {stepNum < 3 && <div className="w-8 h-0.5 bg-gray-300 mx-4"></div>}
          </div>
        ))}
      </div>

      {/* Step 1: Select Main DO */}
      {/* Step 1: Select Main DO */}
      {step === 1 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium">
              Step 1: Select Main Delivery Order
            </h2>
            <p className="text-sm text-gray-600">
              Choose the primary DO that will be the base of this Big DO
            </p>
          </div>
          <div className="p-6">
            {availableDOs.length === 0 ? (
              <div className="text-center py-8">
                <div className="mb-4">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-3a2 2 0 00-2 2v3a2 2 0 01-2 2H8a2 2 0 01-2-2v-3a2 2 0 00-2-2H3"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Available DOs for Big DO Creation
                </h3>
                <p className="text-gray-500 mb-2">
                  All DOs must be in "assigned" status and not already part of
                  another Big DO
                </p>
                <p className="text-sm text-gray-400 mb-6">
                  You can create a new delivery order and then use it for this
                  Big DO
                </p>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <button
                    onClick={() => navigate("/delivery-orders/create")}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <svg
                      className="w-5 h-5"
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
                    <span>Create New Delivery Order</span>
                  </button>

                  <span className="text-gray-400 text-sm">or</span>

                  <button
                    onClick={fetchAvailableDOs}
                    className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    <span>Refresh Available DOs</span>
                  </button>
                </div>

                {/* Additional Help Text */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <svg
                      className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="text-left">
                      <h4 className="text-sm font-medium text-blue-900">
                        Quick Tip
                      </h4>
                      <p className="text-sm text-blue-700 mt-1">
                        After creating a new DO, you'll be redirected back here
                        automatically. Make sure to set the DO status to
                        "assigned" and ensure it has a driver and vehicle
                        assigned.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Refresh Button when there are DOs */}
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Found {availableDOs.length} available DO
                    {availableDOs.length !== 1 ? "s" : ""} for Big DO creation
                  </div>
                  <button
                    onClick={fetchAvailableDOs}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="grid gap-4">
                  {availableDOs.map((doItem) => (
                    <div
                      key={doItem.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedMainDO?.id === doItem.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setSelectedMainDO(doItem)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-4">
                            <div className="font-medium text-gray-900">
                              {doItem.do_number}
                            </div>
                            <div className="text-sm text-gray-600">
                              {doItem.purchaseOrder.po_number}
                            </div>
                          </div>
                          <div className="mt-1 text-sm text-gray-600">
                            {doItem.customer_name} • {doItem.item_name}
                          </div>
                          <div className="mt-1 text-sm text-gray-500">
                            {doItem.driver_name} • {doItem.vehicle_info}
                          </div>
                          <div className="mt-2 text-sm">
                            <span className="text-gray-600">
                              {doItem.minimal_load_quantity} {doItem.unit} ×{" "}
                              {formatCurrency(doItem.unit_price)}/{doItem.unit}
                            </span>
                            <span className="ml-4 font-medium text-green-600">
                              {formatCurrency(doItem.total_amount)}
                            </span>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {selectedMainDO?.id === doItem.id && (
                            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                              <svg
                                className="w-4 h-4 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Action to Create More DOs */}
                <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Need more delivery orders for your Big DO?
                    </div>
                    <button
                      onClick={() => navigate("/delivery-orders/create")}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      + Create Another DO
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedMainDO && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Next: Add Tambahan →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Add Tambahan */}
      {step === 2 && selectedMainDO && (
        <div className="space-y-6">
          {/* Selected Main DO Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Selected Main DO</h3>
            <div className="text-sm text-blue-800">
              <strong>{selectedMainDO.do_number}</strong> •{" "}
              {selectedMainDO.customer_name} •
              {formatCurrency(selectedMainDO.total_amount)}
            </div>
          </div>

          {/* Tambahan Section */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-medium">
                  Step 2: Add Tambahan Deliveries
                </h2>
                <p className="text-sm text-gray-600">
                  Add additional deliveries that will piggyback on this trip
                </p>
              </div>
              <button
                onClick={addTambahan}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                ➕ Add Tambahan
              </button>
            </div>

            <div className="p-6">
              {tambahan.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No tambahan added yet</p>
                  <p className="text-sm text-gray-400 mt-2">
                    You can create a Big DO with just the main DO, or add
                    tambahan deliveries
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {tambahan.map((item, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-medium">Tambahan #{index + 1}</h4>
                        <button
                          onClick={() => removeTambahan(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          🗑️ Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Customer Info */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Customer Name *
                          </label>
                          <input
                            type="text"
                            value={item.customer_name}
                            onChange={(e) =>
                              updateTambahan(
                                index,
                                "customer_name",
                                e.target.value
                              )
                            }
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Customer Phone
                          </label>
                          <input
                            type="tel"
                            value={item.customer_phone}
                            onChange={(e) =>
                              updateTambahan(
                                index,
                                "customer_phone",
                                e.target.value
                              )
                            }
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Customer Address
                          </label>
                          <textarea
                            value={item.customer_address}
                            onChange={(e) =>
                              updateTambahan(
                                index,
                                "customer_address",
                                e.target.value
                              )
                            }
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                            rows={2}
                          />
                        </div>

                        {/* Item Info */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Item Name *
                          </label>
                          <input
                            type="text"
                            value={item.item_name}
                            onChange={(e) =>
                              updateTambahan(index, "item_name", e.target.value)
                            }
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Quantity *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) =>
                                updateTambahan(
                                  index,
                                  "quantity",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full border border-gray-300 rounded-md px-3 py-2"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Unit *
                            </label>
                            <select
                              value={item.unit}
                              onChange={(e) =>
                                updateTambahan(index, "unit", e.target.value)
                              }
                              className="w-full border border-gray-300 rounded-md px-3 py-2"
                            >
                              <option value="kilogram">Kg</option>
                              <option value="ton">Ton</option>
                              <option value="kubik">m³</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Unit Price *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) =>
                                updateTambahan(
                                  index,
                                  "unit_price",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full border border-gray-300 rounded-md px-3 py-2"
                              required
                            />
                          </div>
                        </div>

                        {/* Locations */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Pickup Location *
                          </label>
                          <input
                            type="text"
                            value={item.pickup_location}
                            onChange={(e) =>
                              updateTambahan(
                                index,
                                "pickup_location",
                                e.target.value
                              )
                            }
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Delivery Location *
                          </label>
                          <input
                            type="text"
                            value={item.delivery_location}
                            onChange={(e) =>
                              updateTambahan(
                                index,
                                "delivery_location",
                                e.target.value
                              )
                            }
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                            required
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notes
                          </label>
                          <textarea
                            value={item.notes}
                            onChange={(e) =>
                              updateTambahan(index, "notes", e.target.value)
                            }
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                            rows={2}
                          />
                        </div>
                      </div>

                      {/* Calculated Amount */}
                      {item.quantity > 0 && item.unit_price > 0 && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-md">
                          <div className="text-sm text-gray-600">
                            Calculated Amount:{" "}
                            <strong className="text-green-600">
                              {formatCurrency(
                                calculateTambahanAmount(
                                  item.quantity,
                                  item.unit,
                                  item.unit_price
                                )
                              )}
                            </strong>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Next: Finalize →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Finalize */}
      {step === 3 && selectedMainDO && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium">Step 3: Finalize Big DO</h2>
              <p className="text-sm text-gray-600">
                Review and set financial details
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Revenue Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium mb-3">Revenue Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Main DO ({selectedMainDO.do_number})</span>
                    <span className="font-medium">
                      {formatCurrency(selectedMainDO.total_amount)}
                    </span>
                  </div>
                  {tambahan.map((item, index) => (
                    <div key={index} className="flex justify-between">
                      <span>
                        Tambahan #{index + 1} ({item.customer_name})
                      </span>
                      <span className="font-medium">
                        {formatCurrency(
                          calculateTambahanAmount(
                            item.quantity,
                            item.unit,
                            item.unit_price
                          )
                        )}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between font-medium text-lg">
                    <span>Total Revenue</span>
                    <span className="text-green-600">
                      {formatCurrency(calculateTotalRevenue())}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Trip Allowance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={bigDOData.total_trip_allowance}
                    onChange={(e) =>
                      setBigDOData({
                        ...bigDOData,
                        total_trip_allowance: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Single trip allowance for the entire Big DO
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Driver Salary
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={bigDOData.total_gaji}
                    onChange={(e) =>
                      setBigDOData({
                        ...bigDOData,
                        total_gaji: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Additional salary for handling tambahan deliveries
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={bigDOData.notes}
                  onChange={(e) =>
                    setBigDOData({
                      ...bigDOData,
                      notes: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                  placeholder="Additional notes for this Big DO..."
                />
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  ← Previous
                </button>
                <button
                  onClick={handleCreateBigDO}
                  disabled={loading}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? "Creating..." : "🚀 Create Big DO"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BigDOCreatePage;
