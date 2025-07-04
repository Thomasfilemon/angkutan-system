// src/pages/BigDOListPage.tsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import apiClient from "../api/axiosConfig";
import { toast } from "react-hot-toast";

interface BigDO {
  id: number;
  big_do_number: string;
  status: string;
  status_text: string;
  driver_name: string;
  vehicle_info: string;
  delivery_summary: {
    main_do: {
      customer: string;
      po_number: string;
    };
    tambahan_count: number;
    tambahan_completed: number;
  };
  financial_summary: {
    total_revenue: number;
    total_ongkosan: number;
    total_for_driver: number;
  };
  delivery_progress: {
    completion_percentage: number;
  };
  created_at: string;
}

interface ApiResponse {
  data: BigDO[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  stats: {
    total: number;
    assigned: number;
    in_progress: number;
    completed: number;
    cancelled: number;
  };
}

const BigDOListPage: React.FC = () => {
  const navigate = useNavigate();
  const [bigDOs, setBigDOs] = useState<BigDO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    assigned: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  });

  // Filters
  const [filters, setFilters] = useState({
    status: "",
    search: "",
    page: 1,
    limit: 10,
  });

  const fetchBigDOs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.search) params.append("search", filters.search);
      params.append("page", filters.page.toString());
      params.append("limit", filters.limit.toString());

      const response = await apiClient.get(`/big-delivery-orders?${params}`);

      // Handle full API response (not intercepted)
      const apiData: ApiResponse = response.data.success
        ? {
            data: response.data.data,
            pagination: response.data.pagination,
            stats: response.data.stats,
          }
        : response.data;

      setBigDOs(apiData.data);
      setStats(apiData.stats);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || "Failed to fetch Big DOs";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBigDOs();
  }, [filters]);

  const getStatusColor = (status: string) => {
    const colors = {
      assigned: "bg-yellow-100 text-yellow-800 border-yellow-300",
      in_progress: "bg-blue-100 text-blue-800 border-blue-300",
      completed: "bg-green-100 text-green-800 border-green-300",
      cancelled: "bg-red-100 text-red-800 border-red-300",
    };
    return (
      colors[status as keyof typeof colors] ||
      "bg-gray-100 text-gray-800 border-gray-300"
    );
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString("id-ID")}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Big DOs...</p>
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
            Big Delivery Orders
          </h1>
          <p className="text-gray-600">
            Manage Big DOs with main deliveries and tambahan
          </p>
        </div>
        <Link
          to="/big-dos/create"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          ➕ Create Big DO
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Big DOs</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-yellow-600">
            {stats.assigned}
          </div>
          <div className="text-sm text-gray-600">Assigned</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-blue-600">
            {stats.in_progress}
          </div>
          <div className="text-sm text-gray-600">In Progress</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-green-600">
            {stats.completed}
          </div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="text-2xl font-bold text-red-600">
            {stats.cancelled}
          </div>
          <div className="text-sm text-gray-600">Cancelled</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value, page: 1 })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All Status</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value, page: 1 })
              }
              placeholder="Big DO number, customer name..."
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Big DOs Table */}
      <div className="bg-white shadow border rounded-lg overflow-hidden">
        {error ? (
          <div className="p-8 text-center">
            <div className="text-red-500 mb-4">❌ {error}</div>
            <button
              onClick={fetchBigDOs}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        ) : bigDOs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No Big DOs found.{" "}
            <Link
              to="/big-dos/create"
              className="text-blue-600 hover:underline"
            >
              Create your first Big DO
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Big DO Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Driver & Vehicle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Main Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tambahan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bigDOs.map((bigDO) => (
                  <tr key={bigDO.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {bigDO.big_do_number}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(bigDO.created_at).toLocaleDateString(
                            "id-ID"
                          )}
                        </div>
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(
                            bigDO.status
                          )}`}
                        >
                          {bigDO.status_text}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {bigDO.driver_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {bigDO.vehicle_info}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {bigDO.delivery_summary.main_do.customer}
                        </div>
                        <div className="text-sm text-gray-500">
                          {bigDO.delivery_summary.main_do.po_number}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {bigDO.delivery_summary.tambahan_completed}/
                        {bigDO.delivery_summary.tambahan_count}
                      </div>
                      <div className="text-xs text-gray-500">
                        {bigDO.delivery_summary.tambahan_count} tambahan
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${Math.min(
                                bigDO.delivery_progress.completion_percentage,
                                100
                              )}%`,
                            }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600">
                          {Math.round(
                            bigDO.delivery_progress.completion_percentage
                          )}
                          %
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(
                            bigDO.financial_summary.total_revenue
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          Profit:{" "}
                          {formatCurrency(
                            bigDO.financial_summary.total_ongkosan -
                              bigDO.financial_summary.total_for_driver
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        to={`/big-dos/${bigDO.id}`}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default BigDOListPage;
