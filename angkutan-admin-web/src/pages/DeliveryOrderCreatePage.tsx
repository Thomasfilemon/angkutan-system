import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import apiClient from "../api/axiosConfig";
import { GeoSearchControl, OpenStreetMapProvider } from "leaflet-geosearch";
import "leaflet-geosearch/dist/geosearch.css";
import InfiniteScroll from "react-infinite-scroll-component";

// Icons (unchanged)
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
  can_create_do: boolean;
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
  customer_name?: string;
  item_name: string;
  vehicle_id: string;
  minimal_load_quantity: string;
  unit: string;
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
  additional_allowance: Allowance[];
  payment_notes: string;
}

interface MarkerType {
  lat: number;
  lng: number;
  title: string;
  type: "load" | "unload";
}

// Map components (unchanged)
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

  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [pos, setPos] = useState<PODetails[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [selectedPO, setSelectedPO] = useState<PODetails | null>(null);
  const limit = 10;

  const [poItems, setPoItems] = useState<string[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [formDataList, setFormDataList] = useState<DOFormData[]>([]);
  const [canCreate, setCanCreate] = useState<boolean>(true);
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

  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] =
    useState<number>(-1);

  const [loadLocationSuggestions, setLoadLocationSuggestions] = useState<
    string[]
  >([]);
  const [unloadLocationSuggestions, setUnloadLocationSuggestions] = useState<
    string[]
  >([]);
  const [showLoadSuggestions, setShowLoadSuggestions] = useState(false);
  const [showUnloadSuggestions, setShowUnloadSuggestions] = useState(false);

  const defaultCenter = { lat: -6.2088, lng: 106.8456 };

  const getUnitDisplay = (unit: string) => {
    const unitMap = { kilogram: "kg", ton: "ton", kubik: "m³" };
    return unitMap[unit as keyof typeof unitMap] || unit;
  };

  const RecenterMap = ({ markers }: { markers: MarkerType[] }) => {
    const map = useMap();

    useEffect(() => {
      if (markers.length === 1) {
        // Center on single marker
        map.setView([markers[0].lat, markers[0].lng], 15);
      } else if (markers.length > 1) {
        // Fit bounds for multiple markers
        const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }, [markers, map]);

    return null;
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

  const calculateAdditionalAllowanceTotal = (formData: DOFormData): number => {
    return formData.additional_allowance.reduce(
      (sum, allowance) => sum + (parseFloat(allowance.amount) || 0),
      0
    );
  };

  const calculateOngkosan = (formData: DOFormData, unit: string): number => {
    if (!formData.unit_price || !formData.minimal_load_quantity) return 0;
    const quantity = parseFloat(formData.minimal_load_quantity);
    const unitPrice = parseFloat(formData.unit_price);
    const totalRevenue = calculateTotalAmount(quantity, unitPrice, unit);
    const operationalCosts =
      (parseFloat(formData.trip_allowance) || 0) +
      calculateAdditionalAllowanceTotal(formData) +
      (parseFloat(formData.gaji) || 0);
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
      customer_name: po.customer_name,
      item_name: items.length === 1 ? items[0] : "",
      vehicle_id: "",
      minimal_load_quantity: "",
      unit: po.unit,
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
      additional_allowance: [],
      payment_notes: "",
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
      const locationResponse = await apiClient.get(
        "/delivery-orders/utils/recent-locations"
      );
      if (locationResponse.data?.success) {
        setLoadLocationSuggestions(
          locationResponse.data.data.load_locations || []
        );
        setUnloadLocationSuggestions(
          locationResponse.data.data.unload_locations || []
        );
      }
    } catch (err) {
      setErrors((prev) => [...prev, "Failed to fetch vehicles."]);
    }
  };

  useEffect(() => {
    if (isStandalone) {
      setSelectedPO(null);
      setPoItems([]);
      setCanCreate(true);
      setFormDataList([
        {
          do_name: "",
          customer_name: "",
          item_name: "",
          vehicle_id: "",
          minimal_load_quantity: "",
          unit: "ton",
          unit_price: "",
          trip_allowance: "",
          gaji: "",
          ongkosan: "",
          load_location: "",
          unload_location: "",
          load_latitude: "",
          load_longitude: "",
          unload_latitude: "",
          unload_longitude: "",
          additional_allowance: [],
          payment_notes: "",
        },
      ]);
      setMarkers([]);

      const fetchVehiclesStandalone = async () => {
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

          // Fetch recent customers for standalone mode
          const customerResponse = await apiClient.get(
            "/delivery-orders/utils/recent-customers"
          );
          if (customerResponse.data?.success) {
            setCustomerSuggestions(customerResponse.data.data);
          }
          const locationResponse = await apiClient.get(
            "/delivery-orders/utils/recent-locations"
          );
          if (locationResponse.data?.success) {
            setLoadLocationSuggestions(
              locationResponse.data.data.load_locations || []
            );
            setUnloadLocationSuggestions(
              locationResponse.data.data.unload_locations || []
            );
          }
        } catch (err) {
          setErrors((prev) => [
            ...prev,
            "Failed to fetch vehicles in standalone mode.",
          ]);
        }
      };
      fetchVehiclesStandalone();
    } else {
      setFormDataList([]);
      setVehicles([]);
    }
  }, [isStandalone]);

  const handleInputChange = (
    index: number,
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    if (!canCreate) return;
    const newFormDataList = [...formDataList];
    newFormDataList[index] = {
      ...newFormDataList[index],
      [e.target.name]: e.target.value,
    };
    setFormDataList(newFormDataList);

    if (isStandalone && e.target.name === "customer_name") {
      setShowSuggestions(!!e.target.value);
    }
    if (e.target.name === "load_location") {
      setShowLoadSuggestions(!!e.target.value);
    }
    if (e.target.name === "unload_location") {
      setShowUnloadSuggestions(!!e.target.value);
    }

    if (
      [
        "minimal_load_quantity",
        "unit_price",
        "trip_allowance",
        "gaji",
        "additional_allowance",
      ].includes(e.target.name)
    ) {
      const unit =
        (isStandalone ? newFormDataList[index].unit : selectedPO?.unit) ??
        "ton";
      newFormDataList[index].ongkosan = calculateOngkosan(
        newFormDataList[index],
        unit
      ).toString();
      setFormDataList([...newFormDataList]);
    }
  };

  const handleSelectSuggestion = (name: string, formIndex: number) => {
    const newFormDataList = [...formDataList];
    newFormDataList[formIndex] = {
      ...newFormDataList[formIndex],
      customer_name: name,
    };
    setFormDataList(newFormDataList);
    setShowSuggestions(false);
  };

  const handleSelectLocationSuggestion = (
    location: string,
    type: "load" | "unload",
    formIndex: number
  ) => {
    const newFormDataList = [...formDataList];
    if (type === "load") {
      newFormDataList[formIndex].load_location = location;
      setShowLoadSuggestions(false);
    } else {
      newFormDataList[formIndex].unload_location = location;
      setShowUnloadSuggestions(false);
    }
    setFormDataList(newFormDataList);
  };

  const handleAllowanceChange = (
    formIndex: number,
    allowanceIndex: number,
    field: keyof Allowance,
    value: string
  ) => {
    if (!canCreate) return;
    const newFormDataList = [...formDataList];
    newFormDataList[formIndex].additional_allowance[allowanceIndex] = {
      ...newFormDataList[formIndex].additional_allowance[allowanceIndex],
      [field]: value,
    };

    // Update payment_notes with all allowances
    let paymentNotes = newFormDataList[formIndex].payment_notes || "";
    // Remove existing allowance lines
    paymentNotes = paymentNotes
      .split("\n")
      .filter((line) => !line.startsWith("Additional Allowance"))
      .join("\n");

    // Append all allowances
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
      isStandalone ? newFormDataList[formIndex].unit : selectedPO?.unit ?? "ton"
    ).toString();
    setFormDataList(newFormDataList);
  };

  const addAllowance = (formIndex: number) => {
    if (!canCreate) return;
    const newFormDataList = [...formDataList];
    const newAllowance = { description: "", amount: "" };
    newFormDataList[formIndex].additional_allowance.push(newAllowance);

    // Update payment_notes with the new allowance (placeholder)
    const currentNotes = newFormDataList[formIndex].payment_notes || "";
    const allowanceText = `Additional Allowance ${newFormDataList[formIndex].additional_allowance.length}: Rp 0 - No description`;
    newFormDataList[formIndex].payment_notes = currentNotes
      ? `${currentNotes}\n${allowanceText}`
      : allowanceText;

    newFormDataList[formIndex].ongkosan = calculateOngkosan(
      newFormDataList[formIndex],
      isStandalone ? newFormDataList[formIndex].unit : selectedPO?.unit ?? "ton"
    ).toString();
    setFormDataList(newFormDataList);
  };

  const removeAllowance = (formIndex: number, allowanceIndex: number) => {
    if (!canCreate) return;
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
      isStandalone ? newFormDataList[formIndex].unit : selectedPO?.unit ?? "ton"
    ).toString();
    setFormDataList(newFormDataList);
  };

  const addForm = () => {
    if (!canCreate) return;
    const lastForm = formDataList[formDataList.length - 1] || {};
    const newForm: DOFormData = {
      do_name: `${lastForm.do_name || "New DO"} - Copy`,
      customer_name: isStandalone ? "" : selectedPO?.customer_name || "",
      item_name: "",
      vehicle_id: "",
      minimal_load_quantity: "",
      unit: isStandalone ? "ton" : selectedPO?.unit || "ton",
      unit_price: "",
      trip_allowance: "",
      gaji: "",
      ongkosan: "",
      load_location: lastForm.load_location || "",
      unload_location: lastForm.unload_location || "",
      load_latitude: lastForm.load_latitude || "",
      load_longitude: lastForm.load_longitude || "",
      unload_latitude: lastForm.unload_latitude || "",
      unload_longitude: lastForm.unload_longitude || "",
      additional_allowance: [],
      payment_notes: "",
    };
    setFormDataList([...formDataList, newForm]);
  };

  const duplicateForm = (index: number) => {
    if (!canCreate) return;
    const currentForm = formDataList[index];
    const newForm: DOFormData = {
      ...currentForm,
      do_name: `${currentForm.do_name} - Copy`,
      additional_allowance: [...currentForm.additional_allowance],
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canCreate) return;
    setLoading(true);
    setErrors([]);

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
      if (isNaN(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity for DO ${formData.do_name}`);
      }

      if (
        !isStandalone &&
        selectedPO &&
        quantity > selectedPO.remaining_quantity
      ) {
        throw new Error(
          `Quantity exceeds PO remaining for DO ${formData.do_name}`
        );
      }

      for (let i = 0; i < formData.additional_allowance.length; i++) {
        const allowance = formData.additional_allowance[i];
        if (!allowance.description) {
          throw new Error(
            `Additional allowance ${i + 1} in DO ${
              formData.do_name
            } is missing a description.`
          );
        }
        const amount = parseFloat(allowance.amount);
        if (isNaN(amount) || amount <= 0) {
          throw new Error(
            `Additional allowance ${i + 1} in DO ${
              formData.do_name
            } has an invalid amount.`
          );
        }
      }

      const unit = isStandalone ? formData.unit : selectedPO?.unit;
      const totalAmount = calculateTotalAmount(
        quantity,
        unitPrice,
        unit ?? "ton"
      );

      // let paymentNotes = formData.payment_notes || "";
      // formData.additional_allowance.forEach((allowance, i) => {
      //   if (allowance.description && allowance.amount) {
      //     const allowanceText = `Additional Allowance ${i + 1}: Rp ${parseFloat(
      //       allowance.amount
      //     ).toLocaleString("id-ID")} - ${allowance.description}`;
      //     paymentNotes = paymentNotes
      //       ? `${paymentNotes}\n${allowanceText}`
      //       : allowanceText;
      //   }
      // });

      return {
        purchase_order_id: isStandalone ? null : selectedPO?.id,
        vehicle_id: parseInt(formData.vehicle_id),
        driver_id: selectedVehicle.driver_id,
        do_name: formData.do_name,
        customer_name: isStandalone
          ? formData.customer_name
          : selectedPO?.customer_name,
        item_name: formData.item_name,
        minimal_load_quantity: quantity,
        unit,
        unit_price: unitPrice,
        total_amount: totalAmount,
        trip_allowance: parseFloat(formData.trip_allowance) || 0,
        additional_allowance: formData.additional_allowance.map((allowance) =>
          parseFloat(allowance.amount)
        ),
        gaji: parseFloat(formData.gaji) || 0,
        ongkosan: parseFloat(formData.ongkosan) || 0,
        load_location: formData.load_location,
        unload_location: formData.unload_location,
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

      <div className="mb-6 bg-gray-100 p-4 rounded-lg">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={isStandalone}
            onChange={(e) => setIsStandalone(e.target.checked)}
            className="form-checkbox h-5 w-5 text-blue-600"
          />
          <span className="text-lg font-medium text-gray-700">
            Standalone Mode (No PO Required)
          </span>
        </label>
        <p className="text-sm text-gray-500 mt-1">
          Enable to create DO without linking to a Purchase Order. Allows free
          input for customer, item, etc.
        </p>
      </div>

      {!isStandalone && !selectedPO ? (
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
          {!isStandalone && (
            <button
              onClick={() => setSelectedPO(null)}
              className="mb-4 text-blue-500 hover:underline"
            >
              ← Change PO
            </button>
          )}

          {!isStandalone && selectedPO && (
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
          )}

          {!canCreate && !isStandalone && (
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

                    {isStandalone && (
                      <div className="mt-4 relative">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Customer Name *
                        </label>
                        <input
                          type="text"
                          name="customer_name"
                          value={formData.customer_name || ""}
                          onChange={(e) => handleInputChange(index, e)}
                          onFocus={() =>
                            formData.customer_name && setShowSuggestions(true)
                          }
                          onBlur={() =>
                            setTimeout(() => setShowSuggestions(false), 150)
                          } // Delay to allow click
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          placeholder="Enter customer name"
                          required
                          autoComplete="off"
                        />
                        {/* --- SUGGESTION BOX --- */}
                        {showSuggestions &&
                          customerSuggestions.length > 0 &&
                          currentFormIndex === index && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                              {customerSuggestions
                                .filter((suggestion) =>
                                  suggestion
                                    .toLowerCase()
                                    .includes(
                                      (
                                        formData.customer_name || ""
                                      ).toLowerCase()
                                    )
                                )
                                .map((suggestion, sIndex) => (
                                  <div
                                    key={sIndex}
                                    onMouseDown={() =>
                                      handleSelectSuggestion(suggestion, index)
                                    } // Use onMouseDown to fire before onBlur
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 cursor-pointer"
                                  >
                                    {suggestion}
                                  </div>
                                ))}
                            </div>
                          )}
                      </div>
                    )}

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Item Name *
                      </label>
                      {isStandalone ? (
                        <input
                          type="text"
                          name="item_name"
                          value={formData.item_name}
                          onChange={(e) => handleInputChange(index, e)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          placeholder="Enter item name"
                          required
                        />
                      ) : (
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
                      )}
                      {poItems.length === 0 && !isStandalone && (
                        <p className="text-sm text-red-600 mt-1">
                          No items available in this PO.
                        </p>
                      )}
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimal Load Quantity (
                        {getUnitDisplay(
                          isStandalone
                            ? formData.unit
                            : selectedPO?.unit ?? "ton"
                        )}
                        ) *
                      </label>
                      <input
                        disabled={!canCreate}
                        type="number"
                        name="minimal_load_quantity"
                        step="0.01"
                        max={
                          !isStandalone
                            ? selectedPO?.remaining_quantity
                            : undefined
                        }
                        value={formData.minimal_load_quantity}
                        onChange={(e) => handleInputChange(index, e)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                          !canCreate ? "bg-gray-100 cursor-not-allowed" : ""
                        }`}
                        placeholder={
                          !isStandalone
                            ? `Maximum: ${
                                selectedPO?.remaining_quantity ?? ""
                              } ${getUnitDisplay(selectedPO?.unit ?? "ton")}`
                            : "Enter quantity"
                        }
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {isStandalone
                          ? "No limits - enter freely"
                          : selectedPO?.unit === "ton" &&
                            "💡 Enter in tons (price per ton)"}
                        {selectedPO?.unit === "kubik" &&
                          "💡 Enter in cubic meters (volume-based)"}
                        {selectedPO?.unit === "kilogram" &&
                          "💡 Enter in kilograms (weight-based)"}
                      </p>
                    </div>

                    {isStandalone && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Unit *
                        </label>
                        <select
                          name="unit"
                          value={formData.unit}
                          onChange={(e) => handleInputChange(index, e)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                        >
                          <option value="kilogram">Kg</option>
                          <option value="ton">Ton</option>
                          <option value="kubik">m³</option>
                        </select>
                      </div>
                    )}

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Unit Price (Rp/
                        {getUnitDisplay(
                          isStandalone
                            ? formData.unit
                            : selectedPO?.unit ?? "ton"
                        )}
                        ) *
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
                          isStandalone
                            ? formData.unit
                            : selectedPO?.unit ?? "ton"
                        )}`}
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        💡 Set the negotiated price per{" "}
                        {getUnitDisplay(
                          isStandalone
                            ? formData.unit
                            : selectedPO?.unit ?? "ton"
                        )}{" "}
                        for this delivery
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
                      {formData.vehicle_id &&
                        getSelectedVehicle(formData.vehicle_id) && (
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
                              className={`w-2/3 px-3 py-2 border border-gray-300 rounded-md ${
                                !canCreate
                                  ? "bg-gray-100 cursor-not-allowed"
                                  : ""
                              }`}
                              disabled={!canCreate}
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
                              className={`w-1/3 px-3 py-2 border border-gray-300 rounded-md ${
                                !canCreate
                                  ? "bg-gray-100 cursor-not-allowed"
                                  : ""
                              }`}
                              disabled={!canCreate}
                              required
                            />
                            <button
                              type="button"
                              onClick={() =>
                                removeAllowance(index, allowanceIndex)
                              }
                              className={`text-red-500 hover:text-red-700 ${
                                !canCreate
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                              disabled={!canCreate}
                            >
                              ×
                            </button>
                          </div>
                        )
                      )}
                      <button
                        type="button"
                        onClick={() => addAllowance(index)}
                        className={`mt-2 text-blue-500 hover:text-blue-700 text-sm ${
                          !canCreate ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        disabled={!canCreate}
                      >
                        + Add Allowance
                      </button>
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

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Notes
                      </label>
                      <textarea
                        disabled={!canCreate}
                        name="payment_notes"
                        value={formData.payment_notes}
                        onChange={(e) => handleInputChange(index, e)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                          !canCreate ? "bg-gray-100 cursor-not-allowed" : ""
                        }`}
                        rows={4}
                        placeholder="Additional payment notes, including allowance descriptions..."
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
                              {formData.minimal_load_quantity}{" "}
                              {getUnitDisplay(
                                isStandalone
                                  ? formData.unit
                                  : selectedPO?.unit ?? "ton"
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Unit Price:</span>
                            <span>
                              Rp{" "}
                              {parseFloat(formData.unit_price).toLocaleString(
                                "id-ID"
                              )}
                              /
                              {getUnitDisplay(
                                isStandalone
                                  ? formData.unit
                                  : selectedPO?.unit ?? "ton"
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between text-blue-600">
                            <span>Calculation:</span>
                            <span>
                              {formData.minimal_load_quantity}{" "}
                              {getUnitDisplay(
                                isStandalone
                                  ? formData.unit
                                  : selectedPO?.unit ?? "ton"
                              )}{" "}
                              × Rp{" "}
                              {parseFloat(formData.unit_price).toLocaleString(
                                "id-ID"
                              )}
                              /
                              {getUnitDisplay(
                                isStandalone
                                  ? formData.unit
                                  : selectedPO?.unit ?? "ton"
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between font-semibold border-t pt-1">
                            <span>Total Revenue:</span>
                            <span>
                              Rp{" "}
                              {calculateTotalAmount(
                                parseFloat(formData.minimal_load_quantity) || 0,
                                parseFloat(formData.unit_price) || 0,
                                isStandalone
                                  ? formData.unit
                                  : selectedPO?.unit ?? "ton"
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
                                {parseFloat(
                                  allowance.amount || "0"
                                ).toLocaleString("id-ID")}
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
                              {parseFloat(
                                formData.ongkosan || "0"
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
                      <div className="relative">
                        <textarea
                          disabled={!canCreate}
                          name="load_location"
                          value={formData.load_location}
                          onChange={(e) => handleInputChange(index, e)}
                          onFocus={() =>
                            formData.load_location &&
                            setShowLoadSuggestions(true)
                          }
                          onBlur={() =>
                            setTimeout(() => setShowLoadSuggestions(false), 150)
                          }
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                            !canCreate ? "bg-gray-100 cursor-not-allowed" : ""
                          }`}
                          rows={3}
                          required
                          placeholder="Enter or select on map"
                          autoComplete="off"
                        />
                        {showLoadSuggestions &&
                          loadLocationSuggestions.length > 0 &&
                          currentFormIndex === index && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                              {loadLocationSuggestions
                                .filter((loc) =>
                                  loc
                                    .toLowerCase()
                                    .includes(
                                      formData.load_location.toLowerCase()
                                    )
                                )
                                .map((loc, sIndex) => (
                                  <div
                                    key={sIndex}
                                    onMouseDown={() =>
                                      handleSelectLocationSuggestion(
                                        loc,
                                        "load",
                                        index
                                      )
                                    }
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 cursor-pointer"
                                  >
                                    {loc}
                                  </div>
                                ))}
                            </div>
                          )}
                      </div>
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
                      <div className="relative">
                        <textarea
                          disabled={!canCreate}
                          name="unload_location"
                          value={formData.unload_location}
                          onChange={(e) => handleInputChange(index, e)}
                          onFocus={() =>
                            formData.unload_location &&
                            setShowUnloadSuggestions(true)
                          }
                          onBlur={() =>
                            setTimeout(
                              () => setShowUnloadSuggestions(false),
                              150
                            )
                          }
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
                            !canCreate ? "bg-gray-100 cursor-not-allowed" : ""
                          }`}
                          rows={3}
                          required
                          placeholder="Enter or select on map"
                          autoComplete="off"
                        />
                        {showUnloadSuggestions &&
                          unloadLocationSuggestions.length > 0 &&
                          currentFormIndex === index && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                              {unloadLocationSuggestions
                                .filter((loc) =>
                                  loc
                                    .toLowerCase()
                                    .includes(
                                      formData.unload_location.toLowerCase()
                                    )
                                )
                                .map((loc, sIndex) => (
                                  <div
                                    key={sIndex}
                                    onMouseDown={() =>
                                      handleSelectLocationSuggestion(
                                        loc,
                                        "unload",
                                        index
                                      )
                                    }
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 cursor-pointer"
                                  >
                                    {loc}
                                  </div>
                                ))}
                            </div>
                          )}
                      </div>
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
                  disabled={!canCreate}
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
                        (f) =>
                          !f.vehicle_id ||
                          !f.item_name ||
                          !f.unit_price ||
                          f.additional_allowance.some(
                            (a) =>
                              !a.description ||
                              !a.amount ||
                              parseFloat(a.amount) <= 0
                          )
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
                    <RecenterMap markers={markers} />
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
