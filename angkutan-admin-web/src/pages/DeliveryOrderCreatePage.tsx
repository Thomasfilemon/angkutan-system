import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import apiClient from "../api/axiosConfig"; // Assuming this is your axios instance
import { GeoSearchControl, OpenStreetMapProvider } from "leaflet-geosearch";
import "leaflet-geosearch/dist/geosearch.css";
import InfiniteScroll from "react-infinite-scroll-component"; // Install: npm i react-infinite-scroll-component

// Icons and interfaces (from your code, adapted)
const DefaultIcon = L.Icon.Default as any;
DefaultIcon.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

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

interface PODetails {
  id: number;
  po_number: string;
  customer_name: string;
  item_name: string;
  unit: string;
  unit_price?: number;
  total_quantity: number;
  delivered_quantity: number;
  remaining_quantity: number;
  load_location: string;
  unload_location: string;
  load_latitude?: number;
  load_longitude?: number;
  unload_latitude?: number;
  unload_longitude?: number;
  can_create_do: boolean; // From your endpoint
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

interface DOFormData {
  do_name: string;
  item_name: string;
  vehicle_id: string;
  minimal_load_quantity: string;
  unit_price: string;
  trip_allowance: string;
  gaji: string;
  ongkosan: string;
  load_location: string;
  unload_location: string;
  load_latitude: string;
  load_longitude: string;
  unload_latitude: string;
  unload_longitude: string;
}

interface MarkerType {
  lat: number;
  lng: number;
  title: string;
  type: "load" | "unload";
}

// Map components (copied)
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

const MapClickHandler: React.FC<{
  selectedLocationType: "load" | "unload" | null;
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  onClearSelection: () => void;
}> = ({ selectedLocationType, onLocationSelect, onClearSelection }) => {
  const map = useMap();

  useEffect(() => {
    const onClick = (e: L.LeafletMouseEvent) => {
      if (selectedLocationType) {
        const { lat, lng } = e.latlng;
        fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        )
          .then((res) => res.json())
          .then((data) => {
            const address =
              data.display_name ||
              `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
            onLocationSelect(lat, lng, address);
            onClearSelection();
          })
          .catch(() => {
            const address = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
            onLocationSelect(lat, lng, address);
            onClearSelection();
          });
      }
    };

    map.on("click", onClick);

    return () => {
      map.off("click", onClick);
    };
  }, [map, selectedLocationType, onLocationSelect, onClearSelection]);

  return null;
};

// Main component
const DeliveryOrderCreatePage: React.FC = () => {
  const navigate = useNavigate();

  // PO Selection States
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [pos, setPos] = useState<PODetails[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [selectedPO, setSelectedPO] = useState<PODetails | null>(null);
  const limit = 10;

  // Form States
  const [poItems, setPoItems] = useState<string[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [formDataList, setFormDataList] = useState<DOFormData[]>([]);
  const [canCreate, setCanCreate] = useState<boolean>(true); // Based on selected PO's can_create_do

  // Map states
  const [selectedLocationType, setSelectedLocationType] = useState<
    "load" | "unload" | null
  >(null);
  const [showMap, setShowMap] = useState<boolean>(true);
  const [markers, setMarkers] = useState<MarkerType[]>([]);
  const [currentFormIndex, setCurrentFormIndex] = useState<number>(0);
  const [linkProcessing, setLinkProcessing] = useState<{
    load: boolean;
    unload: boolean;
  }>({ load: false, unload: false });

  const defaultCenter = { lat: -6.2088, lng: 106.8456 };

  // Helpers
  const getUnitDisplay = (unit: string) => {
    const unitMap = { kilogram: "kg", ton: "ton", kubik: "m³" };
    return unitMap[unit as keyof typeof unitMap] || unit;
  };

  const calculateTotalAmount = (
    quantity: number,
    unitPrice: number,
    unit: string
  ) => {
    switch (unit) {
      case "kilogram":
      case "ton":
      case "kubik":
        return quantity * unitPrice;
      default:
        return 0;
    }
  };

  const calculateOngkosan = (formData: DOFormData, poUnit?: string): number => {
    if (!formData.unit_price || !poUnit || !formData.minimal_load_quantity)
      return 0;
    const quantity = parseFloat(formData.minimal_load_quantity);
    const unitPrice = parseFloat(formData.unit_price);
    const totalRevenue = calculateTotalAmount(quantity, unitPrice, poUnit);
    const operationalCosts =
      (parseFloat(formData.trip_allowance) || 0) +
      (parseFloat(formData.gaji) || 0);
    return totalRevenue - operationalCosts;
  };

  // Location setters
  const setLocationWithType = (
    lat: number,
    lng: number,
    address: string,
    type: "load" | "unload"
  ) => {
    const newFormDataList = [...formDataList];
    if (type === "load") {
      newFormDataList[currentFormIndex] = {
        ...newFormDataList[currentFormIndex],
        load_location: address,
        load_latitude: lat.toString(),
        load_longitude: lng.toString(),
      };
    } else {
      newFormDataList[currentFormIndex] = {
        ...newFormDataList[currentFormIndex],
        unload_location: address,
        unload_latitude: lat.toString(),
        unload_longitude: lng.toString(),
      };
    }
    setFormDataList(newFormDataList);

    setMarkers((prev) => {
      const filtered = prev.filter((m) => m.type !== type);
      return [
        ...filtered,
        {
          lat,
          lng,
          title: type === "load" ? "Load Location" : "Unload Location",
          type,
        },
      ];
    });

    setSelectedLocationType(null);
  };

  const handleSearchSelect = (lat: number, lng: number, label: string) => {
    if (selectedLocationType) {
      setLocationWithType(lat, lng, label, selectedLocationType);
    }
  };

  // Fetch POs
  const fetchPOs = async (reset = false) => {
    try {
      const currentPage = reset ? 1 : page;
      const response = await apiClient.get("/purchase-orders", {
        params: {
          page: currentPage,
          limit,
          search: searchTerm,
        },
      });
      const newPos = response.data.data || [];
      setPos(reset ? newPos : [...pos, ...newPos]);
      setHasMore(newPos.length === limit);
      if (!reset) setPage(currentPage + 1);
    } catch (err) {
      setErrors((prev) => [...prev, "Failed to fetch POs."]);
    }
  };

  useEffect(() => {
    fetchPOs(true);
  }, [searchTerm]);

  // On PO select
  const handleSelectPO = async (po: PODetails) => {
    setSelectedPO(po);
    setCanCreate(po.can_create_do && po.remaining_quantity > 0);
    setErrors([]);

    const items = po.item_name
      ? po.item_name.split(",").map((i) => i.trim())
      : [];
    setPoItems(items);

    const initialFormData = {
      do_name: "",
      item_name: items.length === 1 ? items[0] : "",
      vehicle_id: "",
      minimal_load_quantity: "",
      unit_price: "",
      trip_allowance: "",
      gaji: "",
      ongkosan: "",
      load_location: po.load_location || "",
      unload_location: po.unload_location || "",
      load_latitude: po.load_latitude?.toString() || "",
      load_longitude: po.load_longitude?.toString() || "",
      unload_latitude: po.unload_latitude?.toString() || "",
      unload_longitude: po.unload_longitude?.toString() || "",
    };
    setFormDataList([initialFormData]);

    const initialMarkers: MarkerType[] = [];
    if (po.load_latitude && po.load_longitude) {
      initialMarkers.push({
        lat: po.load_latitude,
        lng: po.load_longitude,
        title: "Load Location",
        type: "load",
      });
    }
    if (po.unload_latitude && po.unload_longitude) {
      initialMarkers.push({
        lat: po.unload_latitude,
        lng: po.unload_longitude,
        title: "Unload Location",
        type: "unload",
      });
    }
    setMarkers(initialMarkers);

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
      setErrors((prev) => [...prev, "Failed to fetch vehicles."]);
    }
  };

  // Form handlers
  const handleInputChange = (
    index: number,
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    if (!canCreate) return; // Block changes if disabled
    const newFormDataList = [...formDataList];
    newFormDataList[index] = {
      ...newFormDataList[index],
      [e.target.name]: e.target.value,
    };
    setFormDataList(newFormDataList);

    if (
      [
        "minimal_load_quantity",
        "unit_price",
        "trip_allowance",
        "gaji",
      ].includes(e.target.name)
    ) {
      newFormDataList[index].ongkosan = calculateOngkosan(
        newFormDataList[index],
        selectedPO?.unit
      ).toString();
      setFormDataList([...newFormDataList]);
    }
  };

  const addForm = () => {
    if (!canCreate) return;
    setFormDataList([
      ...formDataList,
      {
        do_name: "",
        item_name: poItems.length === 1 ? poItems[0] : "",
        vehicle_id: "",
        minimal_load_quantity: "",
        unit_price: "",
        trip_allowance: "",
        gaji: "",
        ongkosan: "",
        load_location: selectedPO?.load_location || "",
        unload_location: selectedPO?.unload_location || "",
        load_latitude: selectedPO?.load_latitude?.toString() || "",
        load_longitude: selectedPO?.load_longitude?.toString() || "",
        unload_latitude: selectedPO?.unload_latitude?.toString() || "",
        unload_longitude: selectedPO?.unload_longitude?.toString() || "",
      },
    ]);
  };

  const duplicateForm = (index: number) => {
    if (!canCreate) return;
    const currentForm = formDataList[index];
    const newForm: DOFormData = {
      ...currentForm,
      do_name: `${currentForm.do_name} - Copy`,
    };
    setFormDataList([...formDataList, newForm]);
  };

  const removeForm = (index: number) => {
    if (!canCreate) return;
    setFormDataList(formDataList.filter((_, i) => i !== index));
  };

  const getSelectedVehicle = (vehicleId: string): Vehicle | undefined =>
    vehicles.find((v) => v.id.toString() === vehicleId);

  const handleProcessLocationLink = async (
    type: "load" | "unload",
    input: string
  ) => {
    if (!canCreate || !input) return;
    setLinkProcessing((prev) => ({ ...prev, [type]: true }));
    setErrors([]);

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
        setErrors((prev) => [
          ...prev,
          data.message || "Could not determine coordinates.",
        ]);
      }
    } catch (error) {
      setErrors((prev) => [...prev, "Could not process location."]);
    } finally {
      setLinkProcessing((prev) => ({ ...prev, [type]: false }));
    }
  };

  // Batch Submit
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canCreate) return;
    setLoading(true);
    setErrors([]);

    if (!selectedPO || selectedPO.remaining_quantity === undefined) {
      setErrors(["No PO selected or details incomplete."]);
      setLoading(false);
      return;
    }

    const delivery_orders = formDataList.map((formData) => {
      const unitPrice = parseFloat(formData.unit_price);
      if (isNaN(unitPrice) || unitPrice <= 0)
        throw new Error(`Invalid unit price for DO ${formData.do_name}`);

      const selectedVehicle = getSelectedVehicle(formData.vehicle_id);
      if (!selectedVehicle || !selectedVehicle.driver_id)
        throw new Error(`Invalid vehicle for DO ${formData.do_name}`);

      if (!formData.item_name)
        throw new Error(`Item name required for DO ${formData.do_name}`);

      const quantity = parseFloat(formData.minimal_load_quantity);
      if (
        isNaN(quantity) ||
        quantity <= 0 ||
        quantity > selectedPO.remaining_quantity
      ) {
        throw new Error(`Invalid quantity for DO ${formData.do_name}`);
      }

      const totalAmount = calculateTotalAmount(
        quantity,
        unitPrice,
        selectedPO.unit
      );

      return {
        purchase_order_id: selectedPO.id,
        vehicle_id: parseInt(formData.vehicle_id),
        driver_id: selectedVehicle.driver_id,
        do_name: formData.do_name,
        customer_name: selectedPO.customer_name,
        item_name: formData.item_name,
        minimal_load_quantity: quantity,
        unit: selectedPO.unit,
        unit_price: unitPrice,
        total_amount: totalAmount,
        trip_allowance: parseFloat(formData.trip_allowance),
        gaji: parseFloat(formData.gaji),
        ongkosan: parseFloat(formData.ongkosan),
        load_location: formData.load_location || selectedPO.load_location,
        unload_location: formData.unload_location || selectedPO.unload_location,
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
    });

    try {
      await apiClient.post("/delivery-orders/batch", { delivery_orders });
      navigate(-1);
    } catch (err: any) {
      setErrors([err.response?.data?.message || "Failed to create DOs."]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Create Delivery Order
        </h1>
        <button
          onClick={() => navigate("/delivery-orders")}
          className="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded"
        >
          ← Back
        </button>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded mb-6">
          {errors.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}

      {!selectedPO ? (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Select Purchase Order</h2>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by customer name..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
          />
          <div id="po-list" style={{ maxHeight: "400px", overflowY: "auto" }}>
            <InfiniteScroll
              dataLength={pos.length}
              next={() => fetchPOs()}
              hasMore={hasMore}
              loader={<p className="text-center">Loading more POs...</p>}
              scrollableTarget="po-list"
            >
              {pos.map((po) => (
                <div
                  key={po.id}
                  onClick={() => (po.can_create_do ? handleSelectPO(po) : null)}
                  className={`border-b p-4 ${
                    po.can_create_do
                      ? "cursor-pointer hover:bg-gray-100"
                      : "cursor-not-allowed bg-gray-200"
                  }`}
                >
                  <h3 className="font-bold">
                    {po.po_number} - {po.customer_name}
                  </h3>
                  <p>
                    Remaining: {po.remaining_quantity} {getUnitDisplay(po.unit)}{" "}
                    {po.can_create_do ? "" : "(Cannot create DO)"}
                  </p>
                  <p>Items: {po.item_name}</p>
                </div>
              ))}
            </InfiniteScroll>
          </div>
          {pos.length === 0 && <p>No POs found. Try adjusting search.</p>}
        </div>
      ) : (
        <>
          <button
            onClick={() => setSelectedPO(null)}
            className="mb-4 text-blue-500 hover:underline"
          >
            ← Change PO
          </button>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">
              Selected Purchase Order: {selectedPO.po_number}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-sm text-gray-600">Customer</label>
                <p className="font-medium">{selectedPO.customer_name}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Items</label>
                <p className="font-medium">{poItems.join(", ")}</p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Remaining Qty</label>
                <p className="font-medium text-green-600">
                  {selectedPO.remaining_quantity?.toLocaleString("id-ID")}{" "}
                  {getUnitDisplay(selectedPO.unit)}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-600">Unit</label>
                <p className="font-medium">
                  <span className="bg-blue-100 px-2 py-1 rounded text-sm">
                    {getUnitDisplay(selectedPO.unit)}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {!canCreate && (
            <div className="bg-red-500 text-white p-4 rounded mb-6 font-bold text-center">
              ⚠️ WARNING: This PO has no remaining quantity or cannot create new
              DOs. Forms are disabled. Select another PO to proceed.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {formDataList.map((formData, index) => (
                  <div key={index} className="bg-white border rounded-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">
                        Delivery Order {index + 1}
                      </h3>
                      <div className="flex space-x-2">
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => removeForm(index)}
                            className={`text-red-500 hover:text-red-700 text-sm ${
                              !canCreate ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                          >
                            Remove
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => duplicateForm(index)}
                          className={`text-blue-500 hover:text-blue-700 text-sm ${
                            !canCreate ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        >
                          Duplicate
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Delivery Order Name *
                      </label>
                      <input
                        disabled={!canCreate}
                        type="text"
                        name="do_name"
                        value={formData.do_name}
                        onChange={(e) => handleInputChange(index, e)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                          !canCreate ? "bg-gray-100 cursor-not-allowed" : ""
                        }`}
                        placeholder="e.g., Pengiriman Pasir ke Proyek XYZ"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Give a descriptive name for this delivery order
                      </p>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Item Name *
                      </label>
                      <select
                        disabled={!canCreate}
                        name="item_name"
                        value={formData.item_name}
                        onChange={(e) => handleInputChange(index, e)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                          !canCreate ? "bg-gray-100 cursor-not-allowed" : ""
                        }`}
                        required
                      >
                        <option value="">Select Item</option>
                        {poItems.map((item, i) => (
                          <option key={i} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      {poItems.length === 0 && (
                        <p className="text-sm text-red-600 mt-1">
                          No items available in this PO.
                        </p>
                      )}
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimal Load Quantity ({getUnitDisplay(selectedPO.unit)}
                        ) *
                      </label>
                      <input
                        disabled={!canCreate}
                        type="number"
                        name="minimal_load_quantity"
                        step="0.01"
                        max={selectedPO.remaining_quantity}
                        value={formData.minimal_load_quantity}
                        onChange={(e) => handleInputChange(index, e)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                          !canCreate ? "bg-gray-100 cursor-not-allowed" : ""
                        }`}
                        placeholder={`Maximum: ${
                          selectedPO.remaining_quantity
                        } ${getUnitDisplay(selectedPO.unit)}`}
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedPO.unit === "ton" &&
                          "💡 Enter in tons (price per ton)"}
                        {selectedPO.unit === "kubik" &&
                          "💡 Enter in cubic meters (volume-based)"}
                        {selectedPO.unit === "kilogram" &&
                          "💡 Enter in kilograms (weight-based)"}
                      </p>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Unit Price (Rp/{getUnitDisplay(selectedPO.unit)}) *
                      </label>
                      <input
                        disabled={!canCreate}
                        type="number"
                        name="unit_price"
                        step="0.01"
                        value={formData.unit_price}
                        onChange={(e) => handleInputChange(index, e)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                          !canCreate ? "bg-gray-100 cursor-not-allowed" : ""
                        }`}
                        placeholder={`Enter price per ${getUnitDisplay(
                          selectedPO.unit
                        )}`}
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        💡 Set the negotiated price per{" "}
                        {getUnitDisplay(selectedPO.unit)} for this delivery
                      </p>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Vehicle with Assigned Driver *
                      </label>
                      <select
                        disabled={!canCreate}
                        name="vehicle_id"
                        value={formData.vehicle_id}
                        onChange={(e) => handleInputChange(index, e)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                          !canCreate ? "bg-gray-100 cursor-not-allowed" : ""
                        }`}
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
                      {formData.vehicle_id && (
                        <div className="bg-gray-50 p-4 rounded-md mt-2">
                          <h4 className="font-medium text-gray-900 mb-2">
                            Selected:
                          </h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Vehicle:</span>
                              <p className="font-medium">
                                {
                                  getSelectedVehicle(formData.vehicle_id)
                                    ?.license_plate
                                }
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-600">Driver:</span>
                              <p className="font-medium">
                                {
                                  getSelectedVehicle(formData.vehicle_id)
                                    ?.driver_name
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Trip Allowance (Rp) *
                        </label>
                        <input
                          disabled={!canCreate}
                          type="number"
                          name="trip_allowance"
                          value={formData.trip_allowance}
                          onChange={(e) => handleInputChange(index, e)}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                            !canCreate ? "bg-gray-100 cursor-not-allowed" : ""
                          }`}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Driver Salary (Rp) *
                        </label>
                        <input
                          disabled={!canCreate}
                          type="number"
                          name="gaji"
                          value={formData.gaji}
                          onChange={(e) => handleInputChange(index, e)}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                            !canCreate ? "bg-gray-100 cursor-not-allowed" : ""
                          }`}
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
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 ${
                            !canCreate ? "cursor-not-allowed" : ""
                          }`}
                          readOnly
                          disabled
                        />
                      </div>
                    </div>

                    {formData.minimal_load_quantity && formData.unit_price && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">
                          Revenue Calculation
                        </h4>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div className="flex justify-between">
                            <span>Quantity:</span>
                            <span>
                              {formData.minimal_load_quantity}{" "}
                              {getUnitDisplay(selectedPO.unit)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Unit Price:</span>
                            <span>
                              Rp{" "}
                              {parseFloat(formData.unit_price).toLocaleString(
                                "id-ID"
                              )}
                              /{getUnitDisplay(selectedPO.unit)}
                            </span>
                          </div>
                          <div className="flex justify-between text-blue-600">
                            <span>Calculation:</span>
                            <span>
                              {formData.minimal_load_quantity}{" "}
                              {getUnitDisplay(selectedPO.unit)} × Rp{" "}
                              {parseFloat(formData.unit_price).toLocaleString(
                                "id-ID"
                              )}
                              /{getUnitDisplay(selectedPO.unit)}
                            </span>
                          </div>
                          <div className="flex justify-between font-semibold border-t pt-1">
                            <span>Total Revenue:</span>
                            <span>
                              Rp{" "}
                              {calculateTotalAmount(
                                parseFloat(formData.minimal_load_quantity) || 0,
                                parseFloat(formData.unit_price) || 0,
                                selectedPO.unit
                              ).toLocaleString("id-ID")}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Load Location *
                      </label>
                      <textarea
                        disabled={!canCreate}
                        name="load_location"
                        value={formData.load_location}
                        onChange={(e) => handleInputChange(index, e)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                          !canCreate ? "bg-gray-100 cursor-not-allowed" : ""
                        }`}
                        rows={3}
                        required
                        placeholder="Enter or select on map"
                      />
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleProcessLocationLink(
                              "load",
                              formData.load_location
                            )
                          }
                          disabled={!canCreate || linkProcessing.load}
                          className={`text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded w-full ${
                            !canCreate ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        >
                          {linkProcessing.load
                            ? "Processing..."
                            : "📌 Extract from Google Maps Link"}
                        </button>
                        <p className="text-xs text-gray-500 mt-1">
                          Paste Google Maps link or address.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (canCreate) {
                            setCurrentFormIndex(index);
                            setSelectedLocationType("load");
                          }
                        }}
                        className={`mt-2 px-3 py-1 rounded text-sm w-full ${
                          selectedLocationType === "load" &&
                          currentFormIndex === index
                            ? "bg-blue-500 text-white animate-pulse"
                            : "bg-gray-200 hover:bg-gray-300"
                        } ${!canCreate ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {showMap &&
                          (selectedLocationType === "load" &&
                          currentFormIndex === index
                            ? "Click on map..."
                            : "Set Load Location")}
                      </button>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Unload Location *
                      </label>
                      <textarea
                        disabled={!canCreate}
                        name="unload_location"
                        value={formData.unload_location}
                        onChange={(e) => handleInputChange(index, e)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                          !canCreate ? "bg-gray-100 cursor-not-allowed" : ""
                        }`}
                        rows={3}
                        required
                        placeholder="Enter or select on map"
                      />
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleProcessLocationLink(
                              "unload",
                              formData.unload_location
                            )
                          }
                          disabled={!canCreate || linkProcessing.unload}
                          className={`text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded w-full ${
                            !canCreate ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        >
                          {linkProcessing.unload
                            ? "Processing..."
                            : "📌 Extract from Google Maps Link"}
                        </button>
                        <p className="text-xs text-gray-500 mt-1">
                          Paste Google Maps link or address.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (canCreate) {
                            setCurrentFormIndex(index);
                            setSelectedLocationType("unload");
                          }
                        }}
                        className={`mt-2 px-3 py-1 rounded text-sm w-full ${
                          selectedLocationType === "unload" &&
                          currentFormIndex === index
                            ? "bg-red-500 text-white animate-pulse"
                            : "bg-gray-200 hover:bg-gray-300"
                        } ${!canCreate ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {showMap &&
                          (selectedLocationType === "unload" &&
                          currentFormIndex === index
                            ? "Click on map..."
                            : "Set Unload Location")}
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addForm}
                  className={`w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 ${
                    !canCreate ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  + Add Another Delivery Order
                </button>

                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => navigate("/delivery-orders")}
                    className="px-6 py-2 border rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      loading ||
                      !canCreate ||
                      formDataList.some(
                        (f) => !f.vehicle_id || !f.item_name || !f.unit_price
                      )
                    }
                    className={`px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300`}
                  >
                    {loading ? "Creating..." : "Create Order(s)"}
                  </button>
                </div>
              </form>
            </div>

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
                      attribution="© OpenStreetMap contributors"
                    />
                    <SearchControlComponent
                      onLocationFound={handleSearchSelect}
                    />
                    <MapClickHandler
                      selectedLocationType={selectedLocationType}
                      onLocationSelect={(lat, lng, address) => {
                        if (selectedLocationType && canCreate)
                          setLocationWithType(
                            lat,
                            lng,
                            address,
                            selectedLocationType
                          );
                      }}
                      onClearSelection={() => setSelectedLocationType(null)}
                    />
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
                  {selectedLocationType && (
                    <p className="text-blue-600 mt-2">
                      🎯 Ready to set {selectedLocationType} location for form{" "}
                      {currentFormIndex + 1}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DeliveryOrderCreatePage;
