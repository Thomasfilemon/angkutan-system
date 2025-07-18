// src/pages/DeliveryOrderCreatePage.tsx
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../api/axiosConfig";
import { toast } from "react-hot-toast";

interface PurchaseOrder {
  id: number;
  po_number: string;
  customer_name: string;
  item_name: string;
  unit: string;
  unit_price: number;
  total_quantity: number;
  remaining_quantity: number;
  can_create_do: boolean;
  status: string;
  load_location?: string;
  unload_location?: string;
}

interface Driver {
  id: number;
  username: string;
  driverProfile?: {
    full_name: string;
    phone: string;
    status: string;
  };
}

interface Vehicle {
  capacity: number | null;
  id: number;
  license_plate: string;
  type: string;
  status: string;
  driver_id: number | null;
  driver_name: string | null;
  driver_phone: string | null;
  driver_status: string | null;
  driver?: {
    // ✅ ADD: Full driver object
    id: number;
    username: string;
    driverProfile?: {
      full_name: string;
      phone: string;
      status: string;
    };
  };
}

const DeliveryOrderCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get("return") || "/delivery-orders";

  const [loading, setLoading] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [formData, setFormData] = useState({
    do_name: "", // New field
    purchase_order_id: "",
    driver_id: "",
    vehicle_id: "",
    customer_name: "",
    item_name: "",
    minimal_load_quantity: 0,
    unit: "ton",
    unit_price: 0,
    trip_allowance: "",
    gaji: "",
    ongkosan: 0,
    load_location: "",
    unload_location: "",
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  // ✅ ADD: Auto-fill driver when vehicle is selected
  useEffect(() => {
    if (formData.vehicle_id) {
      const selectedVehicle = vehicles.find(
        (v) => v.id.toString() === formData.vehicle_id
      );
      if (selectedVehicle && selectedVehicle.driver_id) {
        // Auto-fill driver from vehicle
        setFormData((prev) => ({
          ...prev,
          driver_id:
            selectedVehicle.driver_id !== null
              ? selectedVehicle.driver_id.toString()
              : "",
        }));
      } else {
        // Clear driver if vehicle has no assigned driver
        setFormData((prev) => ({
          ...prev,
          driver_id: "",
        }));
      }
    } else {
      // Clear driver when no vehicle selected
      setFormData((prev) => ({
        ...prev,
        driver_id: "",
      }));
    }
  }, [formData.vehicle_id, vehicles]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [poResponse, driverResponse, vehicleResponse] = await Promise.all([
        apiClient.get("/purchase-orders", {
          params: {
            status: ["confirmed", "partial"]
          }
        }),
        apiClient.get("/drivers"),
        apiClient.get("/vehicles"),
      ]);

      // Filter POs
      const allPOs = poResponse.data || [];
      const availablePOs = allPOs.filter(
        (po: PurchaseOrder) =>
          po.can_create_do === true &&
          po.remaining_quantity > 0 &&
          po.status !== "completed"
      );

      setPurchaseOrders(availablePOs);
      setDrivers(driverResponse.data || []);

      // ✅ UPDATE: Keep all available vehicles (with or without drivers)
      const vehicleData = vehicleResponse.data || [];
      const availableVehicles = vehicleData.filter(
        (v: Vehicle) => v.status === "available" // Keep all available vehicles
      );

      setVehicles(availableVehicles);
    } catch (err) {
      toast.error("Failed to fetch initial data");
    } finally {
      setLoading(false);
    }
  };

  const handlePOChange = (poId: string) => {
    if (!poId) {
      // Reset to standalone mode
      setFormData((prev) => ({
        ...prev,
        purchase_order_id: "",
        customer_name: "",
        item_name: "",
        unit: "ton",
        unit_price: 0,
        load_location: "",
        unload_location: "",
      }));
      return;
    }

    const selectedPO = purchaseOrders.find((po) => po.id.toString() === poId);
    if (selectedPO) {
      setFormData((prev) => ({
        ...prev,
        purchase_order_id: poId,
        customer_name: selectedPO.customer_name,
        item_name: selectedPO.item_name,
        unit: selectedPO.unit,
        unit_price: selectedPO.unit_price,
        load_location: selectedPO.load_location || "",
        unload_location: selectedPO.unload_location || "",
      }));
    }
  };

  const calculateTotalAmount = (
    quantity: number,
    unitPrice: number,
    unit: string
  ): number => {
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

  const calculateOngkosan = (): number => {
    const totalRevenue = calculateTotalAmount(
      formData.minimal_load_quantity,
      formData.unit_price,
      formData.unit
    );
    // ✅ FIX: Parse string inputs properly
    const tripAllowance = parseFloat(formData.trip_allowance) || 0;
    const gaji = parseFloat(formData.gaji) || 0;
    const operationalCosts = tripAllowance + gaji;

    return Math.max(0, totalRevenue - operationalCosts); // Prevent negative ongkosan
  };

  // Auto-calculate ongkosan
  useEffect(() => {
    // Calculate ongkosan whenever any relevant field changes
    const ongkosan = calculateOngkosan();
    setFormData((prev) => ({ ...prev, ongkosan }));
  }, [
    formData.minimal_load_quantity,
    formData.unit_price,
    formData.trip_allowance, // Now string, will be parsed in calculateOngkosan
    formData.gaji, // Now string, will be parsed in calculateOngkosan
    formData.unit,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.do_name.trim()) {
      toast.error("Please enter a delivery order name");
      return;
    }

    if (
      !formData.driver_id ||
      !formData.vehicle_id ||
      !formData.minimal_load_quantity
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);

      const totalAmount = calculateTotalAmount(
        formData.minimal_load_quantity,
        formData.unit_price,
        formData.unit
      );

      const payload = {
        do_name: formData.do_name.trim(),
        purchase_order_id: formData.purchase_order_id || null,
        driver_id: parseInt(formData.driver_id),
        vehicle_id: parseInt(formData.vehicle_id),
        customer_name: formData.customer_name,
        item_name: formData.item_name,
        minimal_load_quantity: formData.minimal_load_quantity,
        unit: formData.unit,
        unit_price: formData.unit_price,
        total_amount: totalAmount,
        trip_allowance: parseFloat(formData.trip_allowance) || 0,
        gaji: parseFloat(formData.gaji) || 0,
        ongkosan: formData.ongkosan,
        load_location: formData.load_location,
        unload_location: formData.unload_location,
        payment_status: "proses_tagihan",
        status: "assigned",
      };

      const response = await apiClient.post("/delivery-orders", payload);

      toast.success("Delivery Order created successfully!");
      navigate(returnUrl);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to create Delivery Order"
      );
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString("id-ID")}`;
  };

  const getUnitDisplay = (unit: string) => {
    const unitMap = { kilogram: "kg", ton: "ton", kubik: "m³" };
    return unitMap[unit as keyof typeof unitMap] || unit;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Create Delivery Order
          </h1>
          <p className="text-gray-600">
            {returnUrl.includes("big-dos")
              ? "Create a DO for your Big Delivery Order"
              : "Create a new delivery order"}
          </p>
        </div>
        <button
          onClick={() => navigate(returnUrl)}
          className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
        >
          ← Back
        </button>
      </div>

      {/* Quick Creation Notice */}
      {returnUrl.includes("big-dos") && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <svg
              className="w-5 h-5 text-blue-500"
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
            <div>
              <h3 className="text-sm font-medium text-blue-900">
                Quick DO Creation
              </h3>
              <p className="text-sm text-blue-700">
                This DO will be available for your Big DO creation. Fill in the
                essential details below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow rounded-lg p-6 space-y-6"
      >
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Delivery Order Name *
          </label>
          <input
            type="text"
            value={formData.do_name}
            onChange={(e) => 
              setFormData({ ...formData, do_name: e.target.value })
            }
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            placeholder="e.g., Pengiriman Pasir ke Proyek XYZ"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Give a descriptive name for this delivery order
          </p>
        </div>
        {/* PO Selection (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Purchase Order (Optional)
          </label>
          <select
            value={formData.purchase_order_id}
            onChange={(e) => handlePOChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">🆕 Create Standalone DO</option>
            {purchaseOrders.map((po) => (
              <option key={po.id} value={po.id}>
                📋 {po.po_number} - {po.customer_name}
                {/* ✅ ADD: Show remaining quantity */}
                (Sisa: {po.remaining_quantity.toLocaleString("id-ID")}{" "}
                {getUnitDisplay(po.unit)})
              </option>
            ))}
          </select>

          {/* ✅ ADD: Show selected PO details */}
          {formData.purchase_order_id && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              {(() => {
                const selectedPO = purchaseOrders.find(
                  (po) => po.id.toString() === formData.purchase_order_id
                );
                return selectedPO ? (
                  <div className="text-sm">
                    <div className="font-medium text-blue-900 mb-1">
                      📋 {selectedPO.po_number}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-blue-700">
                      <div>
                        <span className="text-blue-600">Total Quantity:</span>
                        <span className="font-medium ml-1">
                          {selectedPO.total_quantity.toLocaleString("id-ID")}{" "}
                          {getUnitDisplay(selectedPO.unit)}
                        </span>
                      </div>
                      <div>
                        <span className="text-blue-600">Remaining:</span>
                        <span className="font-medium ml-1 text-green-700">
                          {selectedPO.remaining_quantity.toLocaleString(
                            "id-ID"
                          )}{" "}
                          {getUnitDisplay(selectedPO.unit)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          <p className="text-xs text-gray-500 mt-1">
            {formData.purchase_order_id
              ? "Linked to PO - customer and item details will be auto-filled"
              : "Standalone DO - you can enter custom details"}
          </p>
        </div>

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Name *
            </label>
            <input
              type="text"
              value={formData.customer_name}
              onChange={(e) =>
                setFormData({ ...formData, customer_name: e.target.value })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Enter customer name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Name *
            </label>
            <input
              type="text"
              value={formData.item_name}
              onChange={(e) =>
                setFormData({ ...formData, item_name: e.target.value })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Enter item name"
              required
            />
          </div>
        </div>

        {/* Quantity & Pricing */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity *{/* ✅ ADD: Show max available */}
              {formData.purchase_order_id &&
                (() => {
                  const selectedPO = purchaseOrders.find(
                    (po) => po.id.toString() === formData.purchase_order_id
                  );
                  return selectedPO ? (
                    <span className="text-blue-600 text-xs ml-1">
                      (Max:{" "}
                      {selectedPO.remaining_quantity.toLocaleString("id-ID")}{" "}
                      {getUnitDisplay(selectedPO.unit)})
                    </span>
                  ) : null;
                })()}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              // ✅ ADD: Max validation for PO-linked DOs
              max={(() => {
                if (formData.purchase_order_id) {
                  const selectedPO = purchaseOrders.find(
                    (po) => po.id.toString() === formData.purchase_order_id
                  );
                  return selectedPO ? selectedPO.remaining_quantity : undefined;
                }
                return undefined;
              })()}
              value={formData.minimal_load_quantity}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                // ✅ ADD: Validate against remaining quantity
                if (formData.purchase_order_id) {
                  const selectedPO = purchaseOrders.find(
                    (po) => po.id.toString() === formData.purchase_order_id
                  );
                  if (selectedPO && value > selectedPO.remaining_quantity) {
                    toast.error(
                      `Quantity cannot exceed remaining PO quantity: ${
                        selectedPO.remaining_quantity
                      } ${getUnitDisplay(selectedPO.unit)}`
                    );
                    return;
                  }
                }
                setFormData({
                  ...formData,
                  minimal_load_quantity: value,
                });
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="0"
              required
            />
            {/* ✅ ADD: Validation warning */}
            {formData.purchase_order_id &&
              formData.minimal_load_quantity > 0 &&
              (() => {
                const selectedPO = purchaseOrders.find(
                  (po) => po.id.toString() === formData.purchase_order_id
                );
                if (
                  selectedPO &&
                  formData.minimal_load_quantity > selectedPO.remaining_quantity
                ) {
                  return (
                    <p className="text-xs text-red-600 mt-1">
                      ⚠️ Exceeds remaining quantity by{" "}
                      {(
                        formData.minimal_load_quantity -
                        selectedPO.remaining_quantity
                      ).toLocaleString("id-ID")}{" "}
                      {getUnitDisplay(selectedPO.unit)}
                    </p>
                  );
                }
                return null;
              })()}
          </div>

          {/* Rest of the quantity section remains the same */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit *
            </label>
            <select
              value={formData.unit}
              onChange={(e) =>
                setFormData({ ...formData, unit: e.target.value })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={!!formData.purchase_order_id}
            >
              <option value="kilogram">Kilogram (kg)</option>
              <option value="ton">Ton</option>
              <option value="kubik">Kubik (m³)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit Price *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.unit_price}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  unit_price: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="0"
              required
              disabled={!!formData.purchase_order_id}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Amount
            </label>
            <div className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-gray-700 font-medium">
              {formatCurrency(
                calculateTotalAmount(
                  formData.minimal_load_quantity,
                  formData.unit_price,
                  formData.unit
                )
              )}
            </div>
          </div>
        </div>

        {/* Driver & Vehicle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle *
              <span className="text-xs text-gray-500 ml-1">
                (Driver will be auto-filled)
              </span>
            </label>
            <select
              value={formData.vehicle_id}
              onChange={(e) =>
                setFormData({ ...formData, vehicle_id: e.target.value })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              <option value="">Select a vehicle</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  🚛 {vehicle.license_plate} ({vehicle.type})
                  {/* ✅ ADD: Show driver info in dropdown */}
                  {vehicle.driver_name
                    ? ` - 👨‍💼 ${vehicle.driver_name}`
                    : " - No Driver Assigned"}
                </option>
              ))}
            </select>

            {/* ✅ ADD: Show selected vehicle info */}
            {formData.vehicle_id &&
              (() => {
                const selectedVehicle = vehicles.find(
                  (v) => v.id.toString() === formData.vehicle_id
                );
                return selectedVehicle ? (
                  <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900 mb-1">
                        🚛 {selectedVehicle.license_plate} -{" "}
                        {selectedVehicle.type}
                      </div>
                      <div className="text-gray-600">
                        <span>Capacity: {selectedVehicle.capacity} kg</span>
                        {selectedVehicle.driver_name && (
                          <span className="ml-3">
                            👨‍💼 Driver: {selectedVehicle.driver_name}
                          </span>
                        )}
                      </div>
                      {!selectedVehicle.driver_id && (
                        <div className="text-amber-600 text-xs mt-1">
                          ⚠️ This vehicle has no assigned driver. Please select
                          a driver manually.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null;
              })()}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Driver *
              {formData.vehicle_id &&
                (() => {
                  const selectedVehicle = vehicles.find(
                    (v) => v.id.toString() === formData.vehicle_id
                  );
                  return selectedVehicle?.driver_id ? (
                    <span className="text-xs text-green-600 ml-1">
                      (Auto-filled from vehicle)
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 ml-1">
                      (Select manually)
                    </span>
                  );
                })()}
            </label>
            <select
              value={formData.driver_id}
              onChange={(e) =>
                setFormData({ ...formData, driver_id: e.target.value })
              }
              className={`w-full border border-gray-300 rounded-md px-3 py-2 ${
                formData.vehicle_id &&
                vehicles.find((v) => v.id.toString() === formData.vehicle_id)
                  ?.driver_id
                  ? "bg-green-50 border-green-300"
                  : ""
              }`}
              disabled={(() => {
                // ✅ ADD: Disable if vehicle has assigned driver
                if (formData.vehicle_id) {
                  const selectedVehicle = vehicles.find(
                    (v) => v.id.toString() === formData.vehicle_id
                  );
                  return selectedVehicle?.driver_id ? true : false;
                }
                return true;
              })()}
              required
            >
              <option value="">
                {formData.vehicle_id &&
                vehicles.find((v) => v.id.toString() === formData.vehicle_id)
                  ?.driver_id
                  ? "Driver auto-selected from vehicle"
                  : "Pilih Mobil Dahulu"}
              </option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  👨‍💼 {driver.driverProfile?.full_name || driver.username}
                </option>
              ))}
            </select>

            {/* ✅ ADD: Show selected driver info */}
            {formData.driver_id &&
              (() => {
                const selectedDriver = drivers.find(
                  (d) => d.id.toString() === formData.driver_id
                );
                const selectedVehicle = vehicles.find(
                  (v) => v.id.toString() === formData.vehicle_id
                );

                // Show info from vehicle data if auto-filled, otherwise from drivers data
                const driverInfo =
                  selectedVehicle?.driver_id === parseInt(formData.driver_id) &&
                  selectedVehicle.driver_name
                    ? {
                        name: selectedVehicle.driver_name,
                        phone: selectedVehicle.driver_phone,
                        status: selectedVehicle.driver_status,
                      }
                    : selectedDriver && {
                        name:
                          selectedDriver.driverProfile?.full_name ||
                          selectedDriver.username,
                        phone: selectedDriver.driverProfile?.phone,
                        status: selectedDriver.driverProfile?.status,
                      };

                return driverInfo ? (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="text-sm">
                      <div className="font-medium text-green-900 mb-1">
                        👨‍💼 {driverInfo.name}
                      </div>
                      <div className="text-green-700 text-xs">
                        {driverInfo.phone && <div>📞 {driverInfo.phone}</div>}
                        {driverInfo.status && (
                          <div className="mt-1">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                driverInfo.status === "available"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {driverInfo.status === "available"
                                ? "✅ Available"
                                : "❌ Unavailable"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}
          </div>
        </div>

        {/* Financial Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Uang Jalan
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={formData.trip_allowance}
              onChange={(e) => {
                // ✅ FIX: Keep as string, let user type naturally
                const value = e.target.value;
                setFormData({
                  ...formData,
                  trip_allowance: value,
                });
              }}
              onBlur={(e) => {
                // ✅ FIX: Clean up on blur (when user clicks away)
                const numValue = parseFloat(e.target.value) || 0;
                setFormData({
                  ...formData,
                  trip_allowance: numValue.toString(),
                });
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gaji Driver
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={formData.gaji}
              onChange={(e) => {
                // ✅ FIX: Keep as string, let user type naturally
                const value = e.target.value;
                setFormData({
                  ...formData,
                  gaji: value,
                });
              }}
              onBlur={(e) => {
                // ✅ FIX: Clean up on blur (when user clicks away)
                const numValue = parseFloat(e.target.value) || 0;
                setFormData({
                  ...formData,
                  gaji: numValue.toString(),
                });
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ongkosan (Auto-calculated)
            </label>
            <div className="w-full border border-gray-300 rounded-md px-3 py-2 bg-green-50 text-green-700 font-medium">
              {formatCurrency(formData.ongkosan)}
            </div>
            {/* ✅ ADD: Show calculation breakdown */}
            {(formData.trip_allowance || formData.gaji) && (
              <div className="text-xs text-gray-500 mt-1">
                Revenue:{" "}
                {formatCurrency(
                  calculateTotalAmount(
                    formData.minimal_load_quantity,
                    formData.unit_price,
                    formData.unit
                  )
                )}{" "}
                - Costs:{" "}
                {formatCurrency(
                  (parseFloat(formData.trip_allowance) || 0) +
                    (parseFloat(formData.gaji) || 0)
                )}
              </div>
            )}
          </div>
        </div>

        {/* Locations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Load Location *
            </label>
            <textarea
              value={formData.load_location}
              onChange={(e) =>
                setFormData({ ...formData, load_location: e.target.value })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={2}
              placeholder="Enter pickup address"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unload Location *
            </label>
            <textarea
              value={formData.unload_location}
              onChange={(e) =>
                setFormData({ ...formData, unload_location: e.target.value })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={2}
              placeholder="Enter delivery address"
              required
            />
          </div>
        </div>

        {/* Revenue Summary */}
        {formData.minimal_load_quantity > 0 && formData.unit_price > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">
              📊 Financial Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Revenue:</span>
                <div className="font-medium text-green-600">
                  {formatCurrency(
                    calculateTotalAmount(
                      formData.minimal_load_quantity,
                      formData.unit_price,
                      formData.unit
                    )
                  )}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Driver Costs:</span>
                <div className="font-medium text-orange-600">
                  {formatCurrency(
                    parseFloat(formData.trip_allowance + formData.gaji)
                  )}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Net Profit:</span>
                <div className="font-medium text-blue-600">
                  {formatCurrency(formData.ongkosan)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate(returnUrl)}
            className="px-6 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "🚀 Create Delivery Order"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DeliveryOrderCreatePage;
