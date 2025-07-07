// src/pages/Ritase/ComprehensiveRitaseTable.tsx
// 🎯 ENHANCED: Auto-load latest ritase sorted by vehicle license plate

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
  unit: string;
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
    costPerUnit: number;
    revenuePerUnit: number;
    totalPaid: number;
    outstanding: number;
    paymentDays: number;
    route: string;
    unit_context: {
      unit: string;
      unit_display: string;
      pricing_per_unit: string;
      total_calculation: string;
    };
  };
}

interface SummaryStats {
  totalRecords: number;
  totalRevenue: number;
  totalProfit: number;
  vehicleCount: number;
  completedTrips: number;
}

const ComprehensiveRitaseTable: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State management
  const [data, setData] = useState<ComprehensiveRitaseData[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Purchase Orders and Vehicles state
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);

  const poOptions = purchaseOrders.map((po: any) => ({
    value: po.id,
    label: `${po.po_number} - ${po.customer_name}`,
  }));

  const vehicleOptions = [
    { value: "all", label: "All Vehicles" },
    ...vehicles.map((v) => ({
      value: v.license_plate,
      label: `${v.license_plate} (${v.type})`,
    })),
  ];

  // ✅ CHANGE: Simplified filters - no required fields
  const [filters, setFilters] = useState({
    vehicle: searchParams.get("vehicle") || "",
    startDate: searchParams.get("startDate") || "",
    endDate: searchParams.get("endDate") || "",
    driver: searchParams.get("driver") || "",
    status: searchParams.get("status") || "",
    paymentStatus: searchParams.get("paymentStatus") || "",
    unit: searchParams.get("unit") || "",
    sortBy: "license_plate", // ✅ DEFAULT: Sort by license plate
    sortOrder: "DESC", // ✅ DEFAULT: Descending order
    limit: 10, // ✅ DEFAULT: 10 records
  });

  // Sorting
  const [sortConfig, setSortConfig] = useState({
    key: "license_plate",
    direction: "desc" as "asc" | "desc",
  });

  // Unit helper functions
  const getUnitDisplay = (unit: string) => {
    const unitMap = {
      kilogram: "kg",
      ton: "ton",
      kubik: "m³",
    };
    return unitMap[unit as keyof typeof unitMap] || unit;
  };

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

  // ✅ CHANGE: Auto-fetch data on component mount
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // ✅ Build query params (all optional)
      const params = new URLSearchParams();

      // Only add non-empty filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "" && value !== "all") {
          params.append(key, value.toString());
        }
      });

      // ✅ Always add sorting and limit
      params.append("sortBy", filters.sortBy);
      params.append("sortOrder", filters.sortOrder);
      params.append("limit", filters.limit.toString());
      params.append("page", currentPage.toString());

      const response = await apiClient.get(`/ritase/comprehensive?${params}`);

      // Handle response format
      const responseData = response.data.success
        ? response.data.data
        : response.data;

      setData(responseData.records || []);
      setSummary(responseData.summary || null);

      if (responseData.pagination) {
        setTotalPages(responseData.pagination.totalPages || 1);
      }
    } catch (err: any) {
      setError("Failed to fetch ritase data");
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ AUTO-LOAD: Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, []); // Empty dependency - auto-load once

  // ✅ Fetch when filters or page change
  useEffect(() => {
    fetchData();
  }, [filters, currentPage, sortConfig]);

  // Fetch initial data
  useEffect(() => {
    const fetchPurchaseOrders = async () => {
      try {
        const response = await apiClient.get("/purchase-orders");
        const orders = response.data.success
          ? response.data.data
          : response.data || [];
        setPurchaseOrders(orders);
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

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (
        value !== "" &&
        value !== "all" &&
        key !== "sortBy" &&
        key !== "sortOrder" &&
        key !== "limit"
      ) {
        params.set(key, value.toString());
      }
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

  // Sorting handler
  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));

    setFilters((prev) => ({
      ...prev,
      sortBy: key,
      sortOrder:
        sortConfig.key === key && sortConfig.direction === "asc"
          ? "DESC"
          : "ASC",
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading latest ritase data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
                <Select
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
                    singleValue: (base) => ({ ...base, color: "#222" }),
                    menu: (base) => ({ ...base, zIndex: 100 }),
                    placeholder: (base) => ({
                      ...base,
                      color: "#e5e7eb",
                      fontWeight: "500",
                      opacity: 0.9,
                    }),
                  }}
                />
              </div>
            </div>

            <div className="text-right">
              <span className="text-blue-100 text-sm font-medium">
                Latest Ritase by Vehicle License Plate
              </span>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Comprehensive Ritase Analytics
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="text-2xl font-bold text-blue-600">
                {summary.totalRecords}
              </div>
              <div className="text-sm text-gray-600">Total Ritase</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="text-2xl font-bold text-green-600">
                {summary.vehicleCount}
              </div>
              <div className="text-sm text-gray-600">Vehicles</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="text-2xl font-bold text-purple-600">
                {summary.completedTrips}
              </div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="text-lg font-bold text-yellow-600">
                {formatCurrency(summary.totalRevenue)}
              </div>
              <div className="text-sm text-gray-600">Total Revenue</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="text-lg font-bold text-orange-600">
                {formatCurrency(summary.totalProfit)}
              </div>
              <div className="text-sm text-gray-600">Total Profit</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) =>
                  setFilters({ ...filters, sortBy: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="license_plate">License Plate</option>
                <option value="created_at">Date Created</option>
                <option value="completed_at">Date Completed</option>
                <option value="calculated.grossIncome">Gross Income</option>
                <option value="calculated.netProfit">Net Profit</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order
              </label>
              <select
                value={filters.sortOrder}
                onChange={(e) =>
                  setFilters({ ...filters, sortOrder: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="DESC">Descending</option>
                <option value="ASC">Ascending</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle (Optional)
              </label>
              <Select
                options={vehicleOptions}
                value={vehicleOptions.find(
                  (opt) => opt.value === filters.vehicle
                )}
                onChange={(selected) =>
                  setFilters({
                    ...filters,
                    vehicle: selected ? selected.value : "",
                  })
                }
                isClearable
                placeholder="Select vehicle..."
                styles={{
                  control: (base) => ({ ...base, minHeight: 40 }),
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status (Optional)
              </label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Status</option>
                <option value="completed">Completed</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unit Type
              </label>
              <select
                value={filters.unit}
                onChange={(e) =>
                  setFilters({ ...filters, unit: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Units</option>
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
                  setFilters({ ...filters, paymentStatus: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Status</option>
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
                Limit
              </label>
              <select
                value={filters.limit}
                onChange={(e) =>
                  setFilters({ ...filters, limit: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={10}>10 records</option>
                <option value={25}>25 records</option>
                <option value={50}>50 records</option>
                <option value={100}>100 records</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() =>
                  setFilters({
                    vehicle: "",
                    startDate: "",
                    endDate: "",
                    driver: "",
                    status: "",
                    paymentStatus: "",
                    unit: "",
                    sortBy: "license_plate",
                    sortOrder: "DESC",
                    limit: 10,
                  })
                }
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <div className="text-red-800">{error}</div>
            <button
              onClick={fetchData}
              className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Main Data Table */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Latest Ritase Data
                </h2>
                <p className="text-sm text-gray-600">
                  Showing {data.length} trips • Sorted by {filters.sortBy}{" "}
                  {filters.sortOrder}
                  {summary && (
                    <span className="ml-2">
                      • Total Revenue: {formatCurrency(summary.totalRevenue)}
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
                    {sortConfig.key === "vehicle.license_plate" && (
                      <span className="ml-1">
                        {sortConfig.direction === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nama Supir
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("created_at")}
                  >
                    Tanggal Jalan
                    {sortConfig.key === "created_at" && (
                      <span className="ml-1">
                        {sortConfig.direction === "asc" ? "↑" : "↓"}
                      </span>
                    )}
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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qty & Unit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Price
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("calculated.grossIncome")}
                  >
                    Gross Income
                    {sortConfig.key === "calculated.grossIncome" && (
                      <span className="ml-1">
                        {sortConfig.direction === "asc" ? "↑" : "↓"}
                      </span>
                    )}
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
                    {sortConfig.key === "calculated.netProfit" && (
                      <span className="ml-1">
                        {sortConfig.direction === "asc" ? "↑" : "↓"}
                      </span>
                    )}
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
                        <div
                          className={
                            record.calculated.netProfit >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {formatCurrency(record.calculated.netProfit)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {record.calculated.profitMargin.toFixed(1)}% margin
                        </div>
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
                            navigate(`/delivery-orders/${record.id}`)
                          }
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-6 py-3 border-t border-gray-200 flex items-center justify-between">
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
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
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
