// src/pages/Ritase/ComprehensiveRitaseTable.tsx
// 🎯 ENHANCED: Unit-aware comprehensive ritase table

import React, { useState, useEffect } from "react";
import Select from "react-select";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../../api/axiosConfig";

// 🎯 ENHANCED: Add unit field to interface
interface ComprehensiveRitaseData {
  id: number;
  do_number: string;
  vehicle: {
    license_plate: string;
    type: string;
  };
  driver: {
    username: string;
    driverProfile: {
      full_name: string;
    };
  };
  created_at: string;
  completed_at: string;
  load_location: string;
  unload_location: string;
  item_name: string;
  minimal_load_quantity: number;
  actual_load_quantity: number;
  unit: string; // 🎯 NEW: Unit field
  unit_price: number;
  trip_allowance: number;
  gaji: number;
  payment_status: string;
  calculated: {
    actualQuantity: number;
    grossIncome: number;
    operationalCosts: number;
    netProfit: number;
    profitMargin: number;
    costPerTon: number;
    revenuePerTon: number;
    totalPaid: number;
    outstanding: number;
    paymentDays: number;
    route: string;
  };
  // 🎯 NEW: Unit context for enhanced display
  unit_info?: {
    unit: string;
    unit_display: string;
    pricing_strategy: string;
    unit_mismatch?: boolean;
  };
}

interface DashboardMetrics {
  financial: {
    totalRevenue: number;
    totalOperationalCosts: number;
    totalNetProfit: number;
    profitMargin: number;
    avgProfitPerTrip: number;
    totalInvoiced: number;
    totalPaid: number;
    outstandingAmount: number;
  };
  operational: {
    completedTrips: number;
    activeVehicles: number;
    totalVehicles: number;
    completionRate: number;
  };
  // 🎯 ENHANCED: Now required instead of optional
  unit_analytics: {
    unit_distribution: {
      kilogram: number;
      ton: number;
      kubik: number;
    };
    total_quantity_by_unit: {
      kilogram: number;
      ton: number;
      kubik: number;
    };
  };
  // 🎯 NEW: Additional fields
  summary?: {
    revenue_per_trip: number;
    cost_per_trip: number;
    profit_per_trip: number;
    total_trips_by_unit: {
      weight_based: number;
      volume_based: number;
    };
  };
  period?: {
    startDate: string;
    endDate: string;
    generatedAt: string;
    calculation_method: string;
  };
}

const ComprehensiveRitaseTable: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State management
  const [data, setData] = useState<ComprehensiveRitaseData[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Purchase Orders state
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const poOptions = purchaseOrders.map((po: any) => ({
    value: po.id,
    label: `${po.po_number} - ${po.customer_name}`,
  }));
  const [vehicles, setVehicles] = useState<any[]>([]);
  const vehicleOptions = [
    { value: "all", label: "All Vehicles" },
    ...vehicles.map((v) => ({
      value: v.license_plate,
      label: `${v.license_plate} (${v.type})`,
    })),
  ];

  // 🎯 NEW: Unit helper functions
  const getUnitDisplay = (unit: string) => {
    const unitMap = {
      kilogram: "kg",
      ton: "ton",
      kubik: "m³",
    };
    return unitMap[unit as keyof typeof unitMap] || unit;
  };

  // 🎯 NEW: Get pricing context based on unit
  const getPricingContext = (unit: string, unitPrice: number) => {
    const unitDisplay = getUnitDisplay(unit);

    switch (unit) {
      case "kilogram":
        return {
          display: `Rp ${unitPrice.toLocaleString("id-ID")}/kg`,
          per_ton_equivalent: `(Rp ${(unitPrice * 1000).toLocaleString(
            "id-ID"
          )}/ton)`,
          pricing_type: "Weight-based",
        };
      case "ton":
        return {
          display: `Rp ${unitPrice.toLocaleString("id-ID")}/ton`,
          per_kg_equivalent: `(Rp ${(unitPrice / 1000).toLocaleString(
            "id-ID"
          )}/kg)`,
          pricing_type: "Weight-based",
        };
      case "kubik":
        return {
          display: `Rp ${unitPrice.toLocaleString("id-ID")}/m³`,
          per_ton_equivalent: null,
          pricing_type: "Volume-based",
        };
      default:
        return {
          display: `Rp ${unitPrice.toLocaleString("id-ID")}/${unitDisplay}`,
          per_ton_equivalent: null,
          pricing_type: "Unknown",
        };
    }
  };

  // 🎯 NEW: Get unit-aware quantity display
  const getQuantityDisplay = (record: ComprehensiveRitaseData) => {
    const unitDisplay = getUnitDisplay(record.unit);
    const quantity = record.calculated.actualQuantity;

    return {
      main: `${quantity.toFixed(2)} ${unitDisplay}`,
      conversion:
        record.unit === "kilogram"
          ? `(${(quantity / 1000).toFixed(3)} ton)`
          : record.unit === "ton"
          ? `(${(quantity * 1000).toLocaleString("id-ID")} kg)`
          : null,
    };
  };

  // 🎯 NEW: Enhanced currency formatter with dots
  const formatCurrency = (amount: number) => {
    return `Rp ${parseFloat(String(amount)).toLocaleString("id-ID")}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Existing useEffect functions remain the same...
  useEffect(() => {
    const fetchPurchaseOrders = async () => {
      try {
        const response = await apiClient.get("/purchase-orders");
        setPurchaseOrders(response.data.records || response.data || []);
      } catch (error) {
        console.error("Failed to fetch purchase orders:", error);
      }
    };
    fetchPurchaseOrders();
  }, []);

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const res = await apiClient.get("/vehicles");
        setVehicles(res.data.records || res.data || []);
      } catch (err) {
        console.error("Failed to fetch vehicles:", err);
      }
    };
    fetchVehicles();
  }, []);

  // Filters - add unit filter
  const [filters, setFilters] = useState({
    startDate:
      searchParams.get("startDate") ||
      new Date()
        .toISOString()
        .split("T")[0]
        .replace(/\d{2}$/, "01"),
    endDate:
      searchParams.get("endDate") || new Date().toISOString().split("T")[0],
    vehicle: searchParams.get("vehicle") || "all",
    driver: searchParams.get("driver") || "all",
    status: searchParams.get("status") || "all",
    paymentStatus: searchParams.get("paymentStatus") || "all",
    unit: searchParams.get("unit") || "all", // 🎯 NEW: Unit filter
  });

  // Sorting
  const [sortConfig, setSortConfig] = useState({
    key: "created_at",
    direction: "desc" as "asc" | "desc",
  });

  // 🎯 ENHANCED: Fetch data with unit context
  const fetchData = async () => {
    try {
      setLoading(true);

      const vehicleId =
        filters.vehicle !== "all" ? getVehicleIdByPlate(filters.vehicle) : null;

      // Fetch comprehensive table data
      const tableResponse = await apiClient.get("/ritase/comprehensive", {
        params: {
          ...filters,
          page: currentPage,
          vehicle: vehicleId || "all",
          limit: 50,
          sortBy: sortConfig.key,
          sortOrder: sortConfig.direction.toUpperCase(),
        },
      });

      // Fetch dashboard metrics
      const metricsResponse = await apiClient.get("/ritase/dashboard-metrics", {
        params: {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
      });

      // 🎯 ENHANCED: Process data to ensure unit field exists
      const processedData = (tableResponse.data.records || []).map(
        (record: any) => ({
          ...record,
          unit: record.unit || "ton", // Default to ton if unit missing
          unit_info: {
            unit: record.unit || "ton",
            unit_display: getUnitDisplay(record.unit || "ton"),
            pricing_strategy:
              record.unit === "kubik"
                ? "Volume-based pricing"
                : "Weight-based pricing",
          },
        })
      );

      setData(processedData);
      setTotalPages(tableResponse.data.pagination?.totalPages || 1);
      setMetrics(metricsResponse.data);
    } catch (error) {
      console.error("Error fetching ritase data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters, currentPage, sortConfig]);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "all" && value !== "") params.set(key, value);
    });
    setSearchParams(params);
  }, [filters, setSearchParams]);

  // Status badge styling
  const getStatusBadge = (status: string) => {
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

  const getVehicleIdByPlate = (plate: string) => {
    const found = vehicles.find((v) => v.license_plate === plate);
    return found ? found.id : null;
  };

  // Sorting handler
  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Export handler
  const handleExport = async () => {
    try {
      const response = await apiClient.get("/ritase/export/comprehensive", {
        params: filters,
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `ritase-comprehensive-${new Date().toISOString().split("T")[0]}.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  if (loading && !data.length) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - same as before */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate("/ritase")}
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
                <span className="text-sm font-medium">Back to Dashboard</span>
              </button>

              <div className="h-6 w-px bg-white/20"></div>

              <button
                onClick={handleExport}
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
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="text-sm font-medium text-white">
                  Export Excel
                </span>
              </button>

              <div className="relative min-w-[260px]">
                <label htmlFor="po-table-select" className="sr-only">
                  Pilih PO untuk Table View
                </label>
                <Select
                  inputId="po-table-select"
                  options={poOptions}
                  placeholder="Pilih PO untuk Table View..."
                  isClearable
                  classNamePrefix="react-select"
                  onChange={(selected) => {
                    if (selected?.value) {
                      navigate(`/ritase/po/${selected.value}/table`);
                    }
                  }}
                  styles={{
                    control: (base) => ({
                      ...base,
                      backgroundColor: "rgba(255,255,255,0.25)",
                      color: "#fff",
                      borderColor: "rgba(255,255,255,0.2)",
                      minHeight: 40,
                    }),
                    singleValue: (base) => ({
                      ...base,
                      color: "#222",
                    }),
                    menu: (base) => ({
                      ...base,
                      zIndex: 100,
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: "#e5e7eb",
                      fontWeight: "500",
                      opacity: 0.9,
                    }),
                  }}
                  theme={(theme) => ({
                    ...theme,
                    borderRadius: 8,
                    colors: {
                      ...theme.colors,
                      primary25: "#f3f4f6",
                      primary: "#6366f1",
                      neutral50: "#e5e7eb",
                    },
                  })}
                />
              </div>
            </div>

            <div className="text-right">
              <span className="text-blue-100 text-sm font-medium">
                Comprehensive Ritase Analytics
              </span>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {formatDate(filters.startDate)} - {formatDate(filters.endDate)}
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 🎯 ENHANCED: Financial Dashboard Cards with Unit Analytics */}
        {metrics && (
          <>
            {/* Main Financial Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Revenue
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatCurrency(metrics.financial.totalRevenue)}
                      </dd>
                      {/* 🎯 NEW: Revenue per trip indicator */}
                      {metrics.summary && (
                        <dd className="text-xs text-gray-500">
                          Avg:{" "}
                          {formatCurrency(metrics.summary.revenue_per_trip)}
                          /trip
                        </dd>
                      )}
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Net Profit
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatCurrency(metrics.financial.totalNetProfit)}
                      </dd>
                      {/* 🎯 NEW: Profit margin indicator */}
                      <dd className="text-xs text-gray-500">
                        Margin: {metrics.financial.profitMargin.toFixed(1)}%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-yellow-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Outstanding
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatCurrency(metrics.financial.outstandingAmount)}
                      </dd>
                      {/* 🎯 NEW: Outstanding percentage */}
                      <dd className="text-xs text-gray-500">
                        {metrics.financial.totalInvoiced > 0
                          ? `${(
                              (metrics.financial.outstandingAmount /
                                metrics.financial.totalInvoiced) *
                              100
                            ).toFixed(1)}% unpaid`
                          : "No invoices"}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-purple-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Completed Trips
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {metrics.operational.completedTrips}
                      </dd>
                      {/* 🎯 NEW: Unit breakdown */}
                      <dd className="text-xs text-gray-500">
                        {metrics.summary?.total_trips_by_unit.weight_based || 0}{" "}
                        weight,{" "}
                        {metrics.summary?.total_trips_by_unit.volume_based || 0}{" "}
                        volume
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* 🎯 ENHANCED: Unit Distribution Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Unit Distribution & Analytics
                </h3>
                {metrics.period?.calculation_method && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    ✓ Unit-aware calculations
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-blue-600 font-medium">
                    Weight-based (kg)
                  </div>
                  <div className="text-2xl font-bold text-blue-900">
                    {metrics.unit_analytics.unit_distribution.kilogram}
                  </div>
                  <div className="text-xs text-blue-600">
                    {metrics.unit_analytics.total_quantity_by_unit.kilogram.toLocaleString(
                      "id-ID"
                    )}{" "}
                    kg total
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-green-600 font-medium">
                    Weight-based (ton)
                  </div>
                  <div className="text-2xl font-bold text-green-900">
                    {metrics.unit_analytics.unit_distribution.ton}
                  </div>
                  <div className="text-xs text-green-600">
                    {metrics.unit_analytics.total_quantity_by_unit.ton.toLocaleString(
                      "id-ID"
                    )}{" "}
                    ton total
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-sm text-purple-600 font-medium">
                    Volume-based (m³)
                  </div>
                  <div className="text-2xl font-bold text-purple-900">
                    {metrics.unit_analytics.unit_distribution.kubik}
                  </div>
                  <div className="text-xs text-purple-600">
                    {metrics.unit_analytics.total_quantity_by_unit.kubik.toLocaleString(
                      "id-ID"
                    )}{" "}
                    m³ total
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 🎯 ENHANCED: Filters with Unit Filter */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
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
                End Date
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

            {/* 🎯 NEW: Unit Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unit Type
              </label>
              <select
                value={filters.unit}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, unit: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Units</option>
                <option value="kilogram">Kilogram (kg)</option>
                <option value="ton">Ton</option>
                <option value="kubik">Kubik (m³)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Status
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
                <option value="all">All Status</option>
                <option value="lunas">LUNAS</option>
                <option value="deposit">DEPOSIT</option>
                <option value="proses_tagihan">PROSES TAGIHAN</option>
                <option value="awaiting_confirmation">
                  AWAITING CONFIRMATION
                </option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trip Status
              </label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, status: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="assigned">Assigned</option>
                <option value="otw_to_load_location">OTW to Load</option>
                <option value="at_load_location">At Load Location</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle
              </label>
              <Select
                options={vehicleOptions}
                value={vehicleOptions.find(
                  (opt) => opt.value === filters.vehicle
                )}
                onChange={(selected) =>
                  setFilters((prev) => ({
                    ...prev,
                    vehicle: selected ? selected.value : "all",
                  }))
                }
                isClearable
                classNamePrefix="react-select"
                placeholder="Pilih kendaraan..."
                styles={{
                  control: (base) => ({
                    ...base,
                    minHeight: 40,
                  }),
                }}
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() =>
                  setFilters({
                    startDate: new Date()
                      .toISOString()
                      .split("T")[0]
                      .replace(/\d{2}$/, "01"),
                    endDate: new Date().toISOString().split("T")[0],
                    vehicle: "all",
                    driver: "all",
                    status: "all",
                    paymentStatus: "all",
                    unit: "all", // 🎯 NEW: Reset unit filter
                  })
                }
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* 🎯 ENHANCED: Main Data Table with Unit-aware columns */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Comprehensive Ritase Data
                </h2>
                <p className="text-sm text-gray-600">
                  Showing {data.length} trips • Total Revenue:{" "}
                  {metrics
                    ? formatCurrency(metrics.financial.totalRevenue)
                    : "..."}
                  {/* 🎯 NEW: Unit context in description */}
                  {filters.unit !== "all" && (
                    <span className="ml-2 text-blue-600">
                      • Filtered by: {getUnitDisplay(filters.unit)}
                    </span>
                  )}
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
                    onClick={() => handleSort("vehicle.license_plate")}
                  >
                    Plat Nomor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nama Supir
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
                    Route
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nama Barang
                  </th>
                  {/* 🎯 ENHANCED: Unit-aware column headers */}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty & Unit
                    <div className="text-xs normal-case text-gray-400 font-normal">
                      Actual quantity with unit
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Price
                    <div className="text-xs normal-case text-gray-400 font-normal">
                      Price per unit
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("calculated.grossIncome")}
                  >
                    Gross Income
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
                    Net Income
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((record) => {
                  // 🎯 CALCULATE: Unit-aware display data
                  const quantityDisplay = getQuantityDisplay(record);
                  const pricingContext = getPricingContext(
                    record.unit,
                    record.unit_price
                  );

                  return (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {record.vehicle.license_plate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.driver.driverProfile.full_name ||
                          record.driver.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(record.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.completed_at
                          ? formatDate(record.completed_at)
                          : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {record.calculated.route}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.item_name}
                      </td>

                      {/* 🎯 ENHANCED: Unit-aware quantity display */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        <div>
                          <div className="font-medium text-gray-900">
                            {quantityDisplay.main}
                          </div>
                          {quantityDisplay.conversion && (
                            <div className="text-xs text-gray-500">
                              {quantityDisplay.conversion}
                            </div>
                          )}
                          {/* Unit type indicator */}
                          <div
                            className={`text-xs px-2 py-1 rounded-full mt-1 inline-block ${
                              record.unit === "kubik"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {pricingContext.pricing_type}
                          </div>
                        </div>
                      </td>

                      {/* 🎯 ENHANCED: Unit-aware price display */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        <div>
                          <div className="font-medium text-gray-900">
                            {pricingContext.display}
                          </div>
                          {pricingContext.per_ton_equivalent && (
                            <div className="text-xs text-gray-500">
                              {pricingContext.per_ton_equivalent}
                            </div>
                          )}
                          {pricingContext.per_kg_equivalent && (
                            <div className="text-xs text-gray-500">
                              {pricingContext.per_kg_equivalent}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                        {formatCurrency(record.calculated.grossIncome)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(record.trip_allowance)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(record.gaji)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                        <span
                          className={`${
                            record.calculated.netProfit >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {formatCurrency(record.calculated.netProfit)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusBadge(
                            record.payment_status
                          )}`}
                        >
                          {record.payment_status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() =>
                            navigate(
                              `/ritase/delivery-orders/${record.id}/payment`
                            )
                          }
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 🎯 NEW: Unit Information Footer */}
          {data.length > 0 && (
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div>
                  <span className="font-medium">Data includes:</span>
                  <span className="ml-2">
                    {data.filter((d) => d.unit === "kilogram").length} kg-based,{" "}
                    {data.filter((d) => d.unit === "ton").length} ton-based,{" "}
                    {data.filter((d) => d.unit === "kubik").length} volume-based
                    entries
                  </span>
                </div>
                <div>
                  <span className="font-medium">Total Records:</span>
                  <span className="ml-2">{data.length}</span>
                </div>
              </div>
            </div>
          )}

          {/* Pagination - remains the same */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Page <span className="font-medium">{currentPage}</span> of{" "}
                      <span className="font-medium">{totalPages}</span>
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      {Array.from(
                        { length: Math.min(5, totalPages) },
                        (_, i) => {
                          const page = i + 1;
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                currentPage === page
                                  ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                                  : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                              }`}
                            >
                              {page}
                            </button>
                          );
                        }
                      )}
                    </nav>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComprehensiveRitaseTable;
