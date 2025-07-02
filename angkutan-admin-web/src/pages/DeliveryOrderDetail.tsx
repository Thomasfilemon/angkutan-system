// src/pages/DeliveryOrderDetail.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import apiClient from "../api/axiosConfig";

interface DeliveryOrderDetail {
  id: number;
  do_number: string;
  customer_name: string;
  item_name: string;
  minimal_load_quantity: number;
  actual_load_quantity?: number;
  unit: string; // 🎯 NEW: Add unit field
  unit_price: number; // 🎯 NEW: Add unit price
  status: string;
  status_text: string;
  load_location: string;
  unload_location: string;
  surat_jalan_photo_url?: string;
  big_delivery_order_id?: number;
  big_do_creation_session?: string;
  is_big_do_candidate?: boolean;
  big_do_context: {
    type: "completed_big_do" | "in_session" | "standalone";
    message: string;
  };
  big_do_info?: {
    big_do_number: string;
    big_do_status: string;
    sibling_dos: any[];
    total_dos_in_big_do: number;
  };
  session_info?: {
    session_id: string;
    can_add_more: boolean;
    can_finalize: boolean;
  };
  driver: {
    username: string;
    driverProfile: {
      full_name: string;
      phone: string;
    };
  };
  vehicle: {
    license_plate: string;
    type: string;
    capacity?: string;
  };
  purchaseOrder: {
    po_number: string;
    customer_name: string;
    unit: string; // 🎯 NEW: Add unit from PO
  };
  financial_summary: {
    trip_allowance: number;
    gaji: number;
    total_for_driver: number;
    total_amount: number;
    minimal_total_amount: number; // 🎯 NEW: Add calculated amounts
    actual_total_amount: number;
    ongkosan: number;
    net_profit: number;
    unit: string; // 🎯 NEW: Unit info
    unit_display: string;
  };
  timeline: {
    created_at: string;
    departed_to_load_location_at?: string;
    arrived_at_load_location_at?: string;
    departed_from_load_location_at?: string;
    arrived_at_unload_location_at?: string;
    departed_from_unload_location_at?: string;
    completed_at?: string;
  };
}

const DeliveryOrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [deliveryOrder, setDeliveryOrder] =
    useState<DeliveryOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bigDOLoading, setBigDOLoading] = useState(false);

  // 🎯 NEW: Unit display helper
  const getUnitDisplay = (unit: string) => {
    const unitMap = {
      kilogram: "kg",
      ton: "ton",
      kubik: "m³",
    };
    return unitMap[unit as keyof typeof unitMap] || unit;
  };

  // 🎯 NEW: Unit-aware calculation display
  const getCalculationBreakdown = (
    quantity: number,
    unitPrice: number,
    unit: string
  ) => {
    switch (unit) {
      case "kilogram":
        return `${quantity} kg × Rp ${unitPrice.toLocaleString("id-ID")}/kg`;
      case "ton":
        return `${quantity} ton × 1000 kg/ton × Rp ${unitPrice.toLocaleString(
          "id-ID"
        )}/kg`;
      case "kubik":
        return `${quantity} m³ × Rp ${unitPrice.toLocaleString("id-ID")}/m³`;
      default:
        return `${quantity} ${getUnitDisplay(
          unit
        )} × Rp ${unitPrice.toLocaleString("id-ID")}/${getUnitDisplay(unit)}`;
    }
  };

  useEffect(() => {
    const fetchDeliveryOrder = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(`/delivery-orders/${id}`);
        const data = response.data.data || response.data;

        // 🎯 NEW: Ensure unit field exists with fallback
        if (!data.unit) {
          console.warn('DO data missing unit field, defaulting to "ton"');
          data.unit = "ton";
        }

        setDeliveryOrder(data);
      } catch (err) {
        setError("Failed to fetch delivery order details.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchDeliveryOrder();
    }
  }, [id]);

  const handleMakeThisBig = async () => {
    try {
      setBigDOLoading(true);
      console.log(
        "🚀 Initializing Big DO for delivery order:",
        deliveryOrder?.id
      );

      const response = await apiClient.post(
        "/delivery-orders/initialize-big-do",
        {
          first_do_id: deliveryOrder?.id,
        }
      );

      // 🎯 DEBUG: Log the full response structure
      console.log("✅ Big DO initialization response:", response);
      console.log("📦 Response data:", response.data);
      console.log("🎯 Session data:", response.data.data);

      const sessionData = response.data.data;

      // 🎯 VALIDATE: Check if required data exists
      if (!sessionData) {
        throw new Error("No session data received from server");
      }

      if (!sessionData.session_id) {
        throw new Error("Session ID missing from response");
      }

      if (!sessionData.driver_id || !sessionData.vehicle_id) {
        throw new Error("Driver ID or Vehicle ID missing from response");
      }

      console.log("🎯 Navigation data:", {
        session_id: sessionData.session_id,
        driver_id: sessionData.driver_id,
        vehicle_id: sessionData.vehicle_id,
      });

      // 🎯 MODERN TOAST: Replace alert with toast
      toast.success("Big DO session initialized successfully!", {
        icon: "🚛",
        duration: 3000,
      });

      // 🎯 ENHANCED NAVIGATION: With error handling
      const navigationUrl = `/delivery-orders/create-big-do?session=${sessionData.session_id}&driver_id=${sessionData.driver_id}&vehicle_id=${sessionData.vehicle_id}`;
      console.log("🧭 Navigating to:", navigationUrl);

      navigate(navigationUrl);
    } catch (err: any) {
      console.error("❌ Big DO initialization error:", err);
      console.error("❌ Error response:", err.response);

      // 🎯 MODERN TOAST: Replace alert with toast
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to initialize Big DO creation";

      toast.error(errorMessage, {
        icon: "❌",
        duration: 5000,
        style: {
          borderRadius: "10px",
          background: "#fef2f2",
          color: "#dc2626",
          border: "1px solid #fecaca",
        },
      });
    } finally {
      setBigDOLoading(false);
    }
  };

  const handleCancel = async () => {
    if (
      !deliveryOrder ||
      deliveryOrder.status === "completed" ||
      deliveryOrder.status === "cancelled"
    ) {
      return;
    }

    const reason = prompt("Enter cancellation reason:");
    if (!reason) return;

    try {
      await apiClient.patch(`/delivery-orders/${id}/cancel`, {
        cancellation_reason: reason,
      });

      // Refresh data
      const response = await apiClient.get(`/delivery-orders/${id}`);
      const data = response.data.data || response.data;
      setDeliveryOrder(data);
    } catch (err) {
      alert("Failed to cancel delivery order.");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "assigned":
        return "bg-yellow-100 text-yellow-800";
      case "otw_to_load_location":
        return "bg-blue-100 text-blue-800";
      case "at_load_location":
        return "bg-purple-100 text-purple-800";
      case "otw_to_unload_location":
        return "bg-indigo-100 text-indigo-800";
      case "at_unload_location":
        return "bg-orange-100 text-orange-800";
      case "otw_to_base":
        return "bg-teal-100 text-teal-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "pending_big_do":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading)
    return <div className="text-center p-8">Loading delivery order...</div>;
  if (error)
    return <div className="bg-red-100 text-red-700 p-4 rounded">{error}</div>;
  if (!deliveryOrder)
    return <div className="text-center p-8">Delivery order not found.</div>;

  const unitDisplay = getUnitDisplay(deliveryOrder.unit);
  const poUnitDisplay = getUnitDisplay(
    deliveryOrder.purchaseOrder?.unit || deliveryOrder.unit
  );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Delivery Order Details
        </h1>
        <div className="space-x-2">
          <button
            onClick={() => navigate("/delivery-orders")}
            className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded"
          >
            ← Back to List
          </button>
          {deliveryOrder.status !== "completed" &&
            deliveryOrder.status !== "cancelled" && (
              <button
                onClick={handleCancel}
                className="bg-red-500 hover:bg-red-700 text-white px-4 py-2 rounded"
              >
                Cancel Order
              </button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Information */}
        <div className="lg:col-span-2 bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">DO Number</label>
              <p className="font-medium text-lg">{deliveryOrder.do_number}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">PO Number</label>
              <p className="font-medium">
                {deliveryOrder.purchaseOrder.po_number}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Customer</label>
              <p className="font-medium">{deliveryOrder.customer_name}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Item</label>
              <p className="font-medium">{deliveryOrder.item_name}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Status</label>
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                  deliveryOrder.status
                )}`}
              >
                {deliveryOrder.status_text}
              </span>
            </div>
            {/* 🎯 NEW: Unit Information */}
            <div>
              <label className="text-sm text-gray-600">Unit</label>
              <p className="font-medium">
                <span className="bg-gray-100 px-2 py-1 rounded text-sm">
                  {unitDisplay}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  (
                  {deliveryOrder.unit === "kilogram"
                    ? "Weight-based"
                    : deliveryOrder.unit === "ton"
                    ? "Weight-based (tons)"
                    : "Volume-based"}
                  )
                </span>
              </p>
              {/* 🎯 NEW: Unit mismatch warning */}
              {deliveryOrder.purchaseOrder?.unit &&
                deliveryOrder.unit !== deliveryOrder.purchaseOrder.unit && (
                  <p className="text-xs text-orange-600 mt-1">
                    ⚠️ Differs from PO unit:{" "}
                    {getUnitDisplay(deliveryOrder.purchaseOrder.unit)}
                  </p>
                )}
            </div>
          </div>
          {/* 🎯 NEW: Big DO Action Section */}
          {deliveryOrder.big_do_context.type === "standalone" &&
            deliveryOrder.status === "assigned" && (
              <div className="lg:col-span-3 mt-6">
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                      </div>
                    </div>

                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-purple-900 mb-2">
                        🚛 Create Big Delivery Order
                      </h3>
                      <p className="text-purple-700 text-sm mb-4">
                        Optimize logistics by grouping this DO with others for
                        the same driver/vehicle. Create multiple deliveries in a
                        single optimized trip to save costs and improve
                        efficiency.
                      </p>

                      <div className="bg-white/50 rounded-lg p-3 mb-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center">
                              <svg
                                className="w-2.5 h-2.5 text-green-600"
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
                            <span className="text-green-700">
                              Same driver gets multiple DOs
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center">
                              <svg
                                className="w-2.5 h-2.5 text-blue-600"
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
                            <span className="text-blue-700">
                              Optimized route planning
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-purple-100 rounded-full flex items-center justify-center">
                              <svg
                                className="w-2.5 h-2.5 text-purple-600"
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
                            <span className="text-purple-700">
                              Single trip allowance
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <button
                          onClick={handleMakeThisBig}
                          disabled={bigDOLoading}
                          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 disabled:transform-none flex items-center space-x-2"
                        >
                          {bigDOLoading ? (
                            <>
                              <svg
                                className="animate-spin w-4 h-4"
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
                              <span>Creating Session...</span>
                            </>
                          ) : (
                            <>
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M13 10V3L4 14h7v7l9-11h-7z"
                                />
                              </svg>
                              <span>🚛 Make This Big!</span>
                            </>
                          )}
                        </button>

                        <div className="text-xs text-gray-600">
                          <div className="font-medium">Current Assignment:</div>
                          <div>
                            Driver:{" "}
                            {deliveryOrder.driver.driverProfile.full_name}
                          </div>
                          <div>
                            Vehicle: {deliveryOrder.vehicle.license_plate} (
                            {deliveryOrder.vehicle.type})
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* 🎯 NEW: Big DO Session Status */}
          {deliveryOrder.big_do_context.type === "in_session" &&
            deliveryOrder.session_info && (
              <div className="lg:col-span-3 mt-6">
                <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-orange-900 mb-2">
                    🏗️ Big DO Creation In Progress
                  </h3>
                  <p className="text-orange-700 text-sm mb-4">
                    This DO is part of an ongoing Big DO creation session. You
                    can add more DOs with the same driver/vehicle or finalize
                    the Big DO.
                  </p>

                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() =>
                        navigate(
                          `/delivery-orders/create-big-do?session=${deliveryOrder.session_info?.session_id}`
                        )
                      }
                      className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      Continue Big DO Creation →
                    </button>

                    <div className="text-xs text-orange-600">
                      Session ID: {deliveryOrder.session_info.session_id}
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* 🎯 NEW: Big DO Member Status */}
          {deliveryOrder.big_do_context.type === "completed_big_do" &&
            deliveryOrder.big_do_info && (
              <div className="lg:col-span-3 mt-6">
                <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-green-900 mb-2">
                    🚛 Part of Big Delivery Order
                  </h3>
                  <p className="text-green-700 text-sm mb-4">
                    This DO is part of Big DO:{" "}
                    <strong>{deliveryOrder.big_do_info.big_do_number}</strong>(
                    {deliveryOrder.big_do_info.total_dos_in_big_do} total
                    deliveries)
                  </p>

                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() =>
                        navigate(
                          `/big-delivery-orders/${deliveryOrder.big_delivery_order_id}`
                        )
                      }
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      View Big DO Details →
                    </button>

                    {deliveryOrder.big_do_info.sibling_dos.length > 0 && (
                      <div className="text-xs text-green-600">
                        Sibling DOs:{" "}
                        {deliveryOrder.big_do_info.sibling_dos.length}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
        </div>

        {/* 🎯 ENHANCED: Financial Information with Unit-aware Calculations */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Financial Summary</h2>

          {/* Revenue Calculations */}
          {deliveryOrder.unit_price && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">
                Revenue Calculation
              </h3>
              <div className="space-y-2 text-xs text-blue-700">
                <div className="flex justify-between">
                  <span>Unit Price:</span>
                  <span>
                    Rp {deliveryOrder.unit_price.toLocaleString("id-ID")}/
                    {unitDisplay}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Target Calculation:</span>
                  <span>
                    {getCalculationBreakdown(
                      deliveryOrder.minimal_load_quantity,
                      deliveryOrder.unit_price,
                      deliveryOrder.unit
                    )}
                  </span>
                </div>
                {deliveryOrder.actual_load_quantity && (
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Actual Calculation:</span>
                    <span>
                      {getCalculationBreakdown(
                        deliveryOrder.actual_load_quantity,
                        deliveryOrder.unit_price,
                        deliveryOrder.unit
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Trip Allowance</span>
              <span className="font-medium">
                Rp{" "}
                {deliveryOrder.financial_summary.trip_allowance.toLocaleString(
                  "id-ID"
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Driver Salary</span>
              <span className="font-medium">
                Rp{" "}
                {deliveryOrder.financial_summary.gaji.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-gray-600 font-medium">
                Total for Driver
              </span>
              <span className="font-bold">
                Rp{" "}
                {deliveryOrder.financial_summary.total_for_driver.toLocaleString(
                  "id-ID"
                )}
              </span>
            </div>

            {/* 🎯 ENHANCED: Revenue breakdown */}
            <div className="border-t pt-2 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Target Revenue</span>
                <span className="font-medium text-blue-600">
                  Rp{" "}
                  {deliveryOrder.financial_summary.minimal_total_amount?.toLocaleString(
                    "id-ID"
                  ) ||
                    deliveryOrder.financial_summary.total_amount.toLocaleString(
                      "id-ID"
                    )}
                </span>
              </div>

              {deliveryOrder.financial_summary.actual_total_amount &&
                deliveryOrder.financial_summary.actual_total_amount !==
                  deliveryOrder.financial_summary.minimal_total_amount && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Actual Revenue</span>
                    <span className="font-medium text-green-600">
                      Rp{" "}
                      {deliveryOrder.financial_summary.actual_total_amount.toLocaleString(
                        "id-ID"
                      )}
                    </span>
                  </div>
                )}

              {deliveryOrder.financial_summary.ongkosan && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Ongkosan (Profit)</span>
                  <span className="font-medium text-purple-600">
                    Rp{" "}
                    {deliveryOrder.financial_summary.ongkosan.toLocaleString(
                      "id-ID"
                    )}
                  </span>
                </div>
              )}

              {deliveryOrder.financial_summary.net_profit && (
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600 font-medium">Net Profit</span>
                  <span
                    className={`font-bold ${
                      deliveryOrder.financial_summary.net_profit >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    Rp{" "}
                    {deliveryOrder.financial_summary.net_profit.toLocaleString(
                      "id-ID"
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 🎯 NEW: Unit summary */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-600">
              <span className="font-medium">Pricing Unit:</span> {unitDisplay}(
              {deliveryOrder.unit === "kubik"
                ? "Volume-based pricing"
                : "Weight-based pricing"}
              )
            </div>
          </div>
        </div>

        {/* 🎯 ENHANCED: Quantity Information with Unit Support */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Quantity Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600">Target Quantity</label>
              <p className="font-medium text-lg">
                {deliveryOrder.minimal_load_quantity.toLocaleString("id-ID")}{" "}
                {unitDisplay}
              </p>
            </div>
            {deliveryOrder.actual_load_quantity && (
              <div>
                <label className="text-sm text-gray-600">Actual Quantity</label>
                <p className="font-medium text-green-600 text-lg">
                  {deliveryOrder.actual_load_quantity.toLocaleString("id-ID")}{" "}
                  {unitDisplay}
                </p>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{
                        width: `${Math.min(
                          (deliveryOrder.actual_load_quantity /
                            deliveryOrder.minimal_load_quantity) *
                            100,
                          100
                        )}%`,
                      }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.round(
                      (deliveryOrder.actual_load_quantity /
                        deliveryOrder.minimal_load_quantity) *
                        100
                    )}
                    % of target
                  </p>
                </div>

                {/* 🎯 NEW: Quantity comparison */}
                <div className="mt-3 text-xs">
                  {deliveryOrder.actual_load_quantity >
                  deliveryOrder.minimal_load_quantity ? (
                    <p className="text-green-600">
                      ✅ Excess:{" "}
                      {(
                        deliveryOrder.actual_load_quantity -
                        deliveryOrder.minimal_load_quantity
                      ).toLocaleString("id-ID")}{" "}
                      {unitDisplay}
                    </p>
                  ) : deliveryOrder.actual_load_quantity <
                    deliveryOrder.minimal_load_quantity ? (
                    <p className="text-orange-600">
                      ⚠️ Shortage:{" "}
                      {(
                        deliveryOrder.minimal_load_quantity -
                        deliveryOrder.actual_load_quantity
                      ).toLocaleString("id-ID")}{" "}
                      {unitDisplay}
                    </p>
                  ) : (
                    <p className="text-green-600">✅ Perfect match</p>
                  )}
                </div>
              </div>
            )}

            {/* 🎯 NEW: Unit-specific capacity info */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Unit Information
                </h4>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Measurement:</span>
                    <span className="font-medium">{unitDisplay}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type:</span>
                    <span className="font-medium">
                      {deliveryOrder.unit === "kubik" ? "Volume" : "Weight"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Driver & Vehicle Information */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Driver & Vehicle</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600">Driver</label>
              <p className="font-medium">
                {deliveryOrder.driver.driverProfile.full_name}
              </p>
              <p className="text-sm text-gray-500">
                {deliveryOrder.driver.driverProfile.phone}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Vehicle</label>
              <p className="font-medium">
                {deliveryOrder.vehicle.license_plate}
              </p>
              <p className="text-sm text-gray-500">
                {deliveryOrder.vehicle.type}
                {deliveryOrder.vehicle.capacity &&
                  ` (${deliveryOrder.vehicle.capacity} kg)`}
              </p>
            </div>
          </div>
        </div>

        {/* Location Information */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Location Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600">Load Location</label>
              <p className="font-medium">{deliveryOrder.load_location}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Unload Location</label>
              <p className="font-medium">{deliveryOrder.unload_location}</p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-3 bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Timeline</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Created</span>
              <span className="font-medium">
                {new Date(deliveryOrder.timeline.created_at).toLocaleString(
                  "id-ID"
                )}
              </span>
            </div>
            {deliveryOrder.timeline.departed_to_load_location_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Departed to Load Location</span>
                <span className="font-medium">
                  {new Date(
                    deliveryOrder.timeline.departed_to_load_location_at
                  ).toLocaleString("id-ID")}
                </span>
              </div>
            )}
            {deliveryOrder.timeline.arrived_at_load_location_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Arrived at Load Location</span>
                <span className="font-medium">
                  {new Date(
                    deliveryOrder.timeline.arrived_at_load_location_at
                  ).toLocaleString("id-ID")}
                </span>
              </div>
            )}
            {deliveryOrder.timeline.departed_from_load_location_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">
                  Departed from Load Location
                </span>
                <span className="font-medium">
                  {new Date(
                    deliveryOrder.timeline.departed_from_load_location_at
                  ).toLocaleString("id-ID")}
                </span>
              </div>
            )}
            {deliveryOrder.timeline.arrived_at_unload_location_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">
                  Arrived at Unload Location
                </span>
                <span className="font-medium">
                  {new Date(
                    deliveryOrder.timeline.arrived_at_unload_location_at
                  ).toLocaleString("id-ID")}
                </span>
              </div>
            )}
            {deliveryOrder.timeline.departed_from_unload_location_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">
                  Departed from Unload Location
                </span>
                <span className="font-medium">
                  {new Date(
                    deliveryOrder.timeline.departed_from_unload_location_at
                  ).toLocaleString("id-ID")}
                </span>
              </div>
            )}
            {deliveryOrder.timeline.completed_at && (
              <div className="flex justify-between">
                <span className="text-gray-600">Completed</span>
                <span className="font-medium text-green-600">
                  {new Date(deliveryOrder.timeline.completed_at).toLocaleString(
                    "id-ID"
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Surat Jalan Photo */}
        {Array.isArray(deliveryOrder.surat_jalan_photo_url) && deliveryOrder.surat_jalan_photo_url.length > 0 && (
          <div className="lg:col-span-3 bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Surat Jalan Photos</h2>
            <div className="flex flex-wrap gap-4">
              {deliveryOrder.surat_jalan_photo_url.map((url, idx) => (
                <div key={idx} className="max-w-xs">
                  <img
                    src={`${process.env.REACT_APP_BACKEND_URL || ""}/${url}`}
                    alt={`Surat Jalan ${idx + 1}`}
                    className="w-full h-auto rounded-lg border border-gray-300"
                  />
                  <div className="text-xs text-gray-500 mt-1 text-center">
                    Surat Jalan {idx + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryOrderDetailPage;
