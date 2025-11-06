import React, { useState, useEffect, useMemo } from "react";
import Select from "react-select";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../../api/axiosConfig";
import TableSkeleton from "../../components/ui/TableSkeleton";
import SummaryCard from "../../components/ui/SummaryCard";
import FilterChip from "../../components/ui/FilterChip";
import StatusBadge from "../../components/ui/StatusBadge";
import toast from "react-hot-toast";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface ComprehensiveRitaseData {
  id: number;
  do_name: string;
  do_number: string;
  customer_name: string;

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
  departed_to_load_location_at: string;
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
  status: string;
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

  // State management (unchanged from your code)
  const [data, setData] = useState<ComprehensiveRitaseData[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  // Purchase Orders and Vehicles state (unchanged)
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState<Date | null>(null);
  const [exportEndDate, setExportEndDate] = useState<Date | null>(null);

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

  const [filters, setFilters] = useState({
    vehicle: searchParams.get("vehicle") || "",
    startDate: searchParams.get("startDate") || "",
    endDate: searchParams.get("endDate") || "",
    driver: searchParams.get("driver") || "",
    status: searchParams.get("status") || "",
    paymentStatus: searchParams.get("paymentStatus") || "",
    unit: searchParams.get("unit") || "",
    sortBy: "license_plate",
    sortOrder: "DESC",
    limit: 10,
  });

  const activeFilters = useMemo(() => {
    const active = [];
    if (filters.vehicle && filters.vehicle !== "all") {
      active.push({
        key: "vehicle",
        label: "Vehicle",
        value: filters.vehicle,
        colorScheme: "blue" as const,
      });
    }
    if (filters.startDate && filters.endDate) {
      active.push({
        key: "dateRange",
        label: "Date Range",
        value: `${filters.startDate} to ${filters.endDate}`,
        colorScheme: "green" as const,
      });
    }
    if (filters.status && filters.status !== "all") {
      active.push({
        key: "status",
        label: "Delivery Status",
        value: filters.status,
        colorScheme: "purple" as const,
      });
    }
    if (filters.paymentStatus && filters.paymentStatus !== "all") {
      active.push({
        key: "paymentStatus",
        label: "Payment Status",
        value: filters.paymentStatus,
        colorScheme: "yellow" as const,
      });
    }
    if (filters.unit && filters.unit !== "all") {
      active.push({
        key: "unit",
        label: "Unit Type",
        value: filters.unit,
        colorScheme: "orange" as const,
      });
    }
    return active;
  }, [filters]);

  // Sorting (unchanged)
  const [sortConfig, setSortConfig] = useState({
    key: "license_plate",
    direction: "desc" as "asc" | "desc",
  });

  // Unit helper functions (unchanged)
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
    // Sampai 2 angka desimal untuk konsistensi
    return `Rp ${amount.toLocaleString("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Auto-fetch data on component mount (unchanged)
  const fetchData = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "all") params.append(key, value.toString());
      });
      params.append("page", currentPage.toString());

      const response = await apiClient.get(
        `/ritase/comprehensive?${params.toString()}`
      );
      const responseData = response.data.success
        ? response.data.data
        : response.data;

      // Filter hanya 'completed' sebelum set state
      const completedData = (responseData.records || []).filter(
        (record: ComprehensiveRitaseData) => record.status === "completed"
      );
      setData(completedData);
      setSummary(responseData.summary || null);
      setTotalPages(responseData.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(
        "Gagal fetch data, bro. Cek koneksi atau API lo error? " +
          (err.message || "Unknown error")
      );
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const processedData = useMemo(() => {
    let filtered = [...data];
    // Sorting dengan case-insensitive (unchanged)
    filtered.sort((a, b) => {
      const aVal = String(
        a[sortConfig.key as keyof ComprehensiveRitaseData] || ""
      ).toLowerCase();
      const bVal = String(
        b[sortConfig.key as keyof ComprehensiveRitaseData] || ""
      ).toLowerCase();
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [data, sortConfig]);

  // Fetch when filters or page change (unchanged)
  useEffect(() => {
    fetchData();
  }, [filters, currentPage]);

  // Fetch initial data (unchanged)
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

  // Update URL params when filters change (unchanged)
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

  // Sorting handler (unchanged)
  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Export handler
  const handleExport = () => {
    setShowExportModal(true);
  };

  const confirmExport = async () => {
    if (!exportStartDate || !exportEndDate) {
      toast.error("Please select a date range!");
      return;
    }

    try {
      const response = await apiClient.get("/ritase/export/comprehensive", {
        params: {
          ...filters, // Existing filters
          startDate: exportStartDate.toISOString().split("T")[0],
          endDate: exportEndDate.toISOString().split("T")[0],
          limit: undefined,
        },
        responseType: "blob",
      });

      // Check if response is actually an error (JSON blob)
      if (response.headers["content-type"]?.includes("application/json")) {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        toast.error(errorData.message || "Export failed: No data found");
        return;
      }

      // Check if status is not OK
      if (response.status !== 200) {
        const text = await response.data.text();
        try {
          const errorData = JSON.parse(text);
          toast.error(errorData.message || "Export failed");
        } catch {
          toast.error("Export failed with status " + response.status);
        }
        return;
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `ritase-comprehensive-${
          exportStartDate.toISOString().split("T")[0]
        }-to-${exportEndDate.toISOString().split("T")[0]}.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setShowExportModal(false);
      toast.success("Export successful!");
    } catch (error: any) {
      console.error("Export failed:", error);
      
      // Handle blob error responses
      if (error?.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          toast.error(errorData.message || "Export failed");
          return;
        } catch (parseError) {
          console.error("Failed to parse error blob:", parseError);
        }
      }
      
      const errorMessage = error?.response?.data?.message || error?.message || "Export failed";
      const errorDetails = error?.response?.data?.details || "";
      toast.error(`Export failed: ${errorMessage}${errorDetails ? ` - ${errorDetails}` : ""}`);
      
      // Log full error for debugging
      if (error?.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
      }
    }
  };

  // NEW: State for modal
  const [selectedRecord, setSelectedRecord] =
    useState<ComprehensiveRitaseData | null>(null);
  const [showModal, setShowModal] = useState(false);

  // NEW: Handler for row click
  const handleRowClick = (record: ComprehensiveRitaseData) => {
    setSelectedRecord(record);
    setShowModal(true);
  };

  if (loading && !data.length) {
    return <TableSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header (unchanged) */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-purple-700 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate("/ritase/comprehensive")}
                className="flex items-center px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all duration-200 border border-white/20"
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

              {/* Button untuk refresh data */}
              <button
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="flex items-center px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all duration-200 border border-white/20 disabled:opacity-50"
              >
                <svg
                  className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
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
                <span className="text-sm font-medium">
                  {refreshing ? "Refreshing..." : "Refresh"}
                </span>
              </button>
            </div>

            <div className="text-right">
              <div className="flex items-center justify-end gap-2 text-blue-100 text-sm font-medium mb-1">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Latest Ritase Analytics • Real-time Data
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                Comprehensive Ritase Analytics
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Stats (unchanged) */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
            <SummaryCard
              title="Total Ritase"
              value={summary.totalRecords.toLocaleString()}
              subtitle="Active delivery orders"
              icon="🚛"
              colorScheme="blue"
            />
            <SummaryCard
              title="Active Vehicles"
              value={summary.vehicleCount.toLocaleString()}
              subtitle="In operation"
              icon="🚗"
              colorScheme="green"
            />
            <SummaryCard
              title="Completed Trips"
              value={summary.completedTrips.toLocaleString()}
              subtitle="Successfully delivered"
              icon="✅"
              colorScheme="purple"
            />
            <SummaryCard
              title="Total Revenue"
              value={formatCurrency(summary.totalRevenue)}
              subtitle={`Avg: ${formatCurrency(
                summary.totalRevenue / Math.max(summary.totalRecords, 1)
              )}/trip`}
              icon="💰"
              colorScheme="yellow"
            />
            <SummaryCard
              title="Net Profit"
              value={formatCurrency(summary.totalProfit)}
              subtitle={`${(
                (summary.totalProfit / Math.max(summary.totalRevenue, 1)) *
                100
              ).toFixed(1)}% margin`}
              icon="📈"
              colorScheme="orange"
            />
          </div>
        )}

        {/* Filters (unchanged; truncated for brevity) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z"
                  />
                </svg>
                Filters & Search
              </h3>
              {activeFilters.length > 0 && (
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
                  className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors flex items-center gap-1"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Clear all filters
                </button>
              )}
            </div>

            {/* Active filter chips (unchanged) */}
            {activeFilters.length > 0 && (
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-3 font-medium">
                  Active Filters:
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeFilters.map((filter) => (
                    <FilterChip
                      key={filter.key}
                      label={filter.label}
                      value={filter.value}
                      colorScheme={filter.colorScheme}
                      onRemove={() => {
                        if (filter.key === "dateRange") {
                          setFilters((prev) => ({
                            ...prev,
                            startDate: "",
                            endDate: "",
                          }));
                        } else {
                          setFilters((prev) => ({ ...prev, [filter.key]: "" }));
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Filter grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) =>
                    setFilters({ ...filters, startDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    setFilters({ ...filters, endDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              {/* Vehicle Filter */}
              <div className="min-w-[180px]">
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
                  className="text-sm"
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: 40,
                      borderRadius: "0.5rem",
                      borderColor: "#d1d5db",
                      backgroundColor: "#ffffff", // Solid for visibility
                      "&:hover": { borderColor: "#3b82f6" },
                      "&:focus-within": {
                        borderColor: "#3b82f6",
                        boxShadow: "0 0 0 2px rgba(59, 130, 246, 0.1)",
                      },
                    }),
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Loading State (unchanged) */}
        {loading && !data.length ? (
          <TableSkeleton />
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-red-400 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="text-red-800 font-medium">Error loading data</h3>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            </div>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all duration-200 border border-white/20 disabled:opacity-50"
            >
              <svg
                className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
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
              <span className="text-sm font-medium">
                {refreshing ? "Refreshing..." : "Refresh"}
              </span>
            </button>
          </div>
        ) : (
          <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex justify-between items-center">
                <div className="flex flex-wrap items-start justify-between gap-4 md:gap-6 pb-4 border-b border-gray-200">
                  {/* Title Section - Left aligned, full-width on small screens */}
                  <div className="flex-grow min-w-[200px]">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Latest Ritase Data
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Showing {data.length} completed trips •{" "}
                      {summary && (
                        <span className="ml-2 font-medium text-blue-600">
                          • Total Revenue:{" "}
                          {formatCurrency(summary.totalRevenue)}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Filters Group - Center or right on larger screens */}
                  <div className="flex flex-wrap items-end gap-4 md:gap-6">
                    <div className="min-w-[220px]">
                      {/* ✅ FIXED: Added label for consistency/UX */}
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pilih PO untuk Table View
                      </label>
                      <Select
                        options={poOptions}
                        placeholder="Pilih PO..." // ✅ Shorter placeholder for better fit
                        isClearable
                        isSearchable // ✅ ADDED: Enable search for long lists—UX win
                        classNamePrefix="react-select"
                        onChange={(selected) => {
                          if (selected?.value) {
                            navigate(`/ritase/po/${selected.value}/table`);
                          }
                        }}
                        styles={{
                          control: (base) => ({
                            ...base,
                            backgroundColor: "#ffffff", // ✅ FIXED: Solid white bg for visibility
                            borderColor: "#d1d5db", // Gray-300, matches other inputs
                            minHeight: 40,
                            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)", // Subtle shadow
                            "&:hover": { borderColor: "#93c5fd" }, // Blue hover
                          }),
                          singleValue: (base) => ({
                            ...base,
                            color: "#1f2937",
                          }), // Gray-800 text
                          menu: (base) => ({
                            ...base,
                            zIndex: 9999,
                            backgroundColor: "#ffffff",
                          }), // ✅ Higher z-index to fix positioning weirdness
                          placeholder: (base) => ({
                            ...base,
                            color: "#9ca3af", // Gray-400, visible but subtle
                            fontWeight: "normal",
                          }),
                          option: (base, state) => ({
                            ...base,
                            backgroundColor: state.isSelected
                              ? "#3b82f6"
                              : state.isFocused
                              ? "#f3f4f6"
                              : "#ffffff", // Blue selected, gray hover
                            color: state.isSelected ? "#ffffff" : "#1f2937",
                          }),
                        }}
                      />
                    </div>
                    {/* Records per page */}
                    <div className="min-w-[180px]">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Records per page
                      </label>
                      <select
                        value={filters.limit}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            limit: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-blue-300"
                      >
                        <option value={10}>10 records</option>
                        <option value={25}>25 records</option>
                        <option value={50}>50 records</option>
                        <option value={100}>100 records</option>
                      </select>
                    </div>

                    {/* Export button - Now with tooltip for UX */}
                    <div className="self-end">
                      <button
                        onClick={handleExport}
                        className="flex items-center space-x-2 bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                        title="Export current view to Excel" // Tooltip for clarity
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
                        <span className="text-sm font-medium">
                          Export Excel
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {refreshing && (
                  <div className="flex items-center text-sm text-blue-600">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4"
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
                    Refreshing...
                  </div>
                )}
              </div>
            </div>

            {/* Responsive Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      <div className="flex items-center space-x-1">
                        <span>Plat Nomor & Nama Supir</span>
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort("departed_to_load_location_at")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Tanggal Jalan</span>
                        {sortConfig.key === "departed_to_load_location_at" && (
                          <span className="text-blue-500">
                            {sortConfig.direction === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      DO & Item
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity & Price
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center justify-end space-x-1">
                        <span>Revenue & Costs</span>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center justify-end space-x-1">
                        <span>Net Profit</span>
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    {/* Removed Actions column */}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {processedData.map(
                    (record: ComprehensiveRitaseData, index: number) => {
                      const quantityDisplay = getQuantityDisplay(record);
                      const pricingContext = getPricingContext(
                        record.unit,
                        record.unit_price
                      );

                      return (
                        <tr
                          key={record.id}
                          className={`relative hover:bg-gray-50 transition-all duration-200 cursor-pointer border-2 border-transparent hover:border-blue-300 hover:shadow-md ${
                            index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                          }`}
                          onClick={() => handleRowClick(record)}
                        >
                          {/* Vehicle License Plate */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              <div className="font-bold bg-gray-100 px-2 py-1 rounded">
                                {record.vehicle.license_plate}
                              </div>
                              <div className="font-medium px-2">
                                {record.driver.driverProfile.full_name ||
                                  record.driver.username}
                              </div>
                            </div>
                          </td>

                          {/* Dates */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              <div className="font-medium">
                                {formatDate(
                                  record.departed_to_load_location_at
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                {record.completed_at
                                  ? `Completed: ${formatDate(
                                      record.completed_at
                                    )}`
                                  : "In progress"}
                              </div>
                            </div>
                          </td>

                          {/* DO & Item */}
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <div className="text-gray-900 truncate font-small max-w-xs">
                                {record.do_number || "N/A"}
                              </div>
                              <div className="text-gray-500 truncate text-xs mt-1">
                                {record.customer_name}
                              </div>
                              <div className="text-gray-500 truncate text-xs mt-1">
                                {record.item_name}
                              </div>
                            </div>
                          </td>

                          {/* Quantity & Price */}
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">
                                {quantityDisplay.main}
                              </div>
                              {quantityDisplay.conversion && (
                                <div className="text-xs text-gray-500">
                                  {quantityDisplay.conversion}
                                </div>
                              )}
                              <div className="text-xs text-blue-600 mt-1">
                                {pricingContext.display}
                              </div>
                            </div>
                          </td>

                          {/* Revenue & Cost */}
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm font-bold text-gray-900">
                              {formatCurrency(record.calculated.grossIncome)}
                            </div>
                            <div className="text-sm text-gray-600">
                              {formatCurrency(
                                record.calculated.operationalCosts
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              Uang jalan + Gaji
                            </div>
                          </td>

                          {/* Net Profit */}
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm">
                              <div
                                className={`font-bold ${
                                  record.calculated.netProfit >= 0
                                    ? "text-emerald-600"
                                    : "text-red-600"
                                }`}
                              >
                                {formatCurrency(record.calculated.netProfit)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {record.calculated.profitMargin.toFixed(1)}%
                                margin
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4">
                            <StatusBadge
                              status={record.payment_status}
                              type="payment"
                            />
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination (unchanged) */}
            {totalPages > 1 && (
              <div className="bg-white px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-gray-700">
                    <span>
                      Page <span className="font-medium">{currentPage}</span> of{" "}
                      <span className="font-medium">{totalPages}</span>
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                      className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              Select Date Range for Export
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <DatePicker
                  // pick start date
                  selected={exportStartDate}
                  onChange={(date) => setExportStartDate(date)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  dateFormat="yyyy-MM-dd"
                  placeholderText="Select start date"
                  isClearable
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  scrollableYearDropdown
                  yearDropdownItemNumber={15}
                  minDate={new Date("2020-01-01")}
                  maxDate={new Date()}
                  todayButton="Today"
                  popperPlacement="bottom-start"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <DatePicker
                  // pick end date
                  selected={exportEndDate}
                  onChange={(date) => setExportEndDate(date)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  dateFormat="yyyy-MM-dd"
                  placeholderText="Select end date"
                  isClearable
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  scrollableYearDropdown
                  yearDropdownItemNumber={15}
                  minDate={exportStartDate || new Date("2025-01-01")}
                  maxDate={new Date()}
                  todayButton="Today"
                  popperPlacement="bottom-start"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmExport}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Modal for actions on row click */}
      {showModal && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-4">
              Pilih Aksi untuk DO {selectedRecord.do_number}
            </h3>
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => {
                  navigate(`/delivery-orders/${selectedRecord.id}`);
                  setShowModal(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Detail DO
              </button>
              <button
                onClick={() => {
                  navigate(
                    `/ritase/delivery-orders/${selectedRecord.id}/payment`
                  );
                  setShowModal(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Lihat Detail Pembayaran
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComprehensiveRitaseTable;
