import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
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

interface Allowance {
  description: string;
  amount: string;
}

interface DOFormData {
  do_name: string;
  item_name: string;
  vehicle_id: string;
  minimal_load_quantity: string;
  unit_price: string;
  trip_allowance: string;
  additional_allowance: Allowance[];
  gaji: string;
  ongkosan: string;
  load_location: string;
  unload_location: string;
  load_latitude: string;
  load_longitude: string;
  unload_latitude: string;
  unload_longitude: string;
  payment_notes: string;
}

interface MarkerType {
  lat: number;
  lng: number;
  title: string;
  type: "load" | "unload";
}

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

const CreateDeliveryFromPO: React.FC = () => {
  const { poId } = useParams<{ poId: string }>();
  const navigate = useNavigate();
  const [poDetails, setPODetails] = useState<PODetails | null>(null);
  const [poItems, setPoItems] = useState<string[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [formDataList, setFormDataList] = useState<DOFormData[]>([
    {
      do_name: "",
      item_name: "",
      vehicle_id: "",
      minimal_load_quantity: "",
      unit_price: "",
      trip_allowance: "",
      additional_allowance: [],
      gaji: "",
      ongkosan: "",
      load_location: "",
      unload_location: "",
      load_latitude: "",
      load_longitude: "",
      unload_latitude: "",
      unload_longitude: "",
      payment_notes: "",
    },
  ]);

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

  const defaultCenter = { lat: -6.2088, lng: 106.8456 };

  const getUnitDisplay = (unit: string) => {
    const unitMap = {
      kilogram: "kg",
      ton: "ton",
      kubik: "m³",
    };
    return unitMap[unit as keyof typeof unitMap] || unit;
  };

  const calculateTotalAmount = (
    quantity: number,
    unitPrice: number,
    unit: string
  ) => {
    return quantity * unitPrice;
  };

  const calculateAdditionalAllowanceTotal = (formData: DOFormData): number => {
    return formData.additional_allowance.reduce(
      (sum, allowance) => sum + (parseFloat(allowance.amount) || 0),
      0
    );
  };

  const calculateOngkosan = (formData: DOFormData, poUnit?: string): number => {
    if (!formData.unit_price || !poUnit || !formData.minimal_load_quantity)
      return 0;
    const quantity = parseFloat(formData.minimal_load_quantity);
    const unitPrice = parseFloat(formData.unit_price);
    const totalRevenue = calculateTotalAmount(quantity, unitPrice, poUnit);
    const tripAllowance = parseFloat(formData.trip_allowance) || 0;
    const additionalAllowance = calculateAdditionalAllowanceTotal(formData);
    const gaji = parseFloat(formData.gaji) || 0;
    const operationalCosts = tripAllowance + additionalAllowance + gaji;
    return totalRevenue - operationalCosts;
  };

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

  const applySuggestion = (type: "load" | "unload", value: string) => {
    const newFormDataList = [...formDataList];
    if (type === "load") {
      newFormDataList[currentFormIndex] = {
        ...newFormDataList[currentFormIndex],
        load_location: value,
      };
    } else {
      newFormDataList[currentFormIndex] = {
        ...newFormDataList[currentFormIndex],
        unload_location: value,
      };
    }
    setFormDataList(newFormDataList);
    setShowSuggestions(null);
  };

  useEffect(() => {
    if (poId) {
      fetchPODetails();
      fetchAvailableVehicles();
    }
    // fetch recent locations once on mount
    fetchRecentLocations();
  }, [poId]);

  const fetchRecentLocations = async () => {
    try {
      const resp = await apiClient.get(
        "/delivery-orders/utils/recent-locations"
      );
      const payload = resp.data?.data || resp.data;

      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        const hasLoad = Array.isArray((payload as any).load_locations);
        const hasUnload = Array.isArray((payload as any).unload_locations);
        if (hasLoad || hasUnload) {
          const loadArr = (payload as any).load_locations || [];
          const unloadArr = (payload as any).unload_locations || [];
          setLoadLocationSuggestions(
            Array.from(new Set(loadArr as string[])).slice(0, 200)
          );
          setUnloadLocationSuggestions(
            Array.from(new Set(unloadArr as string[])).slice(0, 200)
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
      const top = unique.slice(0, 200);
      setLoadLocationSuggestions(top);
      setUnloadLocationSuggestions(top);
    } catch (err) {
      console.warn("Could not fetch recent locations", err);
    }
  };

  const fetchPODetails = async (): Promise<void> => {
    try {
      const response = await apiClient.get(`/purchase-orders/${poId}`);
      const details = response.data.data || response.data;

      if (!details.unit) {
        console.warn('PO data missing unit field, defaulting to "ton"');
        details.unit = "ton";
      }

      setPODetails(details);

      const items = details.item_name
        ? details.item_name.split(",").map((i: string) => i.trim())
        : [];
      setPoItems(items);

      const initialFormData = {
        do_name: "",
        item_name: items.length === 1 ? items[0] : "",
        vehicle_id: "",
        minimal_load_quantity: "",
        unit_price: "",
        trip_allowance: "",
        additional_allowance: [],
        gaji: "",
        ongkosan: "",
        load_location: details.load_location || "",
        unload_location: details.unload_location || "",
        load_latitude: details.load_latitude?.toString() || "",
        load_longitude: details.load_longitude?.toString() || "",
        unload_latitude: details.unload_latitude?.toString() || "",
        unload_longitude: details.unload_longitude?.toString() || "",
        payment_notes: "",
      };
      setFormDataList([initialFormData]);

      const initialMarkers: MarkerType[] = [];
      if (details.load_latitude && details.load_longitude) {
        initialMarkers.push({
          lat: details.load_latitude,
          lng: details.load_longitude,
          title: "Load Location",
          type: "load",
        });
      }
      if (details.unload_latitude && details.unload_longitude) {
        initialMarkers.push({
          lat: details.unload_latitude,
          lng: details.unload_longitude,
          title: "Unload Location",
          type: "unload",
        });
      }
      setMarkers(initialMarkers);
    } catch (err) {
      console.error("Error fetching PO details:", err);
      setErrors((prev) => [...prev, "Failed to fetch purchase order details."]);
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
      setErrors((prev) => [...prev, "Failed to fetch available vehicles."]);
    }
  };

  const handleInputChange = (
    index: number,
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ): void => {
    const newFormDataList = [...formDataList];
    newFormDataList[index] = {
      ...newFormDataList[index],
      [e.target.name]: e.target.value,
    };
    newFormDataList[index].ongkosan = calculateOngkosan(
      newFormDataList[index],
      poDetails?.unit
    ).toString();
    setFormDataList(newFormDataList);
  };

  const handleAllowanceChange = (
    formIndex: number,
    allowanceIndex: number,
    field: keyof Allowance,
    value: string
  ) => {
    const newFormDataList = [...formDataList];
    newFormDataList[formIndex].additional_allowance[allowanceIndex] = {
      ...newFormDataList[formIndex].additional_allowance[allowanceIndex],
      [field]: value,
    };

    // Update payment_notes with all allowances
    const allowances = newFormDataList[formIndex].additional_allowance;
    let paymentNotes = newFormDataList[formIndex].payment_notes || "";

    // Remove existing allowance lines from payment_notes
    paymentNotes = paymentNotes
      .split("\n")
      .filter((line) => !line.startsWith("Additional Allowance"))
      .join("\n");

    // Append all allowances to payment_notes
    allowances.forEach((allowance, i) => {
      if (allowance.description || allowance.amount) {
        const amount = parseFloat(allowance.amount) || 0;
        const allowanceText = `Additional Allowance ${
          i + 1
        }: Rp ${amount.toLocaleString("id-ID")} - ${
          allowance.description || "No description"
        }`;
        paymentNotes = paymentNotes
          ? `${paymentNotes}\n${allowanceText}`
          : allowanceText;
      }
    });

    newFormDataList[formIndex].payment_notes = paymentNotes;
    newFormDataList[formIndex].ongkosan = calculateOngkosan(
      newFormDataList[formIndex],
      poDetails?.unit
    ).toString();
    setFormDataList(newFormDataList);
  };

  const addAllowance = (formIndex: number) => {
    const newFormDataList = [...formDataList];
    const newAllowance = { description: "", amount: "" };
    newFormDataList[formIndex].additional_allowance.push(newAllowance);

    // Update payment_notes with the new allowance (placeholder if empty)
    const currentNotes = newFormDataList[formIndex].payment_notes || "";
    const allowanceText = `Additional Allowance ${newFormDataList[formIndex].additional_allowance.length}: Rp 0 - No description`;
    newFormDataList[formIndex].payment_notes = currentNotes
      ? `${currentNotes}\n${allowanceText}`
      : allowanceText;

    newFormDataList[formIndex].ongkosan = calculateOngkosan(
      newFormDataList[formIndex],
      poDetails?.unit
    ).toString();
    setFormDataList(newFormDataList);
  };

  const removeAllowance = (formIndex: number, allowanceIndex: number) => {
    const newFormDataList = [...formDataList];
    newFormDataList[formIndex].additional_allowance = newFormDataList[
      formIndex
    ].additional_allowance.filter((_, i) => i !== allowanceIndex);

    // Update payment_notes with remaining allowances
    let paymentNotes = newFormDataList[formIndex].payment_notes || "";
    paymentNotes = paymentNotes
      .split("\n")
      .filter((line) => !line.startsWith("Additional Allowance"))
      .join("\n");

    const allowances = newFormDataList[formIndex].additional_allowance;
    allowances.forEach((allowance, i) => {
      if (allowance.description || allowance.amount) {
        const amount = parseFloat(allowance.amount) || 0;
        const allowanceText = `Additional Allowance ${
          i + 1
        }: Rp ${amount.toLocaleString("id-ID")} - ${
          allowance.description || "No description"
        }`;
        paymentNotes = paymentNotes
          ? `${paymentNotes}\n${allowanceText}`
          : allowanceText;
      }
    });

    newFormDataList[formIndex].payment_notes = paymentNotes;
    newFormDataList[formIndex].ongkosan = calculateOngkosan(
      newFormDataList[formIndex],
      poDetails?.unit
    ).toString();
    setFormDataList(newFormDataList);
  };

  const addForm = () => {
    setFormDataList([
      ...formDataList,
      {
        do_name: "",
        item_name: poItems.length === 1 ? poItems[0] : "",
        vehicle_id: "",
        minimal_load_quantity: "",
        unit_price: "",
        trip_allowance: "",
        additional_allowance: [],
        gaji: "",
        ongkosan: "",
        load_location: poDetails?.load_location || "",
        unload_location: poDetails?.unload_location || "",
        load_latitude: poDetails?.load_latitude?.toString() || "",
        load_longitude: poDetails?.load_longitude?.toString() || "",
        unload_latitude: poDetails?.unload_latitude?.toString() || "",
        unload_longitude: poDetails?.unload_longitude?.toString() || "",
        payment_notes: "",
      },
    ]);
  };

  const duplicateForm = (index: number) => {
    const currentForm = formDataList[index];
    const newForm: DOFormData = {
      ...currentForm,
      do_name: `${currentForm.do_name} - Copy`,
      additional_allowance: [...currentForm.additional_allowance],
    };
    setFormDataList([...formDataList, newForm]);
  };

  const removeForm = (index: number) => {
    setFormDataList(formDataList.filter((_, i) => i !== index));
  };

  const getSelectedVehicle = (vehicleId: string): Vehicle | undefined =>
    vehicles.find((v) => v.id.toString() === vehicleId);

  const handleProcessLocationLink = async (
    type: "load" | "unload",
    input: string
  ) => {
    if (!input) return;
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
          data.message ||
            "Could not determine coordinates. Please check the input or enter coordinates manually.",
        ]);
      }
    } catch (error) {
      setErrors((prev) => [
        ...prev,
        "Could not process the location link. Please try again or enter coordinates manually.",
      ]);
    } finally {
      setLinkProcessing((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrors([]);

    const newErrors: string[] = [];

    try {
      if (!poDetails || poDetails.remaining_quantity === undefined) {
        newErrors.push(
          "Purchase order details are incomplete. Cannot create delivery orders."
        );
        return;
      }

      for (let index = 0; index < formDataList.length; index++) {
        const formData = formDataList[index];
        const unitPrice = parseFloat(formData.unit_price);
        if (isNaN(unitPrice) || unitPrice <= 0) {
          throw new Error(
            `Invalid unit price (${unitPrice}) for DO ${
              formData.do_name || index + 1
            }. Must be a positive number.`
          );
        }

        const selectedVehicle = getSelectedVehicle(formData.vehicle_id);
        if (!selectedVehicle || !selectedVehicle.driver_id) {
          throw new Error(
            `Invalid vehicle selection for DO ${formData.do_name || index + 1}`
          );
        }

        if (!formData.item_name) {
          throw new Error(
            `Item name is required for DO ${formData.do_name || index + 1}`
          );
        }

        const quantity = parseFloat(formData.minimal_load_quantity);
        if (isNaN(quantity) || quantity <= 0) {
          throw new Error(
            `Invalid quantity (${quantity}) for DO ${
              formData.do_name || index + 1
            }. Must be a positive number.`
          );
        }
        if (quantity > poDetails.remaining_quantity) {
          throw new Error(
            `Invalid quantity (${quantity}) for DO ${
              formData.do_name || index + 1
            }. Must not exceed remaining ${
              poDetails.remaining_quantity
            } ${getUnitDisplay(poDetails.unit || "ton")}.`
          );
        }

        for (let i = 0; i < formData.additional_allowance.length; i++) {
          const allowance = formData.additional_allowance[i];
          if (!allowance.description) {
            throw new Error(
              `Additional allowance ${i + 1} in DO ${
                formData.do_name || index + 1
              } is missing a description.`
            );
          }
          const amount = parseFloat(allowance.amount);
          if (isNaN(amount) || amount <= 0) {
            throw new Error(
              `Additional allowance ${i + 1} in DO ${
                formData.do_name || index + 1
              } has an invalid amount. Must be a positive number.`
            );
          }
        }

        const totalAmount = calculateTotalAmount(
          quantity,
          unitPrice,
          poDetails.unit
        );

        // Append additional allowance descriptions to payment_notes
        // let paymentNotes = formData.payment_notes || "";
        // formData.additional_allowance.forEach((allowance, i) => {
        //   if (allowance.description && allowance.amount) {
        //     const allowanceText = `Additional Allowance ${i + 1}: Rp ${parseFloat(allowance.amount).toLocaleString("id-ID")} - ${allowance.description}`;
        //     paymentNotes = paymentNotes
        //       ? `${paymentNotes}\n${allowanceText}`
        //       : allowanceText;
        //   }
        // });

        const payload = {
          purchase_order_id: poDetails.id,
          vehicle_id: parseInt(formData.vehicle_id),
          driver_id: selectedVehicle.driver_id,
          do_name: formData.do_name,
          customer_name: poDetails.customer_name,
          item_name: formData.item_name,
          minimal_load_quantity: quantity,
          unit: poDetails.unit,
          unit_price: unitPrice,
          total_amount: totalAmount,
          trip_allowance: parseFloat(formData.trip_allowance) || 0,
          additional_allowance: formData.additional_allowance.map((allowance) =>
            parseFloat(allowance.amount)
          ),
          gaji: parseFloat(formData.gaji) || 0,
          ongkosan: parseFloat(formData.ongkosan) || 0,
          load_location: formData.load_location || poDetails.load_location,
          unload_location:
            formData.unload_location || poDetails.unload_location,
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
          payment_notes: formData.payment_notes,
        };

        console.log(`Creating DO with payload:`, payload);
        await apiClient.post("/delivery-orders", payload);
      }

      if (newErrors.length === 0) {
        navigate("/delivery-orders");
      }
    } catch (err: any) {
      newErrors.push(
        err.response?.data?.message ||
          err.message ||
          `Failed to create one or more delivery orders.`
      );
    } finally {
      setErrors(newErrors);
      setLoading(false);
    }
  };

  if (!poDetails)
    return (
      <div className="text-center p-8">Loading purchase order details...</div>
    );

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

      {errors.length > 0 && (
        <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded mb-6">
          {errors.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}

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
            <label className="text-sm text-gray-600">Items</label>
            <p className="font-medium">{poItems.join(", ")}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Remaining Qty</label>
            <p className="font-medium text-green-600">
              {poDetails.remaining_quantity?.toLocaleString("id-ID")}{" "}
              {unitDisplay}
            </p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Unit</label>
            <p className="font-medium">
              <span className="bg-blue-100 px-2 py-1 rounded text-sm">
                {unitDisplay}
              </span>
            </p>
          </div>
        </div>

        {poDetails.unit_price && (
          <div className="mt-4 pt-4 border-t border-blue-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600">
                  PO Unit Price (Reference)
                </label>
                <p className="font-medium text-blue-700">
                  Rp {poDetails.unit_price.toLocaleString("id-ID")}/
                  {unitDisplay}
                  {poDetails.unit === "ton" && (
                    <span className="text-xs text-blue-600 block">
                      (Rp{" "}
                      {(poDetails.unit_price / 1000).toLocaleString("id-ID")}
                      /kg)
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
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => duplicateForm(index)}
                      className="text-blue-500 hover:text-blue-700 text-sm"
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
                    type="text"
                    name="do_name"
                    value={formData.do_name}
                    onChange={(e) => handleInputChange(index, e)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                    name="item_name"
                    value={formData.item_name}
                    onChange={(e) => handleInputChange(index, e)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
                    Minimal Load Quantity ({unitDisplay}) *
                  </label>
                  <input
                    type="number"
                    name="minimal_load_quantity"
                    step="0.01"
                    max={poDetails?.remaining_quantity}
                    value={formData.minimal_load_quantity}
                    onChange={(e) => handleInputChange(index, e)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder={`Maximum: ${poDetails?.remaining_quantity} ${unitDisplay}`}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {poDetails?.unit === "ton" &&
                      "💡 Enter in tons (price per ton)"}
                    {poDetails?.unit === "kubik" &&
                      "💡 Enter in cubic meters (volume-based)"}
                    {poDetails?.unit === "kilogram" &&
                      "💡 Enter in kilograms (weight-based)"}
                  </p>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unit Price (Rp/{unitDisplay}) *
                  </label>
                  <input
                    type="number"
                    name="unit_price"
                    step="0.01"
                    value={formData.unit_price}
                    onChange={(e) => handleInputChange(index, e)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder={`Enter price per ${unitDisplay}`}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Set the negotiated price per {unitDisplay} for this
                    delivery
                  </p>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vehicle with Assigned Driver *
                  </label>
                  <select
                    name="vehicle_id"
                    value={formData.vehicle_id}
                    onChange={(e) => handleInputChange(index, e)}
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

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trip Allowance (Rp) *
                  </label>
                  <input
                    type="number"
                    name="trip_allowance"
                    value={formData.trip_allowance}
                    onChange={(e) => handleInputChange(index, e)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Base allowance for the trip (e.g., fuel, tolls)
                  </p>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Allowances
                  </label>
                  {formData.additional_allowance.map(
                    (allowance, allowanceIndex) => (
                      <div
                        key={allowanceIndex}
                        className="flex items-center space-x-2 mb-2"
                      >
                        <input
                          type="text"
                          placeholder="Description (e.g., Parking Fee)"
                          value={allowance.description}
                          onChange={(e) =>
                            handleAllowanceChange(
                              index,
                              allowanceIndex,
                              "description",
                              e.target.value
                            )
                          }
                          className="w-2/3 px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                        <input
                          type="number"
                          placeholder="Amount (Rp)"
                          value={allowance.amount}
                          onChange={(e) =>
                            handleAllowanceChange(
                              index,
                              allowanceIndex,
                              "amount",
                              e.target.value
                            )
                          }
                          className="w-1/3 px-3 py-2 border border-gray-300 rounded-md"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => removeAllowance(index, allowanceIndex)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => addAllowance(index)}
                    className="mt-2 text-blue-500 hover:text-blue-700 text-sm"
                  >
                    + Add Allowance
                  </button>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Driver Salary (Rp) *
                  </label>
                  <input
                    type="number"
                    name="gaji"
                    value={formData.gaji}
                    onChange={(e) => handleInputChange(index, e)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>

                <div className="mt-4">
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

                {formData.minimal_load_quantity && formData.unit_price && (
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
                          Rp{" "}
                          {parseFloat(formData.unit_price).toLocaleString(
                            "id-ID"
                          )}
                          /{unitDisplay}
                        </span>
                      </div>
                      <div className="flex justify-between text-blue-600">
                        <span>Calculation:</span>
                        <span>
                          {formData.minimal_load_quantity} {unitDisplay} × Rp{" "}
                          {parseFloat(formData.unit_price).toLocaleString(
                            "id-ID"
                          )}
                          /{unitDisplay}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-1">
                        <span>Total Revenue:</span>
                        <span>
                          Rp{" "}
                          {calculateTotalAmount(
                            parseFloat(formData.minimal_load_quantity) || 0,
                            parseFloat(formData.unit_price) || 0,
                            poDetails?.unit || "ton"
                          ).toLocaleString("id-ID")}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2">
                        <span>Trip Allowance:</span>
                        <span>
                          Rp{" "}
                          {parseFloat(
                            formData.trip_allowance || "0"
                          ).toLocaleString("id-ID")}
                        </span>
                      </div>
                      {formData.additional_allowance.map((allowance, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{allowance.description}:</span>
                          <span>
                            Rp{" "}
                            {parseFloat(allowance.amount || "0").toLocaleString(
                              "id-ID"
                            )}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between">
                        <span>Driver Salary:</span>
                        <span>
                          Rp{" "}
                          {parseFloat(formData.gaji || "0").toLocaleString(
                            "id-ID"
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-1">
                        <span>Total Operational Costs:</span>
                        <span>
                          Rp{" "}
                          {(
                            parseFloat(formData.trip_allowance || "0") +
                            calculateAdditionalAllowanceTotal(formData) +
                            parseFloat(formData.gaji || "0")
                          ).toLocaleString("id-ID")}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-1">
                        <span>Profit (Ongkosan):</span>
                        <span>
                          Rp{" "}
                          {parseFloat(formData.ongkosan || "0").toLocaleString(
                            "id-ID"
                          )}
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
                    name="load_location"
                    value={formData.load_location}
                    onChange={(e) => handleInputChange(index, e)}
                    onFocus={() => {
                      setCurrentFormIndex(index);
                      setShowSuggestions("load");
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                    required
                    placeholder="Enter or select on map"
                  />
                  {showSuggestions === "load" &&
                    loadLocationSuggestions.length > 0 && (
                      <div className="mt-2 bg-white border rounded shadow max-h-40 overflow-auto">
                        {loadLocationSuggestions
                          .filter((r) =>
                            r
                              .toLowerCase()
                              .includes(
                                (formData.load_location || "").toLowerCase()
                              )
                          )
                          .slice(0, 10)
                          .map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => applySuggestion("load", r)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                            >
                              {r}
                            </button>
                          ))}
                      </div>
                    )}
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleProcessLocationLink(
                          "load",
                          formData.load_location
                        )
                      }
                      disabled={linkProcessing.load}
                      className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded w-full"
                    >
                      {linkProcessing.load
                        ? "Processing..."
                        : "📌 Extract from Google Maps Link"}
                    </button>
                    <p className="text-xs text-gray-500 mt-1">
                      Paste Google Maps link or address. Shortened links will
                      open in browser.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentFormIndex(index);
                      setSelectedLocationType("load");
                    }}
                    className={`mt-2 px-3 py-1 rounded text-sm w-full ${
                      selectedLocationType === "load" &&
                      currentFormIndex === index
                        ? "bg-blue-500 text-white animate-pulse"
                        : "bg-gray-200 hover:bg-gray-300"
                    }`}
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
                    name="unload_location"
                    value={formData.unload_location}
                    onChange={(e) => handleInputChange(index, e)}
                    onFocus={() => {
                      setCurrentFormIndex(index);
                      setShowSuggestions("unload");
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                    required
                    placeholder="Enter or select on map"
                  />
                  {showSuggestions === "unload" &&
                    unloadLocationSuggestions.length > 0 && (
                      <div className="mt-2 bg-white border rounded shadow max-h-40 overflow-auto">
                        {unloadLocationSuggestions
                          .filter((r) =>
                            r
                              .toLowerCase()
                              .includes(
                                (formData.unload_location || "").toLowerCase()
                              )
                          )
                          .slice(0, 10)
                          .map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => applySuggestion("unload", r)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                            >
                              {r}
                            </button>
                          ))}
                      </div>
                    )}
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleProcessLocationLink(
                          "unload",
                          formData.unload_location
                        )
                      }
                      disabled={linkProcessing.unload}
                      className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-1 rounded w-full"
                    >
                      {linkProcessing.unload
                        ? "Processing..."
                        : "📌 Extract from Google Maps Link"}
                    </button>
                    <p className="text-xs text-gray-500 mt-1">
                      Paste Google Maps link or address. Shortened links will
                      open in browser.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentFormIndex(index);
                      setSelectedLocationType("unload");
                    }}
                    className={`mt-2 px-3 py-1 rounded text-sm w-full ${
                      selectedLocationType === "unload" &&
                      currentFormIndex === index
                        ? "bg-red-500 text-white animate-pulse"
                        : "bg-gray-200 hover:bg-gray-300"
                    }`}
                  >
                    {showMap &&
                      (selectedLocationType === "unload" &&
                      currentFormIndex === index
                        ? "Click on map..."
                        : "Set Unload Location")}
                  </button>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Notes
                  </label>
                  <textarea
                    name="payment_notes"
                    value={formData.payment_notes}
                    onChange={(e) => handleInputChange(index, e)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={4}
                    placeholder="Additional payment notes, including allowance descriptions..."
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addForm}
              className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              + Add Another Delivery Order
            </button>

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
                disabled={
                  loading ||
                  formDataList.some(
                    (f) =>
                      !f.vehicle_id ||
                      !f.item_name ||
                      !f.unit_price ||
                      !f.trip_allowance ||
                      !f.gaji ||
                      f.additional_allowance.some(
                        (a) =>
                          !a.description ||
                          !a.amount ||
                          parseFloat(a.amount) <= 0
                      )
                  )
                }
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
              >
                {loading ? "Creating..." : "Create Order"}
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
                <SearchControlComponent onLocationFound={handleSearchSelect} />
                <MapClickHandler
                  selectedLocationType={selectedLocationType}
                  onLocationSelect={(lat, lng, address) => {
                    if (selectedLocationType) {
                      setLocationWithType(
                        lat,
                        lng,
                        address,
                        selectedLocationType
                      );
                    }
                  }}
                  onClearSelection={() => setSelectedLocationType(null)}
                />
                {markers.map((m: MarkerType, i: number) => (
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
    </div>
  );
};

export default CreateDeliveryFromPO;
