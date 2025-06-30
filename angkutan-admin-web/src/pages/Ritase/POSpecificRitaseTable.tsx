// src/pages/Ritase/POSpecificRitaseTable.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../../api/axiosConfig";

interface PODeliveryOrder {
  id: number;
  do_number: string;
  created_at: string;
  completed_at: string;
  vehicle: {
    id: number;
    license_plate: string;
    type: string;
  };
  driver: {
    username: string;
    driverProfile: {
      full_name: string;
    };
  };
  item_name: string;
  minimal_load_quantity: number;
  actual_load_quantity: number;
  unit: string;
  unit_price: number;
  trip_allowance: number;
  gaji: number;
  status: string;
  payment_status: string;
  calculated: {
    actualQuantity: number;
    grossIncome: number;
    operationalCosts: number;
    netProfit: number;
    profitMargin: number;
  };
}

interface POData {
  purchase_order: {
    id: number;
    po_number: string;
    customer_name: string;
    item_name: string;
    total_quantity: number;
    unit: string;
    unit_price: number;
    total_amount: number;
    order_date: string;
    status: string;
  };
  delivery_orders: PODeliveryOrder[];
  summary: {
    total_dos: number;
    completed_dos: number;
    pending_dos: number;
    total_quantity_delivered: number;
    total_revenue: number;
    total_operational_costs: number;
    total_net_profit: number;
    outstanding_payments: number;
    completion_percentage: number;
    profit_margin: number;
    unit_analytics: {
      po_unit: string;
      po_unit_display: string;
      pricing_strategy: string;
      unit_consistency: boolean;
      mixed_units: string[];
    };
    vehicle_analytics: Record<
      string,
      {
        vehicle_info: any;
        trip_count: number;
        completed_trips: number;
        total_quantity: number;
        total_revenue: number;
        total_profit: number;
        avg_profit_margin: number;
      }
    >;
  };
  metadata: {
    filters_available: {
      vehicles: Array<{
        id: number | null;
        license_plate: string;
        type: string;
        display_name: string;
      }>;
      statuses: string[];
      payment_statuses: string[];
    };
    unit_context: {
      po_unit: string;
      consistent_units: boolean;
      pricing_type: string;
    };
  };
}

const POSpecificRitaseTable: React.FC = () => {
  const { poId } = useParams<{ poId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [poData, setPOData] = useState<POData | null>(null);
  const [filteredData, setFilteredData] = useState<PODeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters specific to this PO
  const [filters, setFilters] = useState({
    startDate: searchParams.get("startDate") || "",
    endDate: searchParams.get("endDate") || "",
    deliveryStatus: searchParams.get("deliveryStatus") || "all",
    paymentStatus: searchParams.get("paymentStatus") || "all",
    vehicleId: searchParams.get("vehicleId") || "all",
  });

  const [sortConfig, setSortConfig] = useState({
    key: "created_at",
    direction: "desc" as "asc" | "desc",
  });

  // 🎯 NEW: Unit display helper
  const getUnitDisplay = (unit: string) => {
    const unitMap = {
      kilogram: "kg",
      ton: "ton",
      kubik: "m³",
    };
    return unitMap[unit as keyof typeof unitMap] || unit;
  };

  // 🎯 NEW: Get PO unit with fallback
  const getPOUnit = () => {
    return poData?.purchase_order?.unit || "ton";
  };

  // 🎯 NEW: Get DO unit with fallback to PO unit
  const getDOUnit = (order: PODeliveryOrder) => {
    return order.unit || getPOUnit();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Fetch PO-specific data
  const fetchPOData = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(
        `/ritase/purchase-orders/${poId}/comprehensive`
      );
      const data = response.data.data || response.data;

      // 🎯 NEW: Ensure unit fields exist with fallback
      if (!data.purchase_order.unit) {
        console.warn('PO data missing unit field, defaulting to "ton"');
        data.purchase_order.unit = "ton";
      }

      // 🎯 NEW: Ensure delivery orders have unit field
      if (data.delivery_orders) {
        data.delivery_orders = data.delivery_orders.map(
          (dOrder: PODeliveryOrder) => ({
            ...dOrder,
            unit: dOrder.unit || data.purchase_order.unit || "ton", // Inherit from PO if missing
          })
        );
      }

      setPOData(data);
      setFilteredData(data.delivery_orders);
    } catch (error) {
      console.error("Error fetching PO data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (poId) {
      fetchPOData();
    }
  }, [poId]);

  // Apply filters
  useEffect(() => {
    if (!poData) return;

    let filtered = [...poData.delivery_orders];

    // Date filtering
    if (filters.startDate) {
      filtered = filtered.filter(
        (order) => new Date(order.created_at) >= new Date(filters.startDate)
      );
    }
    if (filters.endDate) {
      filtered = filtered.filter(
        (order) =>
          new Date(order.created_at) <= new Date(filters.endDate + "T23:59:59")
      );
    }

    // Status filtering
    if (filters.deliveryStatus !== "all") {
      filtered = filtered.filter(
        (order) => order.status === filters.deliveryStatus
      );
    }
    if (filters.paymentStatus !== "all") {
      filtered = filtered.filter(
        (order) => order.payment_status === filters.paymentStatus
      );
    }

    // 🎯 FIXED: Vehicle filtering
    if (filters.vehicleId !== "all") {
      filtered = filtered.filter((order) => {
        const vehicleId = order.vehicle?.id?.toString();
        const licensePlate = order.vehicle?.license_plate;
        return (
          vehicleId === filters.vehicleId || licensePlate === filters.vehicleId
        );
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      const aVal = a[sortConfig.key as keyof PODeliveryOrder] as any;
      const bVal = b[sortConfig.key as keyof PODeliveryOrder] as any;

      if (sortConfig.direction === "asc") {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    setFilteredData(filtered);

    // Update URL params
    const newSearchParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "all") {
        newSearchParams.set(key, value);
      }
    });
    setSearchParams(newSearchParams);
  }, [poData, filters, sortConfig]);

  const getAvailableVehicles = () => {
    if (poData?.metadata?.filters_available?.vehicles) {
      return poData.metadata.filters_available.vehicles;
    }

    // Fallback: Extract unique vehicles from delivery orders
    if (!poData?.delivery_orders) return [];

    const uniqueVehicles = new Map();
    poData.delivery_orders.forEach((order) => {
      if (order.vehicle) {
        const key = order.vehicle.id || order.vehicle.license_plate;
        if (!uniqueVehicles.has(key)) {
          uniqueVehicles.set(key, {
            id: order.vehicle.id,
            license_plate: order.vehicle.license_plate,
            type: order.vehicle.type,
            display_name: `${order.vehicle.license_plate} (${order.vehicle.type})`,
          });
        }
      }
    });

    return Array.from(uniqueVehicles.values());
  };

  // Status badge styling
  const getDeliveryStatusBadge = (status: string) => {
    const config = {
      completed: "bg-green-100 text-green-800 border-green-200",
      assigned: "bg-blue-100 text-blue-800 border-blue-200",
      otw_to_load_location: "bg-yellow-100 text-yellow-800 border-yellow-200",
      at_load_location: "bg-orange-100 text-orange-800 border-orange-200",
      cancelled: "bg-red-100 text-red-800 border-red-200",
    };
    return (
      config[status as keyof typeof config] ||
      "bg-gray-100 text-gray-800 border-gray-200"
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const config = {
      lunas: "bg-green-100 text-green-800 border-green-200",
      deposit: "bg-blue-100 text-blue-800 border-blue-200",
      proses_tagihan: "bg-yellow-100 text-yellow-800 border-yellow-200",
      awaiting_confirmation: "bg-orange-100 text-orange-800 border-orange-200",
    };
    return (
      config[status as keyof typeof config] ||
      "bg-gray-100 text-gray-800 border-gray-200"
    );
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!poData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            PO Not Found
          </h2>
          <p className="text-gray-600 mb-4">
            The requested Purchase Order could not be found.
          </p>
          <button
            onClick={() => navigate("/ritase/comprehensive")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - PO Information */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-start mb-6">
            {/* Navigation */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate("/ritase/comprehensive")}
                className="flex items-center px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
              >
                <svg
                  className="h-4 w-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span className="text-sm font-medium">Back</span>
              </button>

              <div className="h-6 w-px bg-white/20"></div>

              <button
                onClick={() => navigate(`/ritase/po/${poId}`)}
                className="flex items-center space-x-2 bg-white/15 hover:bg-white/25 px-4 py-2 rounded-lg transition-colors border border-white/20"
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
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <span className="text-sm font-medium">Card View</span>
              </button>
            </div>

            {/* PO Info */}
            <div className="text-right">
              <span className="text-blue-100 text-sm font-medium">
                Purchase Order Detail
              </span>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {poData.purchase_order.po_number}
              </h1>
              <p className="text-blue-100 text-sm">
                {poData.purchase_order.customer_name} •{" "}
                {formatDate(poData.purchase_order.order_date)}
              </p>
            </div>
          </div>

          {/* PO Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-white">
                <div className="text-2xl font-bold">
                  {poData.summary.completed_dos}/{poData.summary.total_dos}
                </div>
                <div className="text-blue-100 text-sm">Completed DOs</div>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-white">
                <div className="text-2xl font-bold">
                  {formatCurrency(poData.summary.total_revenue)}
                </div>
                <div className="text-blue-100 text-sm">Total Revenue</div>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-white">
                <div className="text-2xl font-bold">
                  {formatCurrency(poData.summary.total_net_profit)}
                </div>
                <div className="text-blue-100 text-sm">Net Profit</div>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-white">
                <div className="text-2xl font-bold">
                  {poData.summary.completion_percentage.toFixed(1)}%
                </div>
                <div className="text-blue-100 text-sm">Completion Rate</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tanggal Mulai
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, startDate: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tanggal Akhir
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, endDate: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 🎯 FIXED: Vehicle Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kendaraan
              </label>
              <select
                value={filters.vehicleId}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, vehicleId: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Semua Kendaraan</option>
                {getAvailableVehicles().map((vehicle) => (
                  <option
                    key={vehicle.id || vehicle.license_plate}
                    value={vehicle.id || vehicle.license_plate}
                  >
                    {vehicle.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status Delivery Order
              </label>
              <select
                value={filters.deliveryStatus}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    deliveryStatus: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Semua Status</option>
                <option value="completed">Selesai</option>
                <option value="assigned">Ditugaskan</option>
                <option value="otw_to_load_location">OTW ke Lokasi Muat</option>
                <option value="at_load_location">Di Lokasi Muat</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status Pembayaran
              </label>
              <select
                value={filters.paymentStatus}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    paymentStatus: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Semua Status</option>
                <option value="lunas">LUNAS</option>
                <option value="deposit">DEPOSIT</option>
                <option value="proses_tagihan">PROSES TAGIHAN</option>
                <option value="awaiting_confirmation">
                  AWAITING CONFIRMATION
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Delivery Orders Table */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Delivery Orders - {poData.purchase_order.po_number}
                </h2>
                <p className="text-sm text-gray-600">
                  {filteredData.length} dari {poData.summary.total_dos} delivery
                  orders • Item: {poData.purchase_order.item_name}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("do_number")}
                  >
                    Nomor DO
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("created_at")}
                  >
                    Tanggal Jalan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tanggal Bongkar
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plat Nomor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nama Supir
                  </th>
                  {/* 🎯 FIXED: Dynamic unit in header */}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty Aktual ({getUnitDisplay(getPOUnit())})
                  </th>
                  {/* 🎯 FIXED: Unit-aware price header */}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Harga Satuan (Rp/{getUnitDisplay(getPOUnit())})
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("calculated.grossIncome")}
                  >
                    Pendapatan Kotor
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uang Jalan
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gaji
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("calculated.netProfit")}
                  >
                    Pendapatan Bersih
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status DO
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status Pembayaran
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((order) => {
                  // 🎯 DEFINE VARIABLES FOR EACH ROW
                  const doUnit = getDOUnit(order);
                  const unitDisplay = getUnitDisplay(doUnit);

                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.do_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(order.completed_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.vehicle.license_plate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.driver.driverProfile.full_name ||
                          order.driver.username}
                      </td>

                      {/* 🎯 FIXED: Dynamic unit display */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        <div>
                          <div className="font-medium">
                            {order.calculated.actualQuantity.toFixed(2)}{" "}
                            {unitDisplay}
                          </div>
                          {/* 🎯 NEW: Unit mismatch warning */}
                          {doUnit !== getPOUnit() && (
                            <div className="text-xs text-orange-600">
                              ⚠️ Unit differs from PO:{" "}
                              {getUnitDisplay(getPOUnit())}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 🎯 ENHANCED: Unit-aware price display */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        <div>
                          <div className="font-medium">
                            {formatCurrency(order.unit_price)}
                          </div>
                          {/* 🎯 NEW: Show converted price for ton unit */}
                          {doUnit === "ton" && (
                            <div className="text-xs text-gray-500">
                              ({formatCurrency(order.unit_price * 1000)}/ton)
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(order.calculated.grossIncome)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(order.trip_allowance)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(order.gaji)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                        <span
                          className={`${
                            order.calculated.netProfit >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {formatCurrency(order.calculated.netProfit)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getDeliveryStatusBadge(
                            order.status
                          )}`}
                        >
                          {order.status.replace("_", " ").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getPaymentStatusBadge(
                            order.payment_status
                          )}`}
                        >
                          {order.payment_status.replace("_", " ").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() =>
                            navigate(
                              `/ritase/delivery-orders/${order.id}/payment`
                            )
                          }
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Lihat Detail
                        </button>
                        {order.payment_status === "proses_tagihan" && (
                          <button
                            onClick={() => {
                              /* Handle payment confirmation */
                            }}
                            className="text-green-600 hover:text-green-900"
                          >
                            Konfirmasi Bayar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredData.length === 0 && (
            <div className="text-center py-12">
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
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No delivery orders found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Try adjusting your filters to see more results.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default POSpecificRitaseTable;
