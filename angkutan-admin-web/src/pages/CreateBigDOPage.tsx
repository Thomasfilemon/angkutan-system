// src/pages/CreateBigDOPage.tsx
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import apiClient from "../api/axiosConfig";

interface SessionDO {
  id: number;
  do_number: string;
  customer_name: string;
  item_name: string;
  minimal_load_quantity: number;
  unit: string;
  unit_display: string;
  load_location: string;
  unload_location: string;
  total_amount: number;
  gaji: number;
  ongkosan: number;
  display_order: number;
  purchaseOrder: {
    po_number: string;
    customer_name: string;
  };
  financial_summary: {
    trip_allowance: number;
    gaji: number;
    total_for_driver: number;
    total_amount: number;
    ongkosan: number;
    unit_display: string;
  };
}

interface SessionData {
  session_id: string;
  delivery_orders: SessionDO[];
  session_totals: {
    total_dos: number;
    total_gaji: number;
    total_ongkosan: number;
    total_revenue: number;
  };
  driver_info: string;
  vehicle_info: string;
}

interface ConfirmToastProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
}

// 🎯 NEW: Sortable DO Item Component
interface SortableDOItemProps {
  dOrder: SessionDO;
  index: number;
  onRemove: (id: number) => void;
  canRemove: boolean;
  formatCurrency: (amount: number) => string;
}

const ConfirmToast: React.FC<ConfirmToastProps> = ({
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "warning",
}) => {
  const typeStyles = {
    danger: "border-red-200 bg-red-50",
    warning: "border-yellow-200 bg-yellow-50",
    info: "border-blue-200 bg-blue-50",
  };

  const buttonStyles = {
    danger: "bg-red-600 hover:bg-red-700 text-white",
    warning: "bg-yellow-600 hover:bg-yellow-700 text-white",
    info: "bg-blue-600 hover:bg-blue-700 text-white",
  };

  return (
    <div
      className={`max-w-md w-full bg-white shadow-lg rounded-lg border-2 ${typeStyles[type]} p-4`}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {type === "danger" && (
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          )}
          {type === "warning" && (
            <svg
              className="h-6 w-6 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          )}
          {type === "info" && (
            <svg
              className="h-6 w-6 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </div>
        <div className="ml-3 w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">{message}</p>
          <div className="mt-4 flex space-x-3">
            <button
              onClick={onConfirm}
              className={`inline-flex justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${buttonStyles[type]}`}
            >
              {confirmText}
            </button>
            <button
              onClick={onCancel}
              className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const showConfirmToast = (
  message: string,
  onConfirm: () => void,
  options: {
    confirmText?: string;
    cancelText?: string;
    type?: "danger" | "warning" | "info";
  } = {}
) => {
  return toast.custom(
    (t) => (
      <ConfirmToast
        message={message}
        onConfirm={() => {
          toast.dismiss(t.id);
          onConfirm();
        }}
        onCancel={() => toast.dismiss(t.id)}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        type={options.type}
      />
    ),
    {
      duration: Infinity,
      position: "top-center",
    }
  );
};

const SortableDOItem: React.FC<SortableDOItemProps> = ({
  dOrder,
  index,
  onRemove,
  canRemove,
  formatCurrency,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dOrder.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-xl p-6 mb-4 bg-white transition-all duration-200 ${
        isDragging
          ? "shadow-2xl border-blue-300 z-50"
          : "border-gray-200 hover:border-gray-300 hover:shadow-md"
      }`}
    >
      <div className="flex items-start space-x-4">
        {/* 🎯 Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing mt-1"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a1 1 0 000 2h6a1 1 0 100-2H7zM7 8a1 1 0 000 2h6a1 1 0 100-2H7zM7 14a1 1 0 000 2h6a1 1 0 100-2H7z" />
          </svg>
        </div>

        {/* 🎯 Sequence Badge */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
            {index + 1}
          </div>
        </div>

        {/* DO Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 text-lg">
                {dOrder.do_number}
              </h4>
              <p className="text-gray-600 mt-1">
                <span className="font-medium">{dOrder.customer_name}</span> •{" "}
                {dOrder.item_name}
              </p>
              <p className="text-blue-600 font-medium mt-1">
                {dOrder.minimal_load_quantity.toLocaleString("id-ID")}{" "}
                {dOrder.unit_display}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PO: {dOrder.purchaseOrder.po_number}
              </p>
            </div>

            {/* Route Info */}
            <div className="mt-4 lg:mt-0 lg:ml-6 lg:text-right flex-shrink-0">
              <div className="text-sm">
                <div className="text-gray-500 mb-1">Route</div>
                <div className="bg-gray-50 rounded-lg p-3 max-w-xs">
                  <div
                    className="text-xs text-gray-600 truncate"
                    title={dOrder.load_location}
                  >
                    📍 {dOrder.load_location}
                  </div>
                  <div className="text-gray-400 text-center my-1">↓</div>
                  <div
                    className="text-xs text-gray-600 truncate"
                    title={dOrder.unload_location}
                  >
                    🏁 {dOrder.unload_location}
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Info */}
            <div className="mt-4 lg:mt-0 lg:ml-6 lg:text-right flex-shrink-0">
              <div className="text-sm space-y-1">
                <div>
                  <span className="text-gray-500">Revenue:</span>
                  <span className="font-semibold text-green-600 ml-2">
                    {formatCurrency(dOrder.total_amount)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Gaji:</span>
                  <span className="font-medium text-gray-900 ml-2">
                    {formatCurrency(dOrder.gaji)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Ongkosan:</span>
                  <span className="font-medium text-blue-600 ml-2">
                    {formatCurrency(dOrder.ongkosan)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Remove Button */}
        <button
          onClick={() => onRemove(dOrder.id)}
          disabled={!canRemove}
          className="flex-shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            !canRemove ? "Big DO requires at least 2 DOs" : "Remove from Big DO"
          }
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

// 🎯 NEW: Drag Overlay Component
const DragOverlayComponent: React.FC<{
  dOrder: SessionDO | null;
  formatCurrency: (amount: number) => string;
}> = ({ dOrder, formatCurrency }) => {
  if (!dOrder) return null;

  return (
    <div className="border rounded-xl p-6 bg-white shadow-2xl border-blue-300 transform rotate-3 opacity-95">
      <div className="flex items-start space-x-4">
        <div className="w-6 h-6 text-gray-400">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a1 1 0 000 2h6a1 1 0 100-2H7zM7 8a1 1 0 000 2h6a1 1 0 100-2H7zM7 14a1 1 0 000 2h6a1 1 0 100-2H7z" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 text-lg">
            {dOrder.do_number}
          </h4>
          <p className="text-gray-600 mt-1">
            <span className="font-medium">{dOrder.customer_name}</span> •{" "}
            {dOrder.item_name}
          </p>
          <p className="text-blue-600 font-medium mt-1">
            {dOrder.minimal_load_quantity.toLocaleString("id-ID")}{" "}
            {dOrder.unit_display}
          </p>
        </div>
      </div>
    </div>
  );
};

const CreateBigDOPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session");
  const driverId = searchParams.get("driver_id");
  const vehicleId = searchParams.get("vehicle_id");

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [addingDO, setAddingDO] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    trip_allowance: "",
    notes: "",
  });

  // 🎯 DND Kit Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Currency formatter
  const formatCurrency = (amount: number) =>
    `Rp ${amount.toLocaleString("de-DE")}`;

  useEffect(() => {
    if (sessionId) {
      fetchSessionData();
    } else {
      setError("No session ID provided");
      setLoading(false);
    }
  }, [sessionId]);

  const fetchSessionData = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(
        `/delivery-orders/big-do-session/${sessionId}`
      );
      setSessionData(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch session data");
      toast.error("Failed to load session data"); // 🎯 MODERN TOAST
    } finally {
      setLoading(false);
    }
  };

  // 🎯 DND Kit Handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(Number(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!sessionData || !over || active.id === over.id) return;

    const oldIndex = sessionData.delivery_orders.findIndex(
      (item) => item.id === Number(active.id)
    );
    const newIndex = sessionData.delivery_orders.findIndex(
      (item) => item.id === Number(over.id)
    );

    if (oldIndex === -1 || newIndex === -1) return;

    // Update local state immediately for smooth UX
    const newDeliveryOrders = arrayMove(
      sessionData.delivery_orders,
      oldIndex,
      newIndex
    );
    setSessionData((prev) =>
      prev
        ? {
            ...prev,
            delivery_orders: newDeliveryOrders,
          }
        : null
    );

    // Send update to backend
    try {
      const orderData = newDeliveryOrders.map((dOrder, index) => ({
        id: dOrder.id,
        display_order: index + 1,
      }));

      await apiClient.patch(
        `/delivery-orders/big-do-session/${sessionId}/reorder`,
        {
          delivery_orders_with_order: orderData,
        }
      );

      toast.success("Order updated successfully", { duration: 2000 }); // 🎯 MODERN TOAST
    } catch (err) {
      console.error("Failed to update order:", err);
      toast.error("Failed to update order"); // 🎯 MODERN TOAST
      fetchSessionData(); // Revert on error
    }
  };

  const handleAddAnotherDO = () => {
    const params = new URLSearchParams({
      big_do_session: sessionId || "",
      driver_id: driverId || "",
      vehicle_id: vehicleId || "",
      is_additional_do_for_session: "true",
    });

    navigate(`/trips/po/create-do?${params.toString()}`);
  };

  // 🎯 ENHANCED: Modern confirm with toast
  const handleRemoveDO = async (doId: number) => {
    if (!sessionData || sessionData.delivery_orders.length <= 1) {
      toast.error("Big DO must have at least 2 delivery orders", {
        icon: "⚠️",
        style: {
          borderRadius: "10px",
          background: "#fef2f2",
          color: "#dc2626",
          border: "1px solid #fecaca",
        },
      });
      return;
    }

    // 🎯 MODERN CONFIRMATION
    showConfirmToast(
      "Remove this DO from Big DO session? This action cannot be undone.",
      () => proceedWithRemoval(doId),
      {
        confirmText: "Remove DO",
        cancelText: "Keep DO",
        type: "danger",
      }
    );
  };

  const proceedWithRemoval = async (doId: number) => {
    try {
      const removedDO = sessionData?.delivery_orders.find(
        (dOrder) => dOrder.id === doId
      );
      const updatedDOs =
        sessionData?.delivery_orders.filter((dOrder) => dOrder.id !== doId) ||
        [];

      setSessionData((prev) =>
        prev
          ? {
              ...prev,
              delivery_orders: updatedDOs,
              session_totals: {
                ...prev.session_totals,
                total_dos: updatedDOs.length,
                total_gaji: updatedDOs.reduce(
                  (sum, dOrder) => sum + dOrder.gaji,
                  0
                ),
                total_ongkosan: updatedDOs.reduce(
                  (sum, dOrder) => sum + dOrder.ongkosan,
                  0
                ),
                total_revenue: updatedDOs.reduce(
                  (sum, dOrder) => sum + dOrder.total_amount,
                  0
                ),
              },
            }
          : null
      );

      // Show success toast with undo option
      toast.success(`DO ${removedDO?.do_number} removed from session`, {
        duration: 5000,
        icon: "🗑️",
      });

      // You would implement the actual removal API call here
      // await apiClient.delete(`/delivery-orders/big-do-session/${sessionId}/do/${doId}`);
    } catch (err) {
      toast.error("Failed to remove DO from session");
      fetchSessionData(); // Refresh on error
    }
  };

  // 🎯 ENHANCED: Modern validation with toast
  const handleFinalizeBigDO = async () => {
    // ✅ ONLY validate during finalization, not page render
    if (!sessionData || sessionData.delivery_orders.length < 2) {
      toast.error(
        "Big DO requires at least 2 delivery orders. Please add more DOs first.",
        {
          icon: "📦",
          duration: 5000,
          style: {
            borderRadius: "10px",
            background: "#fef2f2",
            color: "#dc2626",
          },
        }
      );

      // 🎯 Focus on add button instead of blocking
      const addButton = document.querySelector("[data-add-do-button]");
      if (addButton) {
        addButton.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }

    if (!formData.trip_allowance) {
      toast.error("Please enter trip allowance before creating Big DO");
      return;
    }

    if (!formData.trip_allowance) {
      toast.error("Please enter trip allowance before creating Big DO", {
        icon: "💰",
        style: {
          borderRadius: "10px",
          background: "#fef2f2",
          color: "#dc2626",
        },
      });

      // Focus on the trip allowance input
      const tripAllowanceInput = document.querySelector(
        'input[placeholder="3000000"]'
      ) as HTMLInputElement;
      if (tripAllowanceInput) {
        tripAllowanceInput.focus();
        tripAllowanceInput.style.borderColor = "#dc2626";
        setTimeout(() => {
          tripAllowanceInput.style.borderColor = "";
        }, 3000);
      }
      return;
    }

    // 🎯 MODERN CONFIRMATION
    showConfirmToast(
      `Create Big DO with ${
        sessionData.delivery_orders.length
      } delivery orders for ${formatCurrency(
        parseFloat(formData.trip_allowance) +
          sessionData.session_totals.total_gaji
      )} total driver payment?`,
      () => proceedWithFinalization(),
      {
        confirmText: "🚛 Create Big DO",
        cancelText: "Review Again",
        type: "info",
      }
    );
  };

  const proceedWithFinalization = async () => {
    try {
      setCreating(true);

      // Show loading toast
      const loadingToast = toast.loading("Creating Big Delivery Order...", {
        style: {
          borderRadius: "10px",
          background: "#f3f4f6",
          color: "#374151",
        },
      });

      const response = await apiClient.post(
        "/delivery-orders/finalize-big-do",
        {
          session_id: sessionId,
          trip_allowance: parseFloat(formData.trip_allowance),
          notes: formData.notes,
        }
      );

      const bigDOData = response.data.data;

      // Dismiss loading toast
      toast.dismiss(loadingToast);

      // Show success toast
      toast.success(
        `🎉 Big DO ${bigDOData.big_do.big_do_number} created successfully!`,
        {
          duration: 5000,
          style: {
            borderRadius: "10px",
            background: "#f0fdf4",
            color: "#166534",
            border: "1px solid #bbf7d0",
          },
        }
      );

      // Redirect to Big DO details
      navigate(`/big-delivery-orders/${bigDOData.big_do.id}`, {
        state: {
          message: `Big DO ${bigDOData.big_do.big_do_number} created successfully with ${bigDOData.individual_dos} delivery orders!`,
        },
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create Big DO", {
        icon: "❌",
        duration: 6000,
        style: {
          borderRadius: "10px",
          background: "#fef2f2",
          color: "#dc2626",
          border: "1px solid #fecaca",
        },
      });
    } finally {
      setCreating(false);
    }
  };

  // 🎯 ENHANCED: Modern session cancellation
  const handleCancelSession = async () => {
    showConfirmToast(
      "Cancel Big DO session? All DOs will return to individual assigned status and this session will be permanently deleted.",
      () => proceedWithCancellation(),
      {
        confirmText: "🗑️ Cancel Session",
        cancelText: "Keep Session",
        type: "danger",
      }
    );
  };

  const proceedWithCancellation = async () => {
    try {
      const loadingToast = toast.loading("Cancelling session...", {
        style: { borderRadius: "10px" },
      });

      await apiClient.delete(`/delivery-orders/big-do-session/${sessionId}`);

      toast.dismiss(loadingToast);
      toast.success("Big DO session cancelled successfully", {
        icon: "✅",
        duration: 3000,
      });

      navigate("/delivery-orders", {
        state: { message: "Big DO session cancelled successfully" },
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to cancel session", {
        icon: "❌",
        duration: 5000,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">
            Session Error
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate("/delivery-orders")}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Delivery Orders
          </button>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold text-yellow-600 mb-4">
            Loading Session...
          </h2>
          <p className="text-gray-600">Initializing Big DO session...</p>
        </div>
      </div>
    );
  }

  const activeDO = sessionData.delivery_orders.find(
    (dOrder) => dOrder.id === activeId
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                🚛 Create Big Delivery Order
              </h1>
              <p className="text-purple-100 mt-2">
                Optimize logistics by grouping multiple deliveries into a single
                trip
              </p>
              {/* 🎯 NEW: Show current status */}
              {sessionData.delivery_orders.length === 1 && (
                <div className="mt-3 bg-yellow-500/20 border border-yellow-300 rounded-lg p-3">
                  <p className="text-yellow-100 text-sm">
                    ⚠️ You need at least 2 DOs to create a Big DO. Add more DOs
                    below!
                  </p>
                </div>
              )}
            </div>

            <div className="text-right text-white">
              <div className="text-sm text-purple-100">Session ID</div>
              <div className="font-mono text-lg">{sessionData.session_id}</div>
            </div>
          </div>

          {/* Session Summary Cards - Update to show current status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div
              className={`rounded-lg p-4 ${
                sessionData.session_totals.total_dos >= 2
                  ? "bg-white/10"
                  : "bg-yellow-500/20 border border-yellow-400"
              }`}
            >
              <div className="text-white">
                <div className="text-2xl font-bold">
                  {sessionData.session_totals.total_dos}
                  {sessionData.session_totals.total_dos >= 2 && (
                    <span className="text-green-300 ml-1">✓</span>
                  )}
                </div>
                <div className="text-purple-100 text-sm">
                  Delivery Orders{" "}
                  {sessionData.session_totals.total_dos < 2 && "(Need 2+)"}
                </div>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-white">
                <div className="text-2xl font-bold">
                  {formatCurrency(sessionData.session_totals.total_revenue)}
                </div>
                <div className="text-purple-100 text-sm">Total Revenue</div>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-white">
                <div className="text-2xl font-bold">
                  {formatCurrency(sessionData.session_totals.total_gaji)}
                </div>
                <div className="text-purple-100 text-sm">Total Gaji</div>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-white">
                <div className="text-2xl font-bold">
                  {formatCurrency(sessionData.session_totals.total_ongkosan)}
                </div>
                <div className="text-purple-100 text-sm">Total Ongkosan</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Driver & Vehicle Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Assignment Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">Driver</div>
                <div className="font-medium text-gray-900">
                  {sessionData.driver_info}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">Vehicle</div>
                <div className="font-medium text-gray-900">
                  {sessionData.vehicle_info}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 🎯 DND KIT DRAG-AND-DROP DO LIST */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Delivery Orders ({sessionData.delivery_orders.length})
                {sessionData.delivery_orders.length < 2 && (
                  <span className="text-sm text-yellow-600 ml-2">
                    ⚠️ Need {2 - sessionData.delivery_orders.length} more
                  </span>
                )}
              </h3>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
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
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                  />
                </svg>
                Drag to reorder (for visual organization only)
              </div>
            </div>
          </div>

          <div className="p-6">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sessionData.delivery_orders.map((dOrder) => dOrder.id)}
                strategy={verticalListSortingStrategy}
              >
                {sessionData.delivery_orders.map((dOrder, index) => (
                  <SortableDOItem
                    key={dOrder.id}
                    dOrder={dOrder}
                    index={index}
                    onRemove={handleRemoveDO}
                    canRemove={sessionData.delivery_orders.length > 1}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </SortableContext>

              <DragOverlay>
                <DragOverlayComponent
                  dOrder={activeDO || null}
                  formatCurrency={formatCurrency}
                />
              </DragOverlay>
            </DndContext>

            {/* 🎯 ENHANCED: Add More Button with better messaging */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                sessionData.delivery_orders.length < 2
                  ? "border-yellow-400 bg-yellow-50 hover:border-yellow-500"
                  : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
              }`}
            >
              <button
                data-add-do-button // 🎯 ADD: For scroll targeting
                onClick={handleAddAnotherDO}
                disabled={addingDO}
                className="inline-flex items-center space-x-3 text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    sessionData.delivery_orders.length < 2
                      ? "bg-yellow-100 text-yellow-600"
                      : "bg-green-100 text-green-600"
                  }`}
                >
                  <svg
                    className="w-6 h-6"
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
                </div>
                <div className="text-left">
                  <div className="font-medium text-lg">
                    {sessionData.delivery_orders.length < 2
                      ? "⚠️ Add Another Delivery Order (Required)"
                      : "Add Another Delivery Order"}
                  </div>
                  <div className="text-sm text-gray-500">
                    Same driver: {sessionData.driver_info} | Same vehicle:{" "}
                    {sessionData.vehicle_info}
                  </div>
                  {sessionData.delivery_orders.length < 2 && (
                    <div className="text-xs text-yellow-600 mt-1">
                      You need at least 2 DOs to create a Big DO
                    </div>
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Rest of the form components remain the same... */}

        {/* 🎯 Driver Freedom Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
          <div className="flex items-start space-x-3">
            <svg
              className="w-6 h-6 text-yellow-600 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-yellow-800">
                Driver Has Complete Freedom
              </h4>
              <p className="text-xs text-yellow-700 mt-1">
                This sequence is for admin organization only. Drivers will
                receive all deliveries and can complete them in any order they
                prefer based on traffic, timing, or route efficiency.
              </p>
            </div>
          </div>
        </div>

        {/* 🎯 ENHANCED: Action Buttons with Modern Interactions */}
        <div className="bg-white shadow-lg rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">
            Finalize Big Delivery Order
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trip Allowance <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  Rp
                </span>
                <input
                  type="number"
                  value={formData.trip_allowance}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      trip_allowance: e.target.value,
                    }))
                  }
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="3000000"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Single trip allowance for the entire Big DO (replaces individual
                trip allowances)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                rows={4}
                placeholder="Big DO creation notes, special instructions, route optimization notes..."
              />
            </div>
          </div>

          {/* Financial Preview */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-3">
              Financial Summary Preview
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Trip Allowance:</span>
                <div className="font-semibold text-blue-600">
                  {formData.trip_allowance
                    ? formatCurrency(parseFloat(formData.trip_allowance))
                    : "Not set"}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Total Gaji:</span>
                <div className="font-semibold text-green-600">
                  {formatCurrency(sessionData.session_totals.total_gaji)}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Total for Driver:</span>
                <div className="font-semibold text-purple-600">
                  {formData.trip_allowance
                    ? formatCurrency(
                        parseFloat(formData.trip_allowance) +
                          sessionData.session_totals.total_gaji
                      )
                    : "Calculate after trip allowance"}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Total Revenue:</span>
                <div className="font-semibold text-indigo-600">
                  {formatCurrency(sessionData.session_totals.total_revenue)}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 sm:space-x-4 mt-8">
            <button
              onClick={handleCancelSession}
              className="w-full sm:w-auto px-6 py-3 border-2 border-red-300 text-red-700 rounded-lg hover:bg-red-50 hover:border-red-400 font-medium transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <span>🗑️ Cancel Session</span>
            </button>

            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              <button
                onClick={() => {
                  toast.success(
                    "Session saved! You can return to continue later."
                  );
                  navigate("/delivery-orders");
                }}
                className="w-full sm:w-auto px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                💾 Save Session & Exit
              </button>

              <button
                onClick={handleFinalizeBigDO}
                disabled={
                  creating ||
                  sessionData.delivery_orders.length < 2 ||
                  !formData.trip_allowance
                }
                className={`w-full sm:w-auto px-8 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 ${
                  sessionData.delivery_orders.length < 2
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white transform hover:scale-105"
                } ${creating ? "animate-pulse" : ""}`}
                title={
                  sessionData.delivery_orders.length < 2
                    ? `Need ${2 - sessionData.delivery_orders.length} more DOs`
                    : ""
                }
              >
                {creating ? (
                  <>
                    <svg
                      className="animate-spin w-5 h-5"
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
                    <span>Creating Big DO...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    <span>
                      {sessionData.delivery_orders.length < 2
                        ? `🚛 Need ${
                            2 - sessionData.delivery_orders.length
                          } More DOs`
                        : `🚛 Create Big DO (${sessionData.delivery_orders.length} DOs)`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateBigDOPage;
