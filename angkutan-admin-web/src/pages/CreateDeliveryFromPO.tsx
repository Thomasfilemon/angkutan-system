// src/pages/CreateDeliveryFromPO.tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import apiClient from "../api/axiosConfig";
import { GeoSearchControl, OpenStreetMapProvider } from "leaflet-geosearch";
import "leaflet-geosearch/dist/geosearch.css";

const DefaultIcon = L.Icon.Default as any;
DefaultIcon.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

// Custom icons for load/unload locations
const loadIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const unloadIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// --- UPDATED Interfaces ---
interface PODetails {
  id: number;
  po_number: string;
  customer_name: string;
  item_name: string;
  unit: string; // 🎯 NEW: Add unit field
  unit_price: number;
  total_quantity: number;
  delivered_quantity: number;
  remaining_quantity: number;
  load_location: string;
  unload_location: string;
  load_latitude?: number;
  load_longitude?: number;
  unload_latitude?: number;
  unload_longitude?: number;
}

interface Vehicle {
  id: number;
  license_plate: string;
  type: string;
  capacity: string;
  status: string;
  driver_id: number | null;
  driver_name: string | null;
  driver_phone: string | null;
  driver_status: string | null;
}

interface LocationMarker {
  lat: number;
  lng: number;
  type: "load" | "unload";
  title: string;
}

// --- Search Component using leaflet-geosearch ---
const SearchControlComponent = ({
  onLocationFound,
}: {
  onLocationFound: (lat: number, lng: number, label: string) => void;
}) => {
  const map = useMap();

  useEffect(() => {
    const provider = new OpenStreetMapProvider();
    const searchControl = new (GeoSearchControl as any)({
      provider: provider,
      style: "bar",
      showMarker: false,
      autoClose: true,
      keepResult: true,
    });

    const onShowLocation = (e: any) => {
      onLocationFound(e.location.y, e.location.x, e.location.label);
    };

    map.addControl(searchControl);
    map.on("geosearch/showlocation", onShowLocation);

    return () => {
      map.removeControl(searchControl);
      map.off("geosearch/showlocation", onShowLocation);
    };
  }, [map, onLocationFound]);

  return null;
};

const CreateDeliveryFromPO: React.FC = () => {
  const { poId } = useParams<{ poId: string }>();
  const navigate = useNavigate();
  const [poDetails, setPODetails] = useState<PODetails | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [markers, setMarkers] = useState<LocationMarker[]>([]);
  const [selectedLocationType, setSelectedLocationType] = useState<
    "load" | "unload" | null
  >(null);

  const [formData, setFormData] = useState({
    vehicle_id: "",
    minimal_load_quantity: "",
    trip_allowance: "",
    gaji: "",
    ongkosan: "",
    load_location: "",
    unload_location: "",
    load_latitude: "",
    load_longitude: "",
    unload_latitude: "",
    unload_longitude: "",
  });

  const [linkProcessing, setLinkProcessing] = useState<{ load: boolean; unload: boolean }>({ load: false, unload: false });

  const defaultCenter = { lat: -6.2088, lng: 106.8456 };

  // 🎯 NEW: Unit display helper
  const getUnitDisplay = (unit: string) => {
    const unitMap = {
      kilogram: "kg",
      ton: "ton",
      kubik: "m³",
    };
    return unitMap[unit as keyof typeof unitMap] || unit;
  };

  // 🎯 NEW: Unit-aware calculation
  const calculateTotalAmount = (
    quantity: number,
    unitPrice: number,
    unit: string
  ) => {
    switch (unit) {
      case "kilogram":
        return quantity * unitPrice;
      case "ton":
        return quantity * 1000 * unitPrice; // Convert ton to kg
      case "kubik":
        return quantity * unitPrice; // Direct kubik pricing
      default:
        return quantity * unitPrice;
    }
  };

  // 🎯 ENHANCED: Unit-aware ongkosan calculation
  const calculateOngkosan = (): number => {
    if (
      !poDetails?.unit_price ||
      !formData.minimal_load_quantity ||
      !poDetails?.unit
    )
      return 0;

    const quantity = parseFloat(formData.minimal_load_quantity);
    const totalRevenue = calculateTotalAmount(
      quantity,
      poDetails.unit_price,
      poDetails.unit
    );
    const operationalCosts =
      (parseFloat(formData.trip_allowance) || 0) +
      (parseFloat(formData.gaji) || 0);

    return totalRevenue - operationalCosts;
  };

  useEffect(() => {
    if (poId) {
      fetchPODetails();
      fetchAvailableVehicles();
    }
  }, [poId]);

  const fetchPODetails = async (): Promise<void> => {
    try {
      const response = await apiClient.get(`/purchase-orders/${poId}`);
      const details = response.data.data || response.data;

      // 🎯 NEW: Ensure unit field exists with fallback
      if (!details.unit) {
        console.warn('PO data missing unit field, defaulting to "ton"');
        details.unit = "ton";
      }

      setPODetails(details);
      setFormData((prev) => ({
        ...prev,
        load_location: details.load_location || "",
        unload_location: details.unload_location || "",
        load_latitude: details.load_latitude?.toString() || "",
        load_longitude: details.load_longitude?.toString() || "",
        unload_latitude: details.unload_latitude?.toString() || "",
        unload_longitude: details.unload_longitude?.toString() || "",
      }));

      const initialMarkers: LocationMarker[] = [];
      if (details.load_latitude && details.load_longitude)
        initialMarkers.push({
          lat: details.load_latitude,
          lng: details.load_longitude,
          type: "load",
          title: "Load Location",
        });
      if (details.unload_latitude && details.unload_longitude)
        initialMarkers.push({
          lat: details.unload_latitude,
          lng: details.unload_longitude,
          type: "unload",
          title: "Unload Location",
        });
      setMarkers(initialMarkers);
    } catch (err) {
      console.error("Error fetching PO details:", err);
      setError("Failed to fetch purchase order details.");
    }
  };

  const fetchAvailableVehicles = async (): Promise<void> => {
    try {
      const response = await apiClient.get("/vehicles");
      const vehiclesData = response.data.data || response.data || [];
      setVehicles(
        vehiclesData.filter(
          (v: Vehicle) =>
            v.driver_id &&
            v.driver_status === "available" &&
            v.status === "available"
        )
      );
    } catch (err) {
      console.error("Error fetching vehicles:", err);
      setError("Failed to fetch available vehicles.");
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ): void => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const setLocation = (lat: number, lng: number, address: string) => {
    if (!selectedLocationType) return;
    if (selectedLocationType === "load")
      setFormData((prev) => ({
        ...prev,
        load_location: address,
        load_latitude: lat.toString(),
        load_longitude: lng.toString(),
      }));
    else
      setFormData((prev) => ({
        ...prev,
        unload_location: address,
        unload_latitude: lat.toString(),
        unload_longitude: lng.toString(),
      }));
    setMarkers((prev) => [
      ...prev.filter((m) => m.type !== selectedLocationType),
      {
        lat,
        lng,
        type: selectedLocationType,
        title: `${
          selectedLocationType.charAt(0).toUpperCase() +
          selectedLocationType.slice(1)
        } Location`,
      },
    ]);
    setSelectedLocationType(null);
  };

  const handleMapClick = (e: L.LeafletMouseEvent) => {
    if (!selectedLocationType) return;
    const { lat, lng } = e.latlng;
    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    )
      .then((res) => res.json())
      .then((data) =>
        setLocation(
          lat,
          lng,
          data.display_name || `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`
        )
      );
  };

  const handleSearchSelect = (lat: number, lng: number, label: string) => {
    if (!selectedLocationType) {
      alert(
        "Please select 'Set Load Location' or 'Set Unload Location' first."
      );
      return;
    }
    setLocation(lat, lng, label);
  };

  const getSelectedVehicle = (): Vehicle | undefined =>
    vehicles.find((v) => v.id.toString() === formData.vehicle_id);

  // 🎯 ENHANCED: Auto-calculate ongkosan with unit awareness
  useEffect(() => {
    const ongkosan = calculateOngkosan();
    if (ongkosan > 0)
      setFormData((prev) => ({ ...prev, ongkosan: ongkosan.toString() }));
  }, [
    formData.minimal_load_quantity,
    formData.trip_allowance,
    formData.gaji,
    poDetails?.unit_price,
    poDetails?.unit,
  ]);

  // 🎯 ENHANCED: Submit with unit support
  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const selectedVehicle = getSelectedVehicle();
      if (!selectedVehicle || !selectedVehicle.driver_id)
        throw new Error(
          "Please select a valid vehicle with an assigned driver."
        );

      const quantity = parseFloat(formData.minimal_load_quantity);
      const totalAmount =
        poDetails?.unit_price && poDetails?.unit
          ? calculateTotalAmount(quantity, poDetails.unit_price, poDetails.unit)
          : 0;

      const payload = {
        purchase_order_id: poDetails?.id,
        vehicle_id: parseInt(formData.vehicle_id),
        driver_id: selectedVehicle.driver_id,
        customer_name: poDetails?.customer_name,
        item_name: poDetails?.item_name,
        minimal_load_quantity: quantity,
        unit: poDetails?.unit, // 🎯 NEW: Include unit from PO
        unit_price: poDetails?.unit_price,
        total_amount: totalAmount,
        trip_allowance: parseFloat(formData.trip_allowance),
        gaji: parseFloat(formData.gaji),
        ongkosan: parseFloat(formData.ongkosan),
        load_location: formData.load_location || poDetails?.load_location,
        unload_location: formData.unload_location || poDetails?.unload_location,
        load_latitude: formData.load_latitude
          ? parseFloat(formData.load_latitude)
          : null,
        load_longitude: formData.load_longitude
          ? parseFloat(formData.load_longitude)
          : null,
        unload_latitude: formData.unload_latitude
          ? parseFloat(formData.unload_latitude)
          : null,
        unload_longitude: formData.unload_longitude
          ? parseFloat(formData.unload_longitude)
          : null,
        payment_status: "proses_tagihan",
        status: "assigned",
      };

      console.log("Creating DO with payload:", payload);

      await apiClient.post("/delivery-orders", payload);
      navigate("/delivery-orders");
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to create delivery order."
      );
    } finally {
      setLoading(false);
    }
  };

  const MapClickHandler = () => {
    useMapEvents({ click: handleMapClick });
    return null;
  };

  const handleProcessLocationLink = async (
    type: "load" | "unload",
    input: string
  ) => {
    setLinkProcessing((prev) => ({ ...prev, [type]: true }));

    try {
      const backendUrl = process.env.REACT_APP_API_URL || "";
      const resp = await fetch(`${backendUrl}/utils/resolve-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await resp.json();

      if (data.lat && data.lng) {
        setLocationWithType(
          data.lat,
          data.lng,
          `${data.lat},${data.lng}`,
          type
        );
      } else {
        alert(data.message || "Could not determine coordinates. Please check the input or enter coordinates manually.");
      }
    } catch (error) {
      alert('Could not process the location link. Please try again or enter coordinates manually.');
    } finally {
      setLinkProcessing((prev) => ({ ...prev, [type]: false }));
    }
  };

  const setLocationWithType = (
    lat: number,
    lng: number,
    address: string,
    type: "load" | "unload"
  ) => {
    if (type === "load") {
      setFormData((prev) => ({
        ...prev,
        load_location: address,
        load_latitude: lat.toString(),
        load_longitude: lng.toString(),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        unload_location: address,
        unload_latitude: lat.toString(),
        unload_longitude: lng.toString(),
      }));
    }

    setMarkers((prev) => [
      ...prev.filter((m) => m.type !== type),
      {
        lat,
        lng,
        type,
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Location`,
      },
    ]);
  };

  if (!poDetails)
    return (
      <div className="text-center p-8">Loading purchase order details...</div>
    );

  const selectedVehicle = getSelectedVehicle();
  const unitDisplay = getUnitDisplay(poDetails.unit);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Create Delivery Order
        </h1>
        <button
          onClick={() => navigate(`/trips/po/${poId}`)}
          className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded"
        >
          ← Back
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded mb-6">
          {error}
        </div>
      )}

      {/* 🎯 ENHANCED: PO Information with Unit Display */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">
          Purchase Order Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="text-sm text-gray-600">PO Number</label>
            <p className="font-medium">{poDetails.po_number}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Customer</label>
            <p className="font-medium">{poDetails.customer_name}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Item</label>
            <p className="font-medium">{poDetails.item_name}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Remaining Qty</label>
            <p className="font-medium text-green-600">
              {poDetails.remaining_quantity?.toLocaleString("id-ID")}{" "}
              {unitDisplay}
            </p>
          </div>
          {/* 🎯 NEW: Unit Information */}
          <div>
            <label className="text-sm text-gray-600">Unit</label>
            <p className="font-medium">
              <span className="bg-blue-100 px-2 py-1 rounded text-sm">
                {unitDisplay}
              </span>
            </p>
          </div>
        </div>

        {/* 🎯 NEW: Unit-aware pricing display */}
        {poDetails.unit_price && (
          <div className="mt-4 pt-4 border-t border-blue-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600">Unit Price</label>
                <p className="font-medium text-blue-700">
                  Rp {poDetails.unit_price.toLocaleString("id-ID")}/
                  {unitDisplay}
                  {poDetails.unit === "ton" && (
                    <span className="text-xs text-blue-600 block">
                      (Rp{" "}
                      {(poDetails.unit_price * 1000).toLocaleString("id-ID")}
                      /ton)
                    </span>
                  )}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600">
                  Pricing Strategy
                </label>
                <p className="text-sm text-blue-600">
                  {poDetails.unit === "kubik"
                    ? "Volume-based pricing"
                    : "Weight-based pricing"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 🎯 ENHANCED: Load Quantity with Dynamic Unit */}
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Load Quantity</h3>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimal Load Quantity ({unitDisplay}) *
              </label>
              <input
                type="number"
                name="minimal_load_quantity"
                step="0.01"
                max={poDetails.remaining_quantity}
                value={formData.minimal_load_quantity}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder={`Maximum: ${poDetails.remaining_quantity} ${unitDisplay}`}
                required
              />
              {/* 🎯 NEW: Unit-specific helper text */}
              <p className="text-xs text-gray-500 mt-1">
                {poDetails.unit === "ton" &&
                  "💡 Enter in tons (will be calculated as kg for pricing)"}
                {poDetails.unit === "kubik" &&
                  "💡 Enter in cubic meters (volume-based)"}
                {poDetails.unit === "kilogram" &&
                  "💡 Enter in kilograms (weight-based)"}
              </p>
            </div>

            {/* Vehicle & Driver Assignment - unchanged */}
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">
                Vehicle & Driver Assignment
              </h3>
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle with Assigned Driver *
                </label>
                <select
                  name="vehicle_id"
                  value={formData.vehicle_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Select Vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.license_plate} - {v.type}{" "}
                      {v.driver_name && `- Driver: ${v.driver_name}`}
                    </option>
                  ))}
                </select>
                {vehicles.length === 0 && (
                  <p className="text-sm text-red-600 mt-1">
                    No available vehicles.
                  </p>
                )}
                {selectedVehicle && (
                  <div className="bg-gray-50 p-4 rounded-md mt-2">
                    <h4 className="font-medium text-gray-900 mb-2">
                      Selected:
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Vehicle:</span>
                        <p className="font-medium">
                          {selectedVehicle.license_plate}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Driver:</span>
                        <p className="font-medium">
                          {selectedVehicle.driver_name}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Location Information - unchanged */}
            <div className="bg-white border rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Location Information</h3>
                <button
                  type="button"
                  onClick={() => setShowMap(!showMap)}
                  className="bg-green-500 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
                >
                  {showMap ? "Hide Map" : "Show Map"}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Load Location *
                  </label>
                  <textarea
                    name="load_location"
                    value={formData.load_location}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                    required
                    placeholder="Enter or select on map"
                  />
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => handleProcessLocationLink("load", formData.load_location)}
                      disabled={linkProcessing.load}
                      className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded w-full"
                    >
                      {linkProcessing.load ? "Processing..." : "📌 Extract from Google Maps Link"}
                    </button>
                    <p className="text-xs text-gray-500 mt-1">
                      Paste Google Maps link or address. Shortened links will open in browser.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedLocationType("load")}
                    className={`mt-2 px-3 py-1 rounded text-sm w-full ${
                      selectedLocationType === "load"
                        ? "bg-blue-500 text-white animate-pulse"
                        : "bg-gray-200 hover:bg-gray-300"
                    }`}
                  >
                    {showMap &&
                      (selectedLocationType === "load"
                        ? "Active..."
                        : "Set Load")}
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unload Location *
                  </label>
                  <textarea
                    name="unload_location"
                    value={formData.unload_location}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                    required
                    placeholder="Enter or select on map"
                  />
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => handleProcessLocationLink("unload", formData.unload_location)}
                      disabled={linkProcessing.unload}
                      className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded w-full"
                    >
                      {linkProcessing.unload ? "Processing..." : "📌 Extract from Google Maps Link"}
                    </button>
                    <p className="text-xs text-gray-500 mt-1">
                      Paste Google Maps link or address. Shortened links will open in browser.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedLocationType("unload")}
                    className={`mt-2 px-3 py-1 rounded text-sm w-full ${
                      selectedLocationType === "unload"
                        ? "bg-red-500 text-white animate-pulse"
                        : "bg-gray-200 hover:bg-gray-300"
                    }`}
                  >
                    {showMap &&
                      (selectedLocationType === "unload"
                        ? "Active..."
                        : "Set Unload")}
                  </button>
                </div>
              </div>
            </div>

            {/* 🎯 ENHANCED: Financial Information with Unit-aware Calculations */}
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">
                Financial Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trip Allowance (Rp) *
                  </label>
                  <input
                    type="number"
                    name="trip_allowance"
                    value={formData.trip_allowance}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Driver Salary (Rp) *
                  </label>
                  <input
                    type="number"
                    name="gaji"
                    value={formData.gaji}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Profit (Rp)
                  </label>
                  <input
                    type="number"
                    name="ongkosan"
                    value={formData.ongkosan}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                    readOnly
                  />
                </div>
              </div>

              {/* 🎯 NEW: Revenue Calculation Breakdown */}
              {formData.minimal_load_quantity && poDetails.unit_price && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    Revenue Calculation
                  </h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span>Quantity:</span>
                      <span>
                        {formData.minimal_load_quantity} {unitDisplay}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Unit Price:</span>
                      <span>
                        Rp {poDetails.unit_price.toLocaleString("id-ID")}/
                        {unitDisplay}
                      </span>
                    </div>
                    {poDetails.unit === "ton" && (
                      <div className="flex justify-between text-blue-600">
                        <span>Calculation:</span>
                        <span>
                          {formData.minimal_load_quantity} ton × 1000 kg/ton ×
                          Rp {poDetails.unit_price.toLocaleString("id-ID")}/kg
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold border-t pt-1">
                      <span>Total Revenue:</span>
                      <span>
                        Rp{" "}
                        {calculateTotalAmount(
                          parseFloat(formData.minimal_load_quantity) || 0,
                          poDetails.unit_price,
                          poDetails.unit
                        ).toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => navigate(`/trips/po/${poId}`)}
                className="px-6 py-2 border rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.vehicle_id}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
              >
                {loading ? "Creating..." : "Create Order"}
              </button>
            </div>
          </form>
        </div>

        {/* Map Section - unchanged */}
        {showMap && (
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Location Map</h3>
            <div className="h-96 w-full">
              <MapContainer
                center={
                  markers.length > 0
                    ? [
                        markers[markers.length - 1].lat,
                        markers[markers.length - 1].lng,
                      ]
                    : [defaultCenter.lat, defaultCenter.lng]
                }
                zoom={13}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap contributors"
                />
                <SearchControlComponent onLocationFound={handleSearchSelect} />
                <MapClickHandler />
                {markers.map((m, i) => (
                  <Marker
                    key={i}
                    position={[m.lat, m.lng]}
                    icon={m.type === "load" ? loadIcon : unloadIcon}
                  >
                    <Popup>{m.title}</Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p className="font-semibold">
                💡 Click a "Set Location" button, then use the search bar or
                click the map.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateDeliveryFromPO;
