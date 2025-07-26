import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import apiClient from "../api/axiosConfig";

interface PurchaseOrderDetail {
  id: number;
  po_number: string;
  customer_name: string;
  item_name: string;
  total_quantity: number;
  unit: string; // 🎯 NEW: Add unit field
  delivered_quantity: number;
  remaining_quantity: number;
  unit_price?: number;
  total_amount?: number;
  status: string;
  load_location?: string;
  unload_location?: string;
  notes?: string;
  order_date: string;
  created_at: string;
  delivery_progress: {
    percentage: number;
    is_complete: boolean;
  };
  poDeliveryOrders: Array<{
    id: number;
    do_number: string;
    status: string;
    unit: string; // 🎯 NEW: Add unit field to DO
    minimal_load_quantity: number;
    actual_load_quantity?: number;
    total_amount: number;
    ongkosan?: number;
    driver: {
      driverProfile: {
        full_name: string;
      };
    };
    vehicle: {
      license_plate: string;
    };
    created_at: string;
  }>;
}

const PurchaseOrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [po, setPO] = useState<PurchaseOrderDetail | null>(null);
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

  // 🎯 NEW: Unit-aware price display
  const getPriceDisplay = (unitPrice: number, unit: string) => {
    const unitDisplay = getUnitDisplay(unit);

    if (unit === "ton") {
      const pricePerTon = unitPrice;
      const pricePerKg = unitPrice / 1000;
      return `Rp ${parseFloat(String(pricePerKg)).toLocaleString(
        "id-ID"
      )}/kg (Rp ${parseFloat(String(pricePerTon)).toLocaleString(
        "id-ID"
      )}/ton)`;
    }

    return `Rp ${parseFloat(String(unitPrice)).toLocaleString(
      "id-ID"
    )}/${unitDisplay}`;
  };

  useEffect(() => {
    const fetchPO = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(`/purchase-orders/${id}`);
        const data = response.data.data || response.data;

        // 🎯 FIX: Map API fields to interface (e.g., fulfilled_actual -> delivered_quantity)
        const mappedData = {
          ...data,
          delivered_quantity: data.fulfilled_actual ?? 0, // Key fix: Use API's "fulfilled_actual"
          remaining_quantity: data.remaining_quantity ?? 0,
          total_quantity: parseFloat(data.total_quantity) ?? 0, // Ensure numbers
          total_amount: parseFloat(data.total_amount) ?? 0,
          delivery_progress: {
            percentage: data.delivery_progress?.percentage ?? 0,
            is_complete: data.delivery_progress?.is_complete ?? false,
          },
          poDeliveryOrders: (data.poDeliveryOrders ?? []).map(
            (doItem: any) => ({
              ...doItem,
              minimal_load_quantity:
                parseFloat(doItem.minimal_load_quantity) ?? 0,
              actual_load_quantity:
                parseFloat(doItem.actual_load_quantity) ?? null,
              total_amount: parseFloat(doItem.total_amount) ?? 0,
              ongkosan: parseFloat(doItem.ongkosan) ?? null,
            })
          ),
        };

        // 🎯 NEW: Ensure unit field exists with fallback
        if (!mappedData.unit) {
          console.warn('PO data missing unit field, defaulting to "ton"');
          mappedData.unit = "ton";
        }

        // 🎯 NEW: Ensure delivery orders have unit field
        mappedData.poDeliveryOrders = mappedData.poDeliveryOrders.map(
          (dOrder: { unit: any }) => ({
            ...dOrder,
            unit: dOrder.unit || mappedData.unit, // Inherit from PO if missing
          })
        );

        // Debug log for sanity
        console.log("Mapped PO data:", mappedData);

        setPO(mappedData as PurchaseOrderDetail);
      } catch (err) {
        setError("Failed to fetch purchase order details.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchPO();
    }
  }, [id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-blue-100 text-blue-800";
      case "partial":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getDOStatusColor = (status: string) => {
    switch (status) {
      case "assigned":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  if (loading)
    return <div className="text-center p-8">Loading purchase order...</div>;
  if (error)
    return <div className="bg-red-100 text-red-700 p-4 rounded">{error}</div>;
  if (!po)
    return <div className="text-center p-8">Purchase order not found.</div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Purchase Order Details
        </h1>
        <div className="space-x-2">
          <button
            onClick={() => navigate("/trips")}
            className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded"
          >
            ← Back to List
          </button>
          <Link to={`/trips/po/${po.id}/edit`}>
            <button className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded">
              ✏️ Edit PO
            </button>
          </Link>
          {po.remaining_quantity > 0 &&
            po.status !== "completed" &&
            po.status !== "cancelled" && (
              <Link to={`/trips/po/${po.id}/create-do`}>
                <button className="bg-green-500 hover:bg-green-700 text-white px-4 py-2 rounded">
                  + Create Delivery Order
                </button>
              </Link>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Information */}
        <div className="lg:col-span-2 bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">PO Number</label>
              <p className="font-medium text-lg">{po.po_number}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Status</label>
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                  po.status
                )}`}
              >
                {po.status}
              </span>
            </div>
            <div>
              <label className="text-sm text-gray-600">Customer</label>
              <p className="font-medium">{po.customer_name}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Item</label>
              <p className="font-medium">{po.item_name}</p>
            </div>
            {/* 🎯 ENHANCED: Dynamic quantity with unit */}
            <div>
              <label className="text-sm text-gray-600">Total Quantity</label>
              <p className="font-medium">
                {po.total_quantity.toLocaleString("id-ID")}{" "}
                {getUnitDisplay(po.unit)}
              </p>
            </div>
            {/* 🎯 NEW: Unit Information */}
            <div>
              <label className="text-sm text-gray-600">Unit</label>
              <p className="font-medium">
                <span className="bg-gray-100 px-2 py-1 rounded text-sm">
                  {getUnitDisplay(po.unit)}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  (
                  {po.unit === "kilogram"
                    ? "Weight-based"
                    : po.unit === "ton"
                    ? "Weight-based (tons)"
                    : "Volume-based"}
                  )
                </span>
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Order Date</label>
              <p className="font-medium">
                {new Date(po.order_date).toLocaleDateString("id-ID")}
              </p>
            </div>
          </div>

          {/* 🎯 ENHANCED: Financial Information with Unit */}
          {(po.unit_price || po.total_amount) && (
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-lg font-semibold mb-3">
                Financial Information
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {po.unit_price && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <label className="text-sm text-gray-600">Unit Price</label>
                    <p className="font-medium text-blue-800">
                      {getPriceDisplay(po.unit_price, po.unit)}
                    </p>
                    {po.unit === "ton" && (
                      <p className="text-xs text-blue-600 mt-1">
                        💡 Pricing is per kilogram, calculated as tons for
                        convenience
                      </p>
                    )}
                  </div>
                )}
                {po.total_amount && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <label className="text-sm text-gray-600">
                      Total Amount
                    </label>
                    <p className="font-medium text-green-600 text-lg">
                      Rp{" "}
                      {parseFloat(String(po.total_amount)).toLocaleString(
                        "id-ID"
                      )}
                    </p>
                    {po.unit_price && (
                      <p className="text-xs text-green-600 mt-1">
                        {po.total_quantity} {getUnitDisplay(po.unit)} ×{" "}
                        {getPriceDisplay(po.unit_price, po.unit)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {po.notes && (
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-lg font-semibold mb-3">Notes</h3>
              <p className="text-gray-700">{po.notes}</p>
            </div>
          )}
        </div>

        {/* 🎯 ENHANCED: Progress Summary with Unit */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Progress Summary</h2>
          <div className="space-y-4">
            {/* ✅ Delivered - Enhanced with breakdown */}
            <div>
              <label className="text-sm text-gray-600">Delivered</label>
              <div className="flex items-center justify-between">
                <p className="font-medium text-green-600">
                  {po.delivered_quantity.toLocaleString("id-ID")}{" "}
                  {getUnitDisplay(po.unit)}
                </p>
                {po.delivered_quantity > po.total_quantity && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <svg
                      className="w-3 h-3 mr-1"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Over Target
                  </span>
                )}
              </div>
            </div>

            {/* 🎯 ENHANCED: Smart Remaining/Excess Display */}
            <div>
              <label className="text-sm text-gray-600">
                {po.remaining_quantity < 0 ? "Excess Delivery" : "Remaining"}
              </label>
              {po.remaining_quantity < 0 ? (
                // Excess delivery case
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-blue-700">
                        +
                        {Math.abs(po.remaining_quantity).toLocaleString(
                          "id-ID"
                        )}{" "}
                        {getUnitDisplay(po.unit)}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        📦 Delivered more than ordered
                      </p>
                    </div>
                    <div className="flex items-center text-blue-600">
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              ) : (
                // Normal remaining case
                <p className="font-medium text-orange-600">
                  {po.remaining_quantity.toLocaleString("id-ID")}{" "}
                  {getUnitDisplay(po.unit)}
                </p>
              )}
            </div>

            {/* 🎯 ENHANCED: Smart Progress Display */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-gray-600">Progress</label>
                <span
                  className={`text-sm font-medium ${
                    po.delivery_progress.percentage > 100
                      ? "text-blue-600"
                      : po.delivery_progress.percentage === 100
                      ? "text-green-600"
                      : "text-gray-600"
                  }`}
                >
                  {Math.round(po.delivery_progress.percentage)}%
                  {po.delivery_progress.percentage > 100 && " (Over-delivered)"}
                  {po.delivery_progress.percentage === 100 && " (Complete)"}
                </span>
              </div>

              {/* Enhanced Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 mt-1 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${
                    po.delivery_progress.percentage > 100
                      ? "bg-gradient-to-r from-green-500 to-blue-500"
                      : po.delivery_progress.percentage === 100
                      ? "bg-green-500"
                      : "bg-blue-600"
                  }`}
                  style={{
                    width: `${Math.min(po.delivery_progress.percentage, 100)}%`,
                  }}
                ></div>
                {/* Overflow indicator for >100% */}
                {po.delivery_progress.percentage > 100 && (
                  <div
                    className="h-3 bg-blue-400 opacity-60 -mt-3 rounded-full"
                    style={{
                      width: `${Math.min(
                        po.delivery_progress.percentage - 100,
                        20
                      )}%`,
                      marginLeft: "100%",
                    }}
                  ></div>
                )}
              </div>

              {/* Progress Status Message */}
              <div className="mt-2">
                {po.delivery_progress.percentage > 100 ? (
                  <div className="flex items-center text-xs text-blue-600">
                    <svg
                      className="w-3 h-3 mr-1"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Exceeded target by{" "}
                    {(po.delivery_progress.percentage - 100).toFixed(1)}%
                  </div>
                ) : po.delivery_progress.percentage === 100 ? (
                  <div className="flex items-center text-xs text-green-600">
                    <svg
                      className="w-3 h-3 mr-1"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Target achieved perfectly!
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">
                    {(100 - po.delivery_progress.percentage).toFixed(1)}%
                    remaining to complete
                  </p>
                )}
              </div>
            </div>

            {/* 🎯 ENHANCED: Delivery Performance Insights */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Delivery Performance
                </h4>

                {/* Performance Metrics Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-2 rounded border-l-4 border-blue-500">
                    <div className="text-xs text-gray-500">Total Ordered</div>
                    <div className="font-medium text-gray-900">
                      {po.total_quantity.toLocaleString("id-ID")}{" "}
                      {getUnitDisplay(po.unit)}
                    </div>
                  </div>

                  <div className="bg-white p-2 rounded border-l-4 border-green-500">
                    <div className="text-xs text-gray-500">Total Delivered</div>
                    <div className="font-medium text-gray-900">
                      {po.delivered_quantity.toLocaleString("id-ID")}{" "}
                      {getUnitDisplay(po.unit)}
                    </div>
                  </div>

                  <div className="bg-white p-2 rounded border-l-4 border-purple-500">
                    <div className="text-xs text-gray-500">Unit Type</div>
                    <div className="font-medium text-gray-900">
                      {po.unit === "kubik" ? "Volume-based" : "Weight-based"}
                    </div>
                  </div>

                  <div
                    className={`bg-white p-2 rounded border-l-4 ${
                      po.delivery_progress.percentage > 100
                        ? "border-blue-500"
                        : po.delivery_progress.percentage === 100
                        ? "border-green-500"
                        : "border-orange-500"
                    }`}
                  >
                    <div className="text-xs text-gray-500">Status</div>
                    <div
                      className={`font-medium ${
                        po.delivery_progress.percentage > 100
                          ? "text-blue-600"
                          : po.delivery_progress.percentage === 100
                          ? "text-green-600"
                          : "text-orange-600"
                      }`}
                    >
                      {po.delivery_progress.percentage > 100
                        ? "Over-delivered"
                        : po.delivery_progress.percentage === 100
                        ? "Complete"
                        : "In Progress"}
                    </div>
                  </div>
                </div>

                {/* 🎯 NEW: Efficiency Score */}
                <div className="mt-3 p-2 bg-gradient-to-r from-blue-50 to-green-50 rounded border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-600">
                        Delivery Efficiency
                      </div>
                      <div className="font-semibold text-gray-800">
                        {po.delivery_progress.percentage > 100 ? (
                          <span className="text-blue-600">
                            {po.delivery_progress.percentage.toFixed(1)}%
                            <span className="text-xs font-normal">
                              {" "}
                              (Exceeded)
                            </span>
                          </span>
                        ) : (
                          <span
                            className={
                              po.delivery_progress.percentage === 100
                                ? "text-green-600"
                                : "text-orange-600"
                            }
                          >
                            {po.delivery_progress.percentage.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        po.delivery_progress.percentage > 100
                          ? "bg-blue-100 text-blue-600"
                          : po.delivery_progress.percentage === 100
                          ? "bg-green-100 text-green-600"
                          : "bg-orange-100 text-orange-600"
                      }`}
                    >
                      {po.delivery_progress.percentage > 100 ? (
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : po.delivery_progress.percentage === 100 ? (
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Location Information */}
      {(po.load_location || po.unload_location) && (
        <div className="lg:col-span-3 bg-white shadow-md rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Location Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">Load Location</label>
              <p className="font-medium">
                {po.load_location || "Not specified"}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Unload Location</label>
              <p className="font-medium">
                {po.unload_location || "Not specified"}
              </p>
            </div>
          </div>
          {(!po.load_location || !po.unload_location) && (
            <p className="text-sm text-gray-500 mt-2">
              💡 Locations can be specified when creating delivery orders
            </p>
          )}
        </div>
      )}

      {/* 🎯 ENHANCED: Delivery Orders with Unit Support */}
      <div className="lg:col-span-3 bg-white shadow-md rounded-lg p-6 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            Delivery Orders ({po.poDeliveryOrders?.length || 0})
          </h2>
          <Link to={`/delivery-orders?po_id=${po.id}`}>
            <button className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
              View All Delivery Orders
            </button>
          </Link>
        </div>

        {po.poDeliveryOrders && po.poDeliveryOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full leading-normal">
              <thead>
                <tr>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
                    DO Number
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
                    Driver
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
                    Vehicle
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
                    Quantity
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
                    Revenue
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
                    Ongkosan
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase">
                    Status
                  </th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-right text-xs font-semibold text-gray-600 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {po.poDeliveryOrders.map((dOrder) => {
                  const doUnitDisplay = getUnitDisplay(dOrder.unit || po.unit);
                  return (
                    <tr key={dOrder.id}>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        <p className="text-gray-900 whitespace-no-wrap font-medium">
                          {dOrder.do_number}
                        </p>
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        <p className="text-gray-900 whitespace-no-wrap">
                          {dOrder.driver?.driverProfile?.full_name || "N/A"}
                        </p>
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        <p className="text-gray-900 whitespace-no-wrap">
                          {dOrder.vehicle?.license_plate || "N/A"}
                        </p>
                      </td>
                      {/* 🎯 ENHANCED: Dynamic quantity with unit */}
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        <div>
                          <p className="text-gray-900">
                            Target: {dOrder.minimal_load_quantity}{" "}
                            {doUnitDisplay}
                          </p>
                          {dOrder.actual_load_quantity && (
                            <p className="text-green-600 text-xs">
                              Actual: {dOrder.actual_load_quantity}{" "}
                              {doUnitDisplay}
                            </p>
                          )}
                          {/* 🎯 NEW: Unit mismatch warning */}
                          {dOrder.unit && dOrder.unit !== po.unit && (
                            <p className="text-orange-600 text-xs">
                              ⚠️ Unit: {doUnitDisplay} (differs from PO)
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        <p className="text-green-600 font-medium">
                          Rp{" "}
                          {parseFloat(
                            String(dOrder.total_amount)
                          ).toLocaleString("id-ID")}
                        </p>
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        {dOrder.ongkosan ? (
                          <p className="text-blue-600 font-medium">
                            Rp{" "}
                            {parseFloat(String(dOrder.ongkosan)).toLocaleString(
                              "id-ID"
                            )}
                          </p>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getDOStatusColor(
                            dOrder.status
                          )}`}
                        >
                          {dOrder.status}
                        </span>
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right">
                        <Link
                          to={`/delivery-orders/${dOrder.id}`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Financial Summary */}
            <div className="mt-4 p-4 bg-gray-50 rounded-md">
              <h3 className="font-semibold text-gray-800 mb-2">
                Financial Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Revenue:</span>
                  <span className="font-semibold text-green-600 ml-2">
                    Rp{" "}
                    {po.poDeliveryOrders
                      .reduce(
                        (sum, dOrder) =>
                          sum + parseFloat(String(dOrder.total_amount)),
                        0
                      )
                      .toLocaleString("id-ID")}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Total Ongkosan:</span>
                  <span className="font-semibold text-blue-600 ml-2">
                    Rp{" "}
                    {po.poDeliveryOrders
                      .reduce(
                        (sum, dOrder) =>
                          sum + parseFloat(String(dOrder.ongkosan || 0)),
                        0
                      )
                      .toLocaleString("id-ID")}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Completed Orders:</span>
                  <span className="font-semibold ml-2">
                    {
                      po.poDeliveryOrders.filter(
                        (dOrder) => dOrder.status === "completed"
                      ).length
                    }{" "}
                    / {po.poDeliveryOrders.length}
                  </span>
                </div>
              </div>

              {/* 🎯 NEW: Unit Summary */}
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Unit Type:</span>{" "}
                  {getUnitDisplay(po.unit)}(
                  {po.unit === "kubik"
                    ? "Volume-based pricing"
                    : "Weight-based pricing"}
                  )
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No delivery orders created yet.</p>
            {po.remaining_quantity > 0 && (
              <Link to={`/trips/po/${po.id}/create-do`}>
                <button className="mt-4 bg-green-500 hover:bg-green-700 text-white px-4 py-2 rounded">
                  Create First Delivery Order
                </button>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseOrderDetailPage;
