import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/axiosConfig";
import debounce from "lodash/debounce";

const calculateFulfillmentPercentage = (fulfilled: number, total: number) => {
  return fulfilled && total
    ? (fulfilled / parseFloat(total.toString())) * 100
    : 0;
};

interface PurchaseOrder {
  id: number;
  po_number: string;
  customer_name: string;
  item_name: string;
  total_quantity: number;
  unit: string;
  total_amount?: number;
  created_at: string;
  status: "confirmed" | "partial" | "completed" | "cancelled";
  load_location: string;
  unload_location: string;
  fulfilled_actual: number;
  estimated_pending: number;
  remaining_quantity: number;
  fulfillment_status: string;
  delivery_progress: {
    total_deliveries: number;
    completed_deliveries: number;
    percentage: number;
  };
  can_create_do: boolean;
  big_do_context?: { type: string; message: string; big_do?: any };
}

const TripsPage = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>(""); // New: Search state
  const [page, setPage] = useState(1); // New: Pagination basics
  const [hasMore, setHasMore] = useState(true); // For future infinite scroll
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    cancelled: 0,
  });
  const [showAdjustPopup, setShowAdjustPopup] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<"add" | "deduct">("add");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [recordAsAdjustment, setRecordAsAdjustment] = useState<boolean>(false);

  const getUnitDisplay = (unit: string) => {
    const unitMap = {
      kilogram: "kg",
      ton: "ton",
      kubik: "m³",
    };
    return unitMap[unit as keyof typeof unitMap] || unit;
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${parseFloat(String(amount)).toLocaleString("id-ID")}`;
  };

  const fetchPurchaseOrders = useCallback(
    async (reset = false) => {
      if (loading === false) setIsFetching(true); // Only activate isFetching if not first load to prevent flicker

      try {
        const currentPage = reset ? 1 : page;
        let params = `?page=${currentPage}&limit=20`;
        if (statusFilter !== "all") params += `&status=${statusFilter}`;
        if (searchTerm) params += `&search=${encodeURIComponent(searchTerm)}`;

        const response = await apiClient.get(`/purchase-orders${params}`);

        const orders = response.data.success ? response.data.data : [];
        const fetchedStats = response.data.success ? response.data.stats : null;
        const pagination = response.data.pagination || { totalPages: 1 };

        const processedOrders = orders.map((po: PurchaseOrder) => {
          const convert = (val: any): number => parseFloat(val) || 0;
          return {
            ...po,
            unit: po.unit || "ton",
            total_quantity: convert(po.total_quantity),
            delivery_progress: {
              total_deliveries: convert(po.delivery_progress.total_deliveries),
              completed_deliveries: convert(
                po.delivery_progress.completed_deliveries
              ),
              percentage:
                po.delivery_progress?.percentage ||
                calculateFulfillmentPercentage(
                  po.fulfilled_actual || 0,
                  po.total_quantity || 1
                ),
            },
          };
        });

        if (reset) {
          setPurchaseOrders(processedOrders);
          setPage(2);
        } else {
          setPurchaseOrders((prev) => [...prev, ...processedOrders]);
          setPage((prev) => prev + 1);
        }

        setHasMore(currentPage < pagination.totalPages);

        if (fetchedStats) setStats(fetchedStats);
      } catch (err) {
        setError("Failed to fetch purchase orders.");
        console.error(err);
      } finally {
        if (loading) setLoading(false);
        setIsFetching(false);
      }
    },
    [statusFilter, searchTerm /* NO page, NO purchaseOrders here */]
  );

  const debouncedFetch = useMemo(
    () =>
      debounce(() => {
        fetchPurchaseOrders(true);
      }, 300),
    [fetchPurchaseOrders]
  );

  useEffect(() => {
    fetchPurchaseOrders(true);
  }, [statusFilter, searchTerm, fetchPurchaseOrders]);

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

  const getStatusText = (status: string) => {
    switch (status) {
      case "confirmed":
        return "Confirmed";
      case "partial":
        return "Partial";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  const handleAdjustQuantity = async () => {
    if (!selectedPO || !adjustmentAmount) {
      alert("Please enter a valid adjustment amount");
      return;
    }

    const amount = parseFloat(adjustmentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid positive number");
      return;
    }

    let newQuantity = selectedPO.total_quantity;

    if (adjustmentType === "add") {
      newQuantity += amount;
    } else {
      if (amount > newQuantity) {
        alert("Deduction amount cannot exceed current quantity");
        return;
      }
      newQuantity -= amount;
    }

    try {
      await apiClient.put(`/purchase-orders/${selectedPO.id}`, {
        total_quantity: newQuantity,
        unit: selectedPO.unit,
        recordAsAdjustment: !recordAsAdjustment, // ✅ Include checkbox state from component
      });
      setShowAdjustPopup(false);
      setAdjustmentAmount("");
      fetchPurchaseOrders();
    } catch (err) {
      setError("Failed to adjust quantity");
      console.error(err);
    }
  };

  if (loading && purchaseOrders.length === 0)
    return <div className="text-center p-8">Loading purchase orders...</div>;
  if (error)
    return <div className="bg-red-100 text-red-700 p-4 rounded">{error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Purchase Orders</h1>
        <Link to="/trips/create-po">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            + Create New Purchase Order
          </button>
        </Link>
      </div>

      {stats.active + stats.completed + stats.cancelled > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Total PO</h3>
            <p className="text-2xl font-bold text-blue-600">
              {stats.active + stats.completed + stats.cancelled}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Active POs</h3>
            <p className="text-2xl font-bold text-yellow-600">{stats.active}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">
              Completed POs
            </h3>
            <p className="text-2xl font-bold text-green-600">
              {stats.completed}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">
              Cancelled POs
            </h3>
            <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
          </div>
        </div>
      ) : (
        <div className="text-center p-4 bg-yellow-100 text-yellow-700 rounded mb-6">
          Stats loading... or backend's on vacation?
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search POs:
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by PO number, customer, or item... (e.g., PO-202508)"
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Search purchase orders"
          />
          {isFetching && (
            <div className="text-sm italic text-gray-500 mb-2">
              Searching...
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Status:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="partial">Partial</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {purchaseOrders.map((po) => {
          const unitDisplay = getUnitDisplay(po.unit);

          return (
            <div
              key={po.id}
              className="bg-white shadow-md rounded-lg p-6 border-l-4 border-blue-500 hover:shadow-lg transition-shadow duration-200"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">
                    {po.po_number}
                  </h3>
                  <p className="text-gray-600">{po.customer_name}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {unitDisplay}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                      po.status
                    )}`}
                  >
                    {getStatusText(po.status)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">Item</p>
                  <p className="font-medium">{po.item_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Quantity</p>
                  <p className="font-medium">
                    {po.total_quantity.toLocaleString("id-ID")} {unitDisplay}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  {po.total_amount ? (
                    <p className="font-semibold text-green-600">
                      {formatCurrency(po.total_amount)}
                    </p>
                  ) : (
                    <p className="text-gray-400 text-sm">Not calculated</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">Load Location</p>
                  <p className="text-sm">
                    {po.load_location || "Not specified"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Unload Location</p>
                  <p className="text-sm">
                    {po.unload_location || "Not specified"}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
                  <span>
                    Delivery Progress:{" "}
                    {po.fulfilled_actual.toLocaleString("id-ID")} /{" "}
                    {po.total_quantity.toLocaleString("id-ID")} {unitDisplay}
                  </span>
                  <span className="font-medium">
                    {Math.round(po.delivery_progress.percentage)}%
                    {po.delivery_progress.percentage > 100 &&
                      " (Over-delivered)"}
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      po.delivery_progress.percentage > 100
                        ? "bg-gradient-to-r from-green-500 to-blue-500"
                        : po.delivery_progress.percentage === 100
                        ? "bg-green-500"
                        : "bg-blue-600"
                    }`}
                    style={{
                      width: `${Math.min(
                        po.delivery_progress.percentage,
                        100
                      )}%`,
                    }}
                  ></div>
                </div>

                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>
                    Deliveries: {po.delivery_progress.completed_deliveries} /{" "}
                    {po.delivery_progress.total_deliveries}
                  </span>
                  <span>
                    {po.remaining_quantity >= 0
                      ? `Remaining: ${po.remaining_quantity.toLocaleString(
                          "id-ID"
                        )} ${unitDisplay}`
                      : `Excess: +${Math.abs(
                          po.remaining_quantity
                        ).toLocaleString("id-ID")} ${unitDisplay}`}
                  </span>
                </div>

                {po.delivery_progress.percentage > 100 && (
                  <div className="mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    ✨ Over-delivered by{" "}
                    {(po.delivery_progress.percentage - 100).toFixed(1)}%
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Link to={`/trips/po/${po.id}`}>
                  <button className="inline-flex items-center px-3 py-2 bg-gray-500 hover:bg-gray-700 text-white rounded text-sm transition-colors">
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    View Details
                  </button>
                </Link>

                {po.can_create_do && (
                  <Link to={`/trips/po/${po.id}/create-do`}>
                    <button className="inline-flex items-center px-3 py-2 bg-green-500 hover:bg-green-700 text-white rounded text-sm transition-colors">
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      Create Delivery Order
                    </button>
                  </Link>
                )}

                <Link to={`/delivery-orders?po_id=${po.id}`}>
                  <button className="inline-flex items-center px-3 py-2 bg-blue-500 hover:bg-blue-700 text-white rounded text-sm transition-colors">
                    <svg
                      className="w-4 h-4 mr-1"
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
                    View DOs ({po.delivery_progress.total_deliveries})
                  </button>
                </Link>

                <Link to={`/ritase/po/${po.id}/table`}>
                  <button className="inline-flex items-center px-3 py-2 bg-purple-500 hover:bg-purple-700 text-white rounded text-sm transition-colors">
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 10h16M4 14h16M4 18h16"
                      />
                    </svg>
                    Table View
                  </button>
                </Link>

                {po.status !== "completed" && po.status !== "cancelled" && (
                  <Link to={`/trips/po/${po.id}/edit`}>
                    <button className="inline-flex items-center px-3 py-2 bg-orange-500 hover:bg-orange-700 text-white rounded text-sm transition-colors">
                      <svg
                        className="w-4 h-4 mr-1"
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
                      Edit PO
                    </button>
                  </Link>
                )}

                {po.status !== "completed" && po.status !== "cancelled" && (
                  <button
                    onClick={() => {
                      setSelectedPO(po);
                      setAdjustmentType("add");
                      setAdjustmentAmount("");
                      setShowAdjustPopup(true);
                    }}
                    className="inline-flex items-center px-3 py-2 bg-teal-500 hover:bg-teal-700 text-white rounded text-sm transition-colors"
                  >
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    Adjust Quantity
                  </button>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    Created:{" "}
                    {new Date(po.created_at).toLocaleDateString("id-ID")}
                  </span>
                  <span className="flex items-center">
                    <span className="mr-1">
                      {po.unit === "kubik"
                        ? "📦 Volume-based"
                        : "⚖️ Weight-based"}
                    </span>
                    | {unitDisplay} pricing
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {purchaseOrders.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <div className="mb-6">
            <svg
              className="mx-auto h-16 w-16 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2 2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            No Purchase Orders Found
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            {searchTerm
              ? `Nothing matches "${searchTerm}". Try something else, genius.`
              : statusFilter !== "all"
              ? `No POs with status "${statusFilter}".`
              : "Create one."}
          </p>
          <Link to="/trips/create-po">
            <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
              Create Your First Purchase Order
            </button>
          </Link>
        </div>
      )}

      {hasMore && !loading && (
        <div className="text-center mt-6">
          <button
            onClick={() => fetchPurchaseOrders(false)} // Append next page
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Load More POs
          </button>
        </div>
      )}

      {showAdjustPopup && selectedPO && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Adjust Quantity</h2>
            <div className="mb-4">
              <div className="flex space-x-4 mb-2">
                <button
                  onClick={() => setAdjustmentType("add")}
                  className={`px-4 py-2 rounded-l ${
                    adjustmentType === "add"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  Addition
                </button>
                <button
                  onClick={() => setAdjustmentType("deduct")}
                  className={`px-4 py-2 rounded-r ${
                    adjustmentType === "deduct"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  Deduction
                </button>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full p-2 border rounded"
              />
            </div>
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={recordAsAdjustment}
                  onChange={(e) => setRecordAsAdjustment(e.target.checked)}
                  className="mr-2"
                />
                <span>Record as Quantity Adjustment</span>
              </label>
            </div>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowAdjustPopup(false)}
                className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustQuantity}
                className="bg-teal-500 hover:bg-teal-700 text-white px-4 py-2 rounded"
              >
                Adjust
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripsPage;
