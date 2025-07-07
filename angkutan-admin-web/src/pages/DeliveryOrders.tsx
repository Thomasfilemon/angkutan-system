// src/pages/DeliveryOrders.tsx
import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import apiClient from "../api/axiosConfig";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

interface DeliveryOrder {
  id: number;
  do_number: string;
  customer_name: string;
  item_name: string;
  minimal_load_quantity: number;
  actual_load_quantity?: number;
  unit: string;
  unit_price?: number;
  status: string;
  status_text: string;
  driver_name: string;
  vehicle_info: string;
  created_at: string;
  financial_summary: {
    trip_allowance: number;
    gaji: number;
    total_for_driver: number;
    minimal_total_amount: number;
    actual_total_amount?: number;
    ongkosan: number;
    net_profit: number;
    unit: string;
    unit_display: string;
  };
  purchaseOrder?: {
    po_number: string;
    unit?: string;
  };
  surat_jalan_photo_url?: string;
  ongkosan?: number;
}

const DeliveryOrdersPage = () => {
  const [searchParams] = useSearchParams();
  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stats, setStats] = useState({
    total: 0,
    assigned: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  });

  const poId = searchParams.get("po_id");

  // 🎯 NEW: Unit display helper
  const getUnitDisplay = (unit: string) => {
    const unitMap = {
      kilogram: "kg",
      ton: "ton",
      kubik: "m³",
    };
    return unitMap[unit as keyof typeof unitMap] || unit;
  };

  // 🎯 NEW: Get unit with fallback
  const getOrderUnit = (order: DeliveryOrder) => {
    return order.unit || order.purchaseOrder?.unit || "ton";
  };

  useEffect(() => {
    fetchDeliveryOrders();
  }, [statusFilter, poId]);

  const fetchDeliveryOrders = async () => {
    try {
      setLoading(true);
      let url = "/delivery-orders";
      const params = new URLSearchParams();

      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      if (poId) {
        params.append("po_id", poId);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await apiClient.get(url);

      // ✅ FIX: Handle full response format
      const orders = response.data.success
        ? response.data.data
        : response.data || [];
      const stats = response.data.success ? response.data.stats : null;

      // 🎯 NEW: Ensure unit field exists with fallback
      const processedOrders = orders.map((order: DeliveryOrder) => ({
        ...order,
        unit: order.unit || order.purchaseOrder?.unit || "ton",
      }));

      setDeliveryOrders(processedOrders);

      // ✅ FIX: Use extracted stats
      if (stats) {
        setStats(stats);
      }
    } catch (err) {
      setError("Failed to fetch delivery orders.");
      console.error(err);
    } finally {
      setLoading(false);
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
    return <div className="text-center p-8">Loading delivery orders...</div>;
  if (error)
    return <div className="bg-red-100 text-red-700 p-4 rounded">{error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Delivery Orders</h1>
          {poId && (
            <p className="text-gray-600 mt-1">
              Filtered by Purchase Order ID: {poId}
              <Link
                to="/delivery-orders"
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                (Clear filter)
              </Link>
            </p>
          )}
        </div>
        <Link to="/trips">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            ← Back to Purchase Orders
          </button>
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">Total</h3>
          <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">Assigned</h3>
          <p className="text-2xl font-bold text-yellow-600">{stats.assigned}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">In Progress</h3>
          <p className="text-2xl font-bold text-blue-600">
            {stats.in_progress}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">Completed</h3>
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700">Cancelled</h3>
          <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filter by Status:
        </label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="assigned">Assigned</option>
          <option value="otw_to_load_location">On Way to Load</option>
          <option value="at_load_location">At Load Location</option>
          <option value="otw_to_unload_location">On Way to Unload</option>
          <option value="at_unload_location">At Unload Location</option>
          <option value="otw_to_base">Returning to Base</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* 🎯 ENHANCED: Delivery Orders List with Unit Support */}
      <div className="bg-white shadow-xl rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                DO Number
              </th>
              <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                PO Number
              </th>
              <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Driver
              </th>
              <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Vehicle
              </th>
              <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Quantity & Unit
              </th>
              <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                Total Amount
              </th>
              {/* 🎯 NARROW: Document column */}
              <th className="w-12 px-2 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                Doc
              </th>
              {/* 🎯 NARROW: Actions column */}
              <th className="w-16 px-2 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {deliveryOrders.length > 0 ? (
              deliveryOrders.map((dOrder, index) => {
                const orderUnit = getOrderUnit(dOrder);
                const unitDisplay = getUnitDisplay(orderUnit);
                const unitPrice = dOrder.unit_price
                  ? parseFloat(dOrder.unit_price.toString())
                  : 0;

                return (
                  <tr
                    key={dOrder.id}
                    className={`hover:bg-gray-50 transition-colors duration-150 ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-25"
                    }`}
                  >
                    {/* DO Number */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {dOrder.do_number}
                      </div>
                    </td>

                    {/* PO Number */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">
                        {dOrder.purchaseOrder?.po_number || "N/A"}
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900 leading-tight">
                          {dOrder.customer_name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {dOrder.item_name}
                        </div>
                      </div>
                    </td>

                    {/* Driver */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">
                        {dOrder.driver_name}
                      </div>
                    </td>

                    {/* Vehicle */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">
                        {dOrder.vehicle_info}
                      </div>
                    </td>

                    {/* 🎯 IMPROVED: Quantity & Unit Column */}
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        {/* Target quantity */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Target:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {parseFloat(
                              dOrder.minimal_load_quantity.toString()
                            ).toLocaleString("id-ID")}{" "}
                            {unitDisplay}
                          </span>
                        </div>

                        {/* Actual quantity */}
                        {dOrder.actual_load_quantity && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              Actual:
                            </span>
                            <span className="text-sm font-medium text-green-600">
                              {parseFloat(
                                dOrder.actual_load_quantity.toString()
                              ).toLocaleString("id-ID")}{" "}
                              {unitDisplay}
                            </span>
                          </div>
                        )}

                        {/* Unit badge and progress */}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center space-x-1">
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                              {unitDisplay}
                            </span>
                            <span className="text-xs text-gray-400">
                              ({orderUnit === "kubik" ? "Vol" : "Wt"})
                            </span>
                          </div>

                          {/* Progress indicator */}
                          {dOrder.actual_load_quantity && (
                            <span
                              className={`text-xs font-medium ${
                                dOrder.actual_load_quantity >=
                                dOrder.minimal_load_quantity
                                  ? "text-green-600"
                                  : "text-orange-600"
                              }`}
                            >
                              {Math.round(
                                (dOrder.actual_load_quantity /
                                  dOrder.minimal_load_quantity) *
                                  100
                              )}
                              %
                            </span>
                          )}
                        </div>

                        {/* Progress bar */}
                        {dOrder.actual_load_quantity && (
                          <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                            <div
                              className={`h-1 rounded-full transition-all duration-300 ${
                                dOrder.actual_load_quantity >=
                                dOrder.minimal_load_quantity
                                  ? "bg-green-500"
                                  : "bg-orange-500"
                              }`}
                              style={{
                                width: `${Math.min(
                                  (dOrder.actual_load_quantity /
                                    dOrder.minimal_load_quantity) *
                                    100,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 🎯 IMPROVED: Status Column */}
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          dOrder.status
                        )}`}
                      >
                        {dOrder.status_text}
                      </span>
                    </td>

                    {/* 🎯 IMPROVED: Total Amount (Right-aligned for numbers) */}
                    <td className="px-4 py-4 text-right">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          Rp{" "}
                          {(
                            dOrder.financial_summary.minimal_total_amount || 0
                          ).toLocaleString("de-DE")}
                        </div>

                        {/* Actual amount if different */}
                        {dOrder.financial_summary.actual_total_amount &&
                          dOrder.financial_summary.actual_total_amount !==
                            dOrder.financial_summary.minimal_total_amount && (
                            <div className="text-xs text-green-600 mt-0.5">
                              Actual: Rp{" "}
                              {dOrder.financial_summary.actual_total_amount.toLocaleString(
                                "de-DE"
                              )}
                            </div>
                          )}

                        {/* Unit price info */}
                        {dOrder.unit_price && (
                          <div className="text-xs text-gray-500 mt-1">
                            @Rp {unitPrice.toLocaleString("de-DE")}/
                            {unitDisplay}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 🎯 NARROW: Document Column */}
                    <td className="w-12 px-2 py-4 text-center">
                      {Array.isArray(dOrder.surat_jalan_photo_url) &&
                      dOrder.surat_jalan_photo_url.length > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-center">
                          {dOrder.surat_jalan_photo_url.map((url, idx) => (
                            <a
                              key={idx}
                              href={`${BACKEND_URL}/${url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center w-7 h-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-all duration-200"
                              title={`View Document #${idx + 1}`}
                            >
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
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <div
                          className="inline-flex items-center justify-center w-7 h-7 text-gray-300"
                          title="No document"
                        >
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
                              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636"
                            />
                          </svg>
                        </div>
                      )}
                    </td>

                    {/* 🎯 NARROW: Actions Column */}
                    <td className="w-16 px-2 py-4">
                      <div className="flex items-center justify-center space-x-1">
                        {/* View Details */}
                        <Link
                          to={`/delivery-orders/${dOrder.id}`}
                          className="inline-flex items-center justify-center w-7 h-7 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-all duration-200"
                          title="View Details"
                        >
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
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        </Link>

                        {/* Quick Edit (only for non-completed orders) */}
                        {dOrder.status !== "completed" &&
                          dOrder.status !== "cancelled" && (
                            <button
                              onClick={() => {
                                /* Handle quick edit */
                              }}
                              className="inline-flex items-center justify-center w-7 h-7 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md transition-all duration-200"
                              title="Quick Edit"
                            >
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
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-12 text-center text-gray-500"
                >
                  <div className="flex flex-col items-center">
                    <svg
                      className="w-12 h-12 text-gray-300 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <p className="text-lg font-medium">
                      No delivery orders found
                    </p>
                    <p className="text-sm">
                      Try adjusting your filters to see more results.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 🎯 NEW: Unit Summary Stats */}
      {deliveryOrders.length > 0 && (
        <div className="mt-6 bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Unit Distribution
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {(["kilogram", "ton", "kubik"] as const).map((unit) => {
              const unitOrders = deliveryOrders.filter(
                (order) => getOrderUnit(order) === unit
              );
              const unitDisplay = getUnitDisplay(unit);

              if (unitOrders.length === 0) return null;

              return (
                <div key={unit} className="bg-gray-50 p-3 rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{unitDisplay} Orders:</span>
                    <span className="text-blue-600 font-bold">
                      {unitOrders.length}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Total:{" "}
                    {unitOrders
                      .reduce(
                        (sum, order) =>
                          sum +
                          (parseFloat(String(order.actual_load_quantity)) ||
                            parseFloat(String(order.minimal_load_quantity))),
                        0
                      )
                      .toLocaleString("id-ID")}{" "}
                    {unitDisplay}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryOrdersPage;
