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
        {deliveryOrder.surat_jalan_photo_url && (
          <div className="lg:col-span-3 bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Surat Jalan Photo</h2>
            <div className="max-w-md">
              <img
                src={deliveryOrder.surat_jalan_photo_url}
                alt="Surat Jalan"
                className="w-full h-auto rounded-lg border border-gray-300"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryOrderDetailPage;
