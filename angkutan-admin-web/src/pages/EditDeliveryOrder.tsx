import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiClient from "../api/axiosConfig";

interface DeliveryOrderData {
  id: number;
  do_number: string;
  customer_name: string;
  item_name: string;
  minimal_load_quantity: number;
  actual_load_quantity?: number;
  unit: string;
  unit_price: number;
  total_amount: number;
  load_location: string;
  unload_location: string;
  status: string;
  payment_notes?: string;
  driver_name?: string;
  vehicle_info?: string;
  trip_allowance?: number;
  gaji?: number;
  additional_allowance?: number[];
}

interface AdditionalAllowance {
  amount: number;
  description: string;
}

const STATUS_OPTIONS = [
  { value: "assigned", label: "Ditugaskan" },
  { value: "otw_to_load_location", label: "Menuju Lokasi Muat" },
  { value: "at_load_location", label: "Di Lokasi Muat" },
  { value: "otw_to_unload_location", label: "Menuju Lokasi Bongkar" },
  { value: "at_unload_location", label: "Di Lokasi Bongkar" },
  { value: "otw_to_base", label: "Perjalanan Pulang" },
  { value: "completed", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
];

const EditDeliveryOrder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [deliveryOrder, setDeliveryOrder] = useState<DeliveryOrderData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [additionalAllowances, setAdditionalAllowances] = useState<
    AdditionalAllowance[]
  >([]);
  const [showAddAllowance, setShowAddAllowance] = useState(false);
  const [newAllowance, setNewAllowance] = useState({
    amount: 0,
    description: "",
  });

  const [formData, setFormData] = useState({
    customer_name: "",
    item_name: "",
    minimal_load_quantity: 0,
    actual_load_quantity: 0,
    unit: "ton",
    unit_price: 0,
    load_location: "",
    unload_location: "",
    payment_notes: "",
    trip_allowance: 0,
    gaji: 0,
    status: "assigned",
    additional_allowance: [] as number[],
  });

  // Recent locations suggestions (separate lists for load & unload)
  const [loadLocationSuggestions, setLoadLocationSuggestions] = useState<
    string[]
  >([]);
  const [unloadLocationSuggestions, setUnloadLocationSuggestions] = useState<
    string[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState<
    null | "load" | "unload"
  >(null);

  useEffect(() => {
    if (id) {
      fetchDeliveryOrder();
    }
    // fetch recent locations once on mount
    fetchRecentLocations();
  }, [id]);

  const fetchRecentLocations = async () => {
    try {
      const resp = await apiClient.get(
        "/purchase-orders/utils/recent-locations"
      );
      // Support multiple response shapes:
      // 1) { data: { load_locations: [...], unload_locations: [...] } }
      // 2) ["loc1", "loc2"] or { ... } (fallback)
      const payload = resp.data?.data || resp.data;

      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        // If API returned separate arrays
        const hasLoad = Array.isArray((payload as any).load_locations);
        const hasUnload = Array.isArray((payload as any).unload_locations);
        if (hasLoad || hasUnload) {
          const loadArr = hasLoad ? (payload as any).load_locations : [];
          const unloadArr = hasUnload ? (payload as any).unload_locations : [];
          setLoadLocationSuggestions(
            Array.from(new Set(loadArr as string[])).slice(0, 50)
          );
          setUnloadLocationSuggestions(
            Array.from(new Set(unloadArr as string[])).slice(0, 50)
          );
          return;
        }
      }

      const raw = payload || [];
      const data: any[] = Array.isArray(raw) ? raw : [raw];
      const locs: string[] = data
        .map((l: any) => {
          if (!l) return "";
          if (typeof l === "string") return l;
          return l.address || l.location || l.name || "";
        })
        .filter((s: string) => !!s && s.length > 0);
      const unique = Array.from(new Set(locs)) as string[];
      const top = unique.slice(0, 50);
      setLoadLocationSuggestions(top);
      setUnloadLocationSuggestions(top);
    } catch (err) {
      console.warn("Could not fetch recent locations", err);
    }
  };

  const fetchDeliveryOrder = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/delivery-orders/${id}`);
      const data = response.data.data;

      setDeliveryOrder(data);
      setFormData({
        customer_name: data.customer_name || "",
        item_name: data.item_name || "",
        minimal_load_quantity: data.minimal_load_quantity || 0,
        actual_load_quantity: data.actual_load_quantity || 0,
        unit: data.unit || "ton",
        unit_price: data.unit_price || 0,
        load_location: data.load_location || "",
        unload_location: data.unload_location || "",
        payment_notes: data.payment_notes || "",
        trip_allowance: data.trip_allowance || 0,
        gaji: data.gaji || 0,
        status: data.status || "assigned",
        additional_allowance: data.additional_allowance || [],
      });

      if (
        data.additional_allowance &&
        Array.isArray(data.additional_allowance)
      ) {
        setAdditionalAllowances(
          data.additional_allowance.map((amount: number) => ({
            amount,
            description: "",
          }))
        );
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch delivery order");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name.includes("quantity") ||
        name.includes("price") ||
        name.includes("allowance") ||
        name === "gaji"
          ? parseFloat(value) || 0
          : value,
    }));
  };

  const handleAddAllowance = () => {
    if (newAllowance.amount <= 0) {
      setError("Allowance amount must be greater than 0");
      return;
    }

    const updatedAllowances = [...additionalAllowances, newAllowance];
    setAdditionalAllowances(updatedAllowances);

    setFormData((prev) => ({
      ...prev,
      additional_allowance: updatedAllowances.map((a) => a.amount),
      payment_notes: newAllowance.description
        ? prev.payment_notes
          ? `${
              prev.payment_notes
            }\nAdditional Allowance: Rp ${newAllowance.amount.toLocaleString(
              "id-ID"
            )} - ${newAllowance.description}`
          : `Additional Allowance: Rp ${newAllowance.amount.toLocaleString(
              "id-ID"
            )} - ${newAllowance.description}`
        : prev.payment_notes,
    }));

    setNewAllowance({ amount: 0, description: "" });
    setShowAddAllowance(false);
  };

  const handleRemoveAllowance = (index: number) => {
    const updatedAllowances = additionalAllowances.filter(
      (_, i) => i !== index
    );
    setAdditionalAllowances(updatedAllowances);

    setFormData((prev) => ({
      ...prev,
      additional_allowance: updatedAllowances.map((a) => a.amount),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      await apiClient.put(`/delivery-orders/${id}`, formData);
      navigate("/delivery-orders", {
        state: { message: "Delivery Order updated successfully!" },
      });
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to update delivery order"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!cancellationReason.trim()) {
      setError("Cancellation reason is required");
      return;
    }

    try {
      setCancelling(true);
      setError(null);
      await apiClient.patch(`/delivery-orders/${id}/cancel`, {
        cancellation_reason: cancellationReason,
      });
      setShowCancelModal(false);
      navigate("/delivery-orders", {
        state: { message: "Delivery Order cancelled successfully!" },
      });
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to cancel delivery order"
      );
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error && !deliveryOrder) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>Error: {error}</p>
          <button
            onClick={() => navigate("/delivery-orders")}
            className="mt-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Back to Delivery Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <span>Edit Delivery Order</span>
              {deliveryOrder?.status === "completed" && (
                <span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-semibold">
                  Completed
                </span>
              )}
              {deliveryOrder?.status === "cancelled" && (
                <span className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-semibold">
                  Cancelled
                </span>
              )}
            </h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
              <span>
                <span className="font-medium">DO Number:</span>{" "}
                {deliveryOrder?.do_number}
              </span>
              {deliveryOrder?.driver_name && (
                <span>
                  <span className="font-medium">Driver:</span>{" "}
                  {deliveryOrder.driver_name}
                </span>
              )}
              {deliveryOrder?.vehicle_info && (
                <span>
                  <span className="font-medium">Vehicle:</span>{" "}
                  {deliveryOrder.vehicle_info}
                </span>
              )}
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => navigate("/delivery-orders")}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={
                deliveryOrder?.status === "cancelled" ||
                deliveryOrder?.status === "completed"
              }
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Cancel DO
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-lg rounded-lg p-8 border border-gray-100"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Customer Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer Name
            </label>
            <input
              type="text"
              name="customer_name"
              value={formData.customer_name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Item Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Item Name
            </label>
            <input
              type="text"
              name="item_name"
              value={formData.item_name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Minimal Load Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Quantity
            </label>
            <input
              type="number"
              name="minimal_load_quantity"
              value={formData.minimal_load_quantity}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Actual Load Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Actual Quantity
            </label>
            <input
              type="number"
              name="actual_load_quantity"
              value={formData.actual_load_quantity}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Unit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unit
            </label>
            <select
              name="unit"
              value={formData.unit}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ton">Ton</option>
              <option value="kilogram">Kilogram</option>
              <option value="kubik">Kubik</option>
            </select>
          </div>

          {/* Unit Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unit Price (Rp)
            </label>
            <input
              type="number"
              name="unit_price"
              value={formData.unit_price}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Trip Allowance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trip Allowance (Rp)
            </label>
            <input
              type="number"
              name="trip_allowance"
              value={formData.trip_allowance}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Gaji */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Driver Salary (Rp)
            </label>
            <input
              type="number"
              name="gaji"
              value={formData.gaji}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Additional Allowances */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Allowances
            </label>
            <div className="space-y-2 mb-2">
              {additionalAllowances.map((allowance, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 p-3 rounded-md"
                >
                  <div>
                    <span className="font-medium">
                      Rp {allowance.amount.toLocaleString("id-ID")}
                    </span>
                    {allowance.description && (
                      <span className="text-gray-600 ml-2">
                        - {allowance.description}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAllowance(index)}
                    className="text-red-600 hover:text-red-800 text-lg"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowAddAllowance(true)}
              className="flex items-center text-blue-600 hover:text-blue-800"
            >
              <span className="text-lg mr-1">+</span> Add Additional Allowance
            </button>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Load Location */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Load Location
          </label>
          <input
            type="text"
            name="load_location"
            value={formData.load_location}
            onChange={handleInputChange}
            onFocus={() => setShowSuggestions("load")}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {showSuggestions === "load" && loadLocationSuggestions.length > 0 && (
            <div className="mt-2 bg-white border rounded shadow max-h-40 overflow-auto">
              {loadLocationSuggestions
                .filter((r) =>
                  r
                    .toLowerCase()
                    .includes((formData.load_location || "").toLowerCase())
                )
                .slice(0, 10)
                .map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, load_location: r }))
                    }
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                  >
                    {r}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Unload Location */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Unload Location
          </label>
          <input
            type="text"
            name="unload_location"
            value={formData.unload_location}
            onChange={handleInputChange}
            onFocus={() => setShowSuggestions("unload")}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {showSuggestions === "unload" &&
            unloadLocationSuggestions.length > 0 && (
              <div className="mt-2 bg-white border rounded shadow max-h-40 overflow-auto">
                {unloadLocationSuggestions
                  .filter((r) =>
                    r
                      .toLowerCase()
                      .includes((formData.unload_location || "").toLowerCase())
                  )
                  .slice(0, 10)
                  .map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, unload_location: r }))
                      }
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                    >
                      {r}
                    </button>
                  ))}
              </div>
            )}
        </div>

        {/* Payment Notes */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Notes
          </label>
          <textarea
            name="payment_notes"
            value={formData.payment_notes}
            onChange={handleInputChange}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Additional payment notes..."
          />
        </div>

        {/* Submit Button */}
        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Update Delivery Order"}
          </button>
        </div>
      </form>

      {/* Add Allowance Modal */}
      {showAddAllowance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add Additional Allowance
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (Rp)
              </label>
              <input
                type="number"
                value={newAllowance.amount}
                onChange={(e) =>
                  setNewAllowance({
                    ...newAllowance,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <input
                type="text"
                value={newAllowance.description}
                onChange={(e) =>
                  setNewAllowance({
                    ...newAllowance,
                    description: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Reason for additional allowance"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowAddAllowance(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAllowance}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add Allowance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Cancel Delivery Order
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to cancel this delivery order? This action
              cannot be undone.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cancellation Reason *
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Please provide a reason for cancellation..."
                required
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Keep DO
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling || !cancellationReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {cancelling ? "Cancelling..." : "Cancel DO"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditDeliveryOrder;
