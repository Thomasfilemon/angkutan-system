// src/pages/BigDODetailPage.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import apiClient from "../api/axiosConfig";
import { toast } from "react-hot-toast";

interface BigDODetail {
  id: number;
  big_do_number: string;
  status: string;
  status_text: string;
  driver_name: string;
  vehicle_info: string;
  notes: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  mainDeliveryOrder: {
    id: number;
    do_number: string;
    customer_name: string;
    item_name: string;
    minimal_load_quantity: number;
    actual_load_quantity?: number;
    unit: string;
    unit_price: number;
    total_amount: number;
    status: string;
    load_location: string;
    unload_location: string;
    purchaseOrder: {
      po_number: string;
      customer_name: string;
    };
  };
  tambahan: Tambahan[];
  financial_summary: {
    main_do_amount: number;
    tambahan_total_amount: number;
    total_revenue: number;
    total_trip_allowance: number;
    total_gaji: number;
    total_ongkosan: number;
    total_for_driver: number;
    net_profit: number;
  };
  quantity_summary: {
    main_do_quantity: number;
    tambahan_quantity: number;
    total_quantity: number;
    main_unit: string;
  };
  delivery_progress: {
    main_do_completed: boolean;
    tambahan_completed: number;
    total_tambahan: number;
    completion_percentage: number;
  };
}

interface Tambahan {
  id: number;
  tambahan_number: string;
  customer_name: string;
  customer_phone?: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_amount: number;
  pickup_location: string;
  delivery_location: string;
  status: string;
  status_text: string;
  picked_up_at?: string;
  delivered_at?: string;
  notes?: string;
}

interface TambahanFormData {
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  item_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  pickup_location: string;
  delivery_location: string;
  notes: string;
}

const BigDODetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [bigDO, setBigDO] = useState<BigDODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "tambahan" | "timeline"
  >("overview");

  // Modals state
  const [showAddTambahanModal, setShowAddTambahanModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editingTambahan, setEditingTambahan] = useState<Tambahan | null>(null);

  // Forms state
  const [statusForm, setStatusForm] = useState({
    status: "",
    notes: "",
  });

  const [tambahanForm, setTambahanForm] = useState<TambahanFormData>({
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    item_name: "",
    quantity: 0,
    unit: "ton",
    unit_price: 0,
    pickup_location: "",
    delivery_location: "",
    notes: "",
  });

  const [submitting, setSubmitting] = useState(false);

  const fetchBigDODetail = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get(`/big-delivery-orders/${id}`);
      const data = response.data.success ? response.data.data : response.data;

      setBigDO(data);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || "Failed to fetch Big DO details";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBigDODetail();
  }, [id]);

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString("id-ID")}`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("id-ID");
  };

  const getStatusColor = (status: string) => {
    const colors = {
      assigned: "bg-yellow-100 text-yellow-800 border-yellow-300",
      picked_up: "bg-blue-100 text-blue-800 border-blue-300",
      in_transit: "bg-purple-100 text-purple-800 border-purple-300",
      in_progress: "bg-blue-100 text-blue-800 border-blue-300",
      delivered: "bg-green-100 text-green-800 border-green-300",
      completed: "bg-green-100 text-green-800 border-green-300",
      cancelled: "bg-red-100 text-red-800 border-red-300",
    };
    return (
      colors[status as keyof typeof colors] ||
      "bg-gray-100 text-gray-800 border-gray-300"
    );
  };

  const calculateTambahanAmount = (
    quantity: number,
    unit: string,
    unitPrice: number
  ) => {
    switch (unit) {
      case "kilogram":
        return quantity * unitPrice;
      case "ton":
        return quantity * 1000 * unitPrice;
      case "kubik":
        return quantity * unitPrice;
      default:
        return quantity * unitPrice;
    }
  };

  const handleUpdateStatus = async () => {
    if (!bigDO || !statusForm.status) return;

    try {
      setSubmitting(true);
      await apiClient.patch(
        `/big-delivery-orders/${bigDO.id}/status`,
        statusForm
      );

      toast.success("Big DO status updated successfully");
      setShowStatusModal(false);
      await fetchBigDODetail();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update status");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTambahan = async () => {
    if (!bigDO) return;

    try {
      setSubmitting(true);
      const payload = {
        ...tambahanForm,
        total_amount: calculateTambahanAmount(
          tambahanForm.quantity,
          tambahanForm.unit,
          tambahanForm.unit_price
        ),
      };

      await apiClient.post(
        `/big-delivery-orders/${bigDO.id}/tambahan`,
        payload
      );

      toast.success("Tambahan added successfully");
      setShowAddTambahanModal(false);
      setTambahanForm({
        customer_name: "",
        customer_phone: "",
        customer_address: "",
        item_name: "",
        quantity: 0,
        unit: "ton",
        unit_price: 0,
        pickup_location: "",
        delivery_location: "",
        notes: "",
      });
      await fetchBigDODetail();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to add tambahan");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTambahanStatus = async (
    tambahanId: number,
    status: string
  ) => {
    try {
      await apiClient.patch(
        `/big-delivery-orders/${bigDO?.id}/tambahan/${tambahanId}/status`,
        {
          status,
          notes: `Status updated to ${status}`,
        }
      );

      toast.success("Tambahan status updated");
      await fetchBigDODetail();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to update tambahan status"
      );
    }
  };

  const handleCancelBigDO = async () => {
    if (!bigDO) return;

    if (
      !window.confirm(
        "Are you sure you want to cancel this Big DO? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.patch(`/big-delivery-orders/${bigDO.id}/cancel`, {
        cancellation_reason: "Cancelled by admin",
      });

      toast.success("Big DO cancelled successfully");
      await fetchBigDODetail();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to cancel Big DO");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Big DO details...</p>
        </div>
      </div>
    );
  }

  if (error || !bigDO) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Error Loading Big DO
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error || "Big DO not found"}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={() => navigate("/big-dos")}
                className="bg-red-100 px-4 py-2 rounded-md text-red-800 hover:bg-red-200 transition-colors"
              >
                ← Back to Big DOs
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate("/big-dos")}
              className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <svg
                className="h-5 w-5 mr-2"
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
              Back
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {bigDO.big_do_number}
              </h1>
              <p className="text-gray-600">Big Delivery Order Details</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
              bigDO.status
            )}`}
          >
            {bigDO.status_text}
          </span>

          {bigDO.status === "assigned" && (
            <>
              <button
                onClick={() => setShowStatusModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Update Status
              </button>
              <button
                onClick={() => setShowAddTambahanModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                ➕ Add Tambahan
              </button>
              <button
                onClick={handleCancelBigDO}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Cancel Big DO
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Info Card */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 shadow-xl rounded-lg overflow-hidden">
        <div className="px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  Big DO Information
                </h2>
                <div className="bg-white/10 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-100">Driver:</span>
                    <span className="text-white font-medium">
                      {bigDO.driver_name}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-100">Vehicle:</span>
                    <span className="text-white font-medium">
                      {bigDO.vehicle_info}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-100">Main Customer:</span>
                    <span className="text-white font-medium">
                      {bigDO.mainDeliveryOrder.customer_name}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-100">Total Quantity:</span>
                    <span className="text-white font-medium">
                      {bigDO.quantity_summary.total_quantity.toLocaleString(
                        "id-ID"
                      )}{" "}
                      {bigDO.quantity_summary.main_unit}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Financial Summary
                </h3>
                <div className="bg-white/10 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-purple-100">Total Revenue:</span>
                    <span className="text-white font-bold">
                      {formatCurrency(bigDO.financial_summary.total_revenue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-100">Driver Costs:</span>
                    <span className="text-white font-bold">
                      {formatCurrency(bigDO.financial_summary.total_for_driver)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-white/20 pt-2">
                    <span className="text-purple-100">Net Profit:</span>
                    <span className="text-white font-bold">
                      {formatCurrency(bigDO.financial_summary.net_profit)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Delivery Progress
                </h3>
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-purple-100">Completion</span>
                    <span className="text-white font-bold">
                      {Math.round(
                        bigDO.delivery_progress.completion_percentage
                      )}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-4 mb-3">
                    <div
                      className="bg-white h-4 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          bigDO.delivery_progress.completion_percentage,
                          100
                        )}%`,
                      }}
                    ></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-purple-100">Main DO:</span>
                      <div className="text-white font-medium">
                        {bigDO.delivery_progress.main_do_completed
                          ? "✅ Done"
                          : "⏳ Pending"}
                      </div>
                    </div>
                    <div>
                      <span className="text-purple-100">Tambahan:</span>
                      <div className="text-white font-medium">
                        {bigDO.delivery_progress.tambahan_completed}/
                        {bigDO.delivery_progress.total_tambahan}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {[
              { key: "overview", label: "Overview", count: null },
              {
                key: "tambahan",
                label: "Tambahan",
                count: bigDO.tambahan.length,
              },
              { key: "timeline", label: "Timeline", count: null },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.key
                    ? "border-purple-500 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      activeTab === tab.key
                        ? "bg-purple-100 text-purple-600"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Main DO Details */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-blue-900 mb-4">
                  Main Delivery Order
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-blue-700">DO Number:</span>
                    <Link
                      to={`/delivery-orders/${bigDO.mainDeliveryOrder.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {bigDO.mainDeliveryOrder.do_number}
                    </Link>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">PO Number:</span>
                    <span className="text-blue-900 font-medium">
                      {bigDO.mainDeliveryOrder.purchaseOrder.po_number}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Item:</span>
                    <span className="text-blue-900 font-medium">
                      {bigDO.mainDeliveryOrder.item_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Quantity:</span>
                    <span className="text-blue-900 font-medium">
                      {bigDO.mainDeliveryOrder.minimal_load_quantity}{" "}
                      {bigDO.mainDeliveryOrder.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Amount:</span>
                    <span className="text-blue-900 font-medium">
                      {formatCurrency(bigDO.mainDeliveryOrder.total_amount)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-blue-200">
                    <div className="text-sm text-blue-600">Locations:</div>
                    <div className="text-xs text-blue-700 mt-1">
                      <div>
                        <strong>From:</strong>{" "}
                        {bigDO.mainDeliveryOrder.load_location}
                      </div>
                      <div>
                        <strong>To:</strong>{" "}
                        {bigDO.mainDeliveryOrder.unload_location}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-green-900 mb-4">
                  Financial Breakdown
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-green-700">Main DO Revenue:</span>
                    <span className="text-green-900 font-medium">
                      {formatCurrency(bigDO.financial_summary.main_do_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Tambahan Revenue:</span>
                    <span className="text-green-900 font-medium">
                      {formatCurrency(
                        bigDO.financial_summary.tambahan_total_amount
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-green-200 pt-2">
                    <span className="text-green-700 font-medium">
                      Total Revenue:
                    </span>
                    <span className="text-green-900 font-bold">
                      {formatCurrency(bigDO.financial_summary.total_revenue)}
                    </span>
                  </div>
                  <div className="border-t border-green-200 pt-2 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">Trip Allowance:</span>
                      <span className="text-green-800">
                        {formatCurrency(
                          bigDO.financial_summary.total_trip_allowance
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">Driver Salary:</span>
                      <span className="text-green-800">
                        {formatCurrency(bigDO.financial_summary.total_gaji)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-medium border-t border-green-200 pt-2">
                      <span className="text-green-700">Net Profit:</span>
                      <span className="text-green-900">
                        {formatCurrency(bigDO.financial_summary.net_profit)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tambahan Tab */}
          {activeTab === "tambahan" && (
            <div className="space-y-4">
              {bigDO.tambahan.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    No tambahan deliveries added yet
                  </p>
                  {bigDO.status === "assigned" && (
                    <button
                      onClick={() => setShowAddTambahanModal(true)}
                      className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      ➕ Add First Tambahan
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4">
                  {bigDO.tambahan.map((item) => (
                    <div
                      key={item.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {item.tambahan_number}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {item.customer_name}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                              item.status
                            )}`}
                          >
                            {item.status_text}
                          </span>
                          {bigDO.status === "assigned" &&
                            item.status !== "delivered" && (
                              <div className="flex space-x-1">
                                {item.status === "assigned" && (
                                  <button
                                    onClick={() =>
                                      handleUpdateTambahanStatus(
                                        item.id,
                                        "picked_up"
                                      )
                                    }
                                    className="text-blue-600 hover:text-blue-800 text-xs"
                                  >
                                    Pick Up
                                  </button>
                                )}
                                {item.status === "picked_up" && (
                                  <button
                                    onClick={() =>
                                      handleUpdateTambahanStatus(
                                        item.id,
                                        "delivered"
                                      )
                                    }
                                    className="text-green-600 hover:text-green-800 text-xs"
                                  >
                                    Deliver
                                  </button>
                                )}
                              </div>
                            )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Item:</span>
                          <div className="font-medium">{item.item_name}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">Quantity:</span>
                          <div className="font-medium">
                            {item.quantity} {item.unit}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Unit Price:</span>
                          <div className="font-medium">
                            {formatCurrency(item.unit_price)}/{item.unit}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Total:</span>
                          <div className="font-medium text-green-600">
                            {formatCurrency(item.total_amount)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-sm">
                        <div>
                          <span className="text-gray-500">Pickup:</span>
                          <div className="text-gray-700">
                            {item.pickup_location}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Delivery:</span>
                          <div className="text-gray-700">
                            {item.delivery_location}
                          </div>
                        </div>
                      </div>

                      {(item.picked_up_at || item.delivered_at) && (
                        <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
                          {item.picked_up_at && (
                            <div>
                              Picked up: {formatDateTime(item.picked_up_at)}
                            </div>
                          )}
                          {item.delivered_at && (
                            <div>
                              Delivered: {formatDateTime(item.delivered_at)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === "timeline" && (
            <div className="space-y-4">
              <div className="flow-root">
                <ul className="-mb-8">
                  <li>
                    <div className="relative pb-8">
                      <div className="relative flex space-x-3">
                        <div className="flex items-center justify-center w-8 h-8 bg-green-500 rounded-full">
                          <span className="text-white text-sm">📋</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-gray-500">
                            <strong className="text-gray-900">
                              Big DO Created
                            </strong>
                            <span className="ml-2">
                              {formatDateTime(bigDO.created_at)}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-gray-600">
                            Big DO {bigDO.big_do_number} created with main DO{" "}
                            {bigDO.mainDeliveryOrder.do_number}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>

                  {bigDO.started_at && (
                    <li>
                      <div className="relative pb-8">
                        <div className="relative flex space-x-3">
                          <div className="flex items-center justify-center w-8 h-8 bg-blue-500 rounded-full">
                            <span className="text-white text-sm">🚀</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-gray-500">
                              <strong className="text-gray-900">
                                Big DO Started
                              </strong>
                              <span className="ml-2">
                                {formatDateTime(bigDO.started_at)}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-gray-600">
                              Driver started executing the Big DO
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  )}

                  {bigDO.completed_at && (
                    <li>
                      <div className="relative">
                        <div className="relative flex space-x-3">
                          <div className="flex items-center justify-center w-8 h-8 bg-green-500 rounded-full">
                            <span className="text-white text-sm">✅</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-gray-500">
                              <strong className="text-gray-900">
                                Big DO Completed
                              </strong>
                              <span className="ml-2">
                                {formatDateTime(bigDO.completed_at)}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-gray-600">
                              All deliveries completed successfully
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Update Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Update Big DO Status</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Status
                </label>
                <select
                  value={statusForm.status}
                  onChange={(e) =>
                    setStatusForm({ ...statusForm, status: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Select status</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={statusForm.notes}
                  onChange={(e) =>
                    setStatusForm({ ...statusForm, notes: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                  placeholder="Add notes for this status change..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStatus}
                disabled={!statusForm.status || submitting}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Updating..." : "Update Status"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Tambahan Modal */}
      {showAddTambahanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 my-8">
            <h3 className="text-lg font-medium mb-4">Add Tambahan Delivery</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={tambahanForm.customer_name}
                  onChange={(e) =>
                    setTambahanForm({
                      ...tambahanForm,
                      customer_name: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Phone
                </label>
                <input
                  type="tel"
                  value={tambahanForm.customer_phone}
                  onChange={(e) =>
                    setTambahanForm({
                      ...tambahanForm,
                      customer_phone: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Address
                </label>
                <textarea
                  value={tambahanForm.customer_address}
                  onChange={(e) =>
                    setTambahanForm({
                      ...tambahanForm,
                      customer_address: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  value={tambahanForm.item_name}
                  onChange={(e) =>
                    setTambahanForm({
                      ...tambahanForm,
                      item_name: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={tambahanForm.quantity}
                    onChange={(e) =>
                      setTambahanForm({
                        ...tambahanForm,
                        quantity: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit
                  </label>
                  <select
                    value={tambahanForm.unit}
                    onChange={(e) =>
                      setTambahanForm({ ...tambahanForm, unit: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="kilogram">Kg</option>
                    <option value="ton">Ton</option>
                    <option value="kubik">m³</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={tambahanForm.unit_price}
                    onChange={(e) =>
                      setTambahanForm({
                        ...tambahanForm,
                        unit_price: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pickup Location *
                </label>
                <input
                  type="text"
                  value={tambahanForm.pickup_location}
                  onChange={(e) =>
                    setTambahanForm({
                      ...tambahanForm,
                      pickup_location: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Location *
                </label>
                <input
                  type="text"
                  value={tambahanForm.delivery_location}
                  onChange={(e) =>
                    setTambahanForm({
                      ...tambahanForm,
                      delivery_location: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={tambahanForm.notes}
                  onChange={(e) =>
                    setTambahanForm({ ...tambahanForm, notes: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={2}
                />
              </div>
            </div>

            {/* Calculated Amount Preview */}
            {tambahanForm.quantity > 0 && tambahanForm.unit_price > 0 && (
              <div className="mt-4 p-3 bg-green-50 rounded-md">
                <div className="text-sm text-gray-600">
                  Calculated Amount:{" "}
                  <strong className="text-green-600">
                    {formatCurrency(
                      calculateTambahanAmount(
                        tambahanForm.quantity,
                        tambahanForm.unit,
                        tambahanForm.unit_price
                      )
                    )}
                  </strong>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddTambahanModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTambahan}
                disabled={
                  !tambahanForm.customer_name ||
                  !tambahanForm.item_name ||
                  tambahanForm.quantity <= 0 ||
                  tambahanForm.unit_price <= 0 ||
                  submitting
                }
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? "Adding..." : "Add Tambahan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BigDODetailPage;
