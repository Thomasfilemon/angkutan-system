import React, { useEffect, useState, useCallback, ChangeEvent } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import apiClient, { getPoDetailsForNewDo } from "../../src/services/api";
import MapSelector from "../../components/MapSelector";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { FontAwesome5 } from "@expo/vector-icons";

interface Driver {
  id: number;
  username: string;
  driverProfile?: { full_name: string };
}
interface Vehicle {
  id: number;
  license_plate: string;
  type: string;
}
interface PurchaseOrder {
  id: number;
  po_number: string;
}
interface PoDetails {
  customer_name: string;
  item_name: string;
  total_quantity: number;
  delivered_quantity: number;
  remaining_quantity: number;
  generated_do_number: string;
  load_location: string;
  unload_location: string;
  has_location_data: boolean;
}
interface Coordinates {
  latitude: number;
  longitude: number;
  address?: string;
}

export default function CreateTrip() {
  const router = useRouter();

  const [masterData, setMasterData] = useState<{
    drivers: Driver[];
    vehicles: Vehicle[];
    purchaseOrders: PurchaseOrder[];
  }>({ drivers: [], vehicles: [], purchaseOrders: [] });

  const [form, setForm] = useState({
    purchase_order_id: "",
    do_number: "",
    customer_name: "",
    item_name: "",
    quantity: "",
    driver_id: "",
    vehicle_id: "",
    trip_allowance: "",
    load_location: "",
    unload_location: "",
    load_latitude: "",
    load_longitude: "",
    unload_latitude: "",
    unload_longitude: "",
  });

  const [poDetails, setPoDetails] = useState<PoDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [mapSelectorType, setMapSelectorType] = useState<
    "loading" | "unloading"
  >("loading");

  // Fetch drivers, vehicles, and PO
  const fetchMasterData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [driversRes, vehiclesRes, poRes] = await Promise.all([
        apiClient.get("/users?role=driver&status=available"),
        apiClient.get("/vehicles?status=available"),
        apiClient.get("/purchase-orders"), // Asumsikan endpoint ini mengembalikan daftar PO
      ]);
      setMasterData({
        drivers: driversRes.data,
        vehicles: vehiclesRes.data,
        purchaseOrders: poRes.data,
      });
    } catch (err) {
      setError("Gagal memuat data master. Coba lagi nanti.");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMasterData();
    }, [])
  );

  const handlePoChange = async (poId: string) => {
    setForm((prev) => ({
      ...prev,
      purchase_order_id: poId,
      do_number: "",
      customer_name: "",
      item_name: "",
      load_location: "",
      unload_location: "",
      load_latitude: "",
      load_longitude: "",
      unload_latitude: "",
      unload_longitude: "",
    }));
    setPoDetails(null);
    if (!poId) return;

    setLoadingDetails(true);
    setError(null);
    try {
      console.log(`Fetching PO details for ID: ${poId}`);
      const { data } = await getPoDetailsForNewDo(poId);
      console.log("Received PO details:", data);

      setPoDetails(data);
      // Auto-fill form fields
      setForm((prev) => ({
        ...prev,
        do_number: data.generated_do_number,
        customer_name: data.customer_name,
        item_name: data.item_name,
        // === AUTO-FILL LOKASI DARI PO ===
        load_location: data.load_location || "",
        unload_location: data.unload_location || "",
        load_latitude: data.load_latitude ? data.load_latitude.toString() : "",
        load_longitude: data.load_longitude
          ? data.load_longitude.toString()
          : "",
        unload_latitude: data.unload_latitude
          ? data.unload_latitude.toString()
          : "",
        unload_longitude: data.unload_longitude
          ? data.unload_longitude.toString()
          : "",
      }));
    } catch (err) {
      console.error("Error fetching PO details:", err);
      setError("Gagal mengambil detail Purchase Order.");
    } finally {
      setLoadingDetails(false);
    }
  };

  // Function untuk handle map selection
  const handleMapLocationSelect = (location: Coordinates) => {
    if (mapSelectorType === "loading") {
      setForm((prev) => ({
        ...prev,
        load_location:
          location.address || `${location.latitude}, ${location.longitude}`,
        load_latitude: location.latitude.toString(),
        load_longitude: location.longitude.toString(),
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        unload_location:
          location.address || `${location.latitude}, ${location.longitude}`,
        unload_latitude: location.latitude.toString(),
        unload_longitude: location.longitude.toString(),
      }));
    }
  };

  const handleChange = (name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // File picker for web
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    setError(null);

    if (parseFloat(form.quantity) > (poDetails?.remaining_quantity ?? 0)) {
      Alert.alert(
        "Validasi Gagal",
        "Kuantitas DO tidak boleh melebihi sisa kuantitas di PO."
      );
      return;
    }
    if (
      !form.do_number ||
      !form.customer_name ||
      !form.item_name ||
      !form.quantity ||
      !form.purchase_order_id ||
      !form.driver_id ||
      !form.vehicle_id ||
      !form.trip_allowance ||
      !form.load_location ||
      !form.unload_location
    ) {
      setError("Semua field wajib diisi.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) =>
        formData.append(key, value)
      );
      if (file) formData.append("surat_jalan", file);

      await apiClient.post("/delivery-orders", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      router.replace("/(admin)");
    } catch (err: any) {
      console.error("Submit error:", err);
      setError("Gagal membuat trip. " + (err.response?.data?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text>Memuat data...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Buat Trip/Delivery Order Baru</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Informasi Purchase Order</Text>
        <Text style={styles.label}>Pilih Purchase Order</Text>
        <View style={styles.select}>
          <select
            value={form.purchase_order_id}
            onChange={(e) => handlePoChange(e.target.value)}
          >
            <option value="">-- Pilih PO --</option>
            {masterData.purchaseOrders.map((po) => (
              <option key={po.id} value={po.id}>
                {po.po_number}
              </option>
            ))}
          </select>
        </View>

        {loadingDetails && <ActivityIndicator style={{ marginVertical: 10 }} />}

        {poDetails && (
          <View style={styles.autoFilledContainer}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nomor DO</Text>
              <Text style={styles.infoValue}>{form.do_number}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Customer</Text>
              <Text style={styles.infoValue}>{form.customer_name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Item</Text>
              <Text style={styles.infoValue}>{form.item_name}</Text>
            </View>
            {/* === TAMPILKAN STATUS LOKASI === */}
            <View style={styles.locationStatusContainer}>
              <Text style={styles.locationStatusLabel}>Status Lokasi:</Text>
              <Text
                style={[
                  styles.locationStatusValue,
                  {
                    color: poDetails.has_location_data ? "#28a745" : "#ffc107",
                  },
                ]}
              >
                {poDetails.has_location_data
                  ? "✓ Lokasi tersedia dari PO"
                  : "⚠ Lokasi perlu diisi manual"}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* === SECTION 2: DETAIL MUATAN === */}
      {poDetails && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Detail Muatan</Text>
          <View style={styles.quantityInfo}>
            <Text>
              Sisa di PO:{" "}
              <Text style={{ fontWeight: "bold" }}>
                {poDetails.remaining_quantity.toLocaleString("id-ID")} Ton
              </Text>
            </Text>
          </View>
          <Text style={styles.label}>Kuantitas Muatan (Ton)</Text>
          <TextInput
            style={styles.input}
            value={form.quantity}
            onChangeText={(v) => handleChange("quantity", v)}
            placeholder={`Max: ${poDetails.remaining_quantity}`}
            keyboardType="numeric"
          />
        </View>
      )}

      {/* === SECTION 3: LOKASI (BARU) === */}
      {poDetails && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>3. Lokasi Pengiriman</Text>

          {/* LOKASI LOADING DENGAN MAP BUTTON */}
          <View style={styles.locationInputContainer}>
            <Text style={styles.label}>Lokasi Loading (Muat Barang) *</Text>
            <View style={styles.locationInputRow}>
              <TextInput
                style={[styles.input, styles.locationInput]}
                value={form.load_location}
                onChangeText={(v) => handleChange("load_location", v)}
                placeholder="Alamat lokasi loading"
                multiline
              />
              <TouchableOpacity
                style={styles.mapButton}
                onPress={() => {
                  setMapSelectorType("loading");
                  setShowMapSelector(true);
                }}
              >
                <FontAwesome5 name="map-marker-alt" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            {form.load_latitude && form.load_longitude && (
              <Text style={styles.coordinateText}>
                📍 {parseFloat(form.load_latitude).toFixed(6)},{" "}
                {parseFloat(form.load_longitude).toFixed(6)}
              </Text>
            )}
          </View>

          {/* LOKASI UNLOADING DENGAN MAP BUTTON */}
          <View style={styles.locationInputContainer}>
            <Text style={styles.label}>
              Lokasi Unloading (Bongkar Barang) *
            </Text>
            <View style={styles.locationInputRow}>
              <TextInput
                style={[styles.input, styles.locationInput]}
                value={form.unload_location}
                onChangeText={(v) => handleChange("unload_location", v)}
                placeholder="Alamat lokasi unloading"
                multiline
              />
              <TouchableOpacity
                style={styles.mapButton}
                onPress={() => {
                  setMapSelectorType("unloading");
                  setShowMapSelector(true);
                }}
              >
                <FontAwesome5 name="map-marker-alt" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            {form.unload_latitude && form.unload_longitude && (
              <Text style={styles.coordinateText}>
                📍 {parseFloat(form.unload_latitude).toFixed(6)},{" "}
                {parseFloat(form.unload_longitude).toFixed(6)}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* === SECTION 4: PENUGASAN === */}
      {poDetails && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>4. Penugasan Driver & Kendaraan</Text>

          <Text style={styles.label}>Driver</Text>
          <View style={styles.select}>
            <select
              value={form.driver_id}
              onChange={(e) => handleChange("driver_id", e.target.value)}
            >
              <option value="">
                {masterData.drivers.length === 0
                  ? "Tidak ada driver tersedia"
                  : "Pilih Driver"}
              </option>
              {masterData.drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.driverProfile?.full_name || d.username}
                </option>
              ))}
            </select>
          </View>
          {masterData.drivers.length === 0 && (
            <Text style={{ color: "red", marginBottom: 8 }}>
              Semua Driver Sibuk. Tidak ada driver yang tersedia untuk sekarang.
            </Text>
          )}

          <Text style={styles.label}>Mobil</Text>
          <View style={styles.select}>
            <select
              value={form.vehicle_id}
              onChange={(e) => handleChange("vehicle_id", e.target.value)}
            >
              <option value="">Pilih Mobil</option>
              {masterData.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.license_plate} ({v.type})
                </option>
              ))}
            </select>
          </View>

          <Text style={styles.label}>Uang Jalan (Rp)</Text>
          <TextInput
            style={styles.input}
            value={form.trip_allowance}
            onChangeText={(v) => handleChange("trip_allowance", v)}
            placeholder="Contoh: 2500000"
            keyboardType="numeric"
          />
        </View>
      )}

      {/* === SECTION 5: DOKUMEN === */}
      {poDetails && (
        <View style={styles.card}>
          <Text style={styles.label}>Upload Surat Jalan</Text>
          {Platform.OS === "web" ? (
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
            />
          ) : (
            <Text style={{ color: "#888" }}>
              Upload file hanya tersedia di web.
            </Text>
          )}
        </View>
      )}

      <MapSelector
        visible={showMapSelector}
        title={`Pilih Lokasi ${
          mapSelectorType === "loading" ? "Loading" : "Unloading"
        }`}
        initialLocation={
          mapSelectorType === "loading"
            ? form.load_latitude && form.load_longitude
              ? {
                  latitude: parseFloat(form.load_latitude),
                  longitude: parseFloat(form.load_longitude),
                  address: form.load_location,
                }
              : undefined
            : form.unload_latitude && form.unload_longitude
            ? {
                latitude: parseFloat(form.unload_latitude),
                longitude: parseFloat(form.unload_longitude),
                address: form.unload_location,
              }
            : undefined
        }
        onLocationSelect={handleMapLocationSelect}
        onClose={() => setShowMapSelector(false)}
      />

      <TouchableOpacity
        style={[
          styles.submitButton,
          (!poDetails || loading) && styles.disabledButton,
        ]}
        onPress={handleSubmit}
        disabled={!poDetails || loading}
      >
        <Text style={styles.submitButtonText}>
          {loading ? "Menyimpan..." : "Simpan Delivery Order"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f0f2f5", flexGrow: 1 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#1a202c",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#2d3748",
  },
  label: { fontSize: 14, fontWeight: "500", color: "#4a5568", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e0",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  textArea: { minHeight: 60, textAlignVertical: "top" },
  select: {
    borderWidth: 1,
    borderColor: "#cbd5e0",
    borderRadius: 6,
    backgroundColor: "#fff",
    padding: 4,
  },
  autoFilledContainer: {
    marginTop: 12,
    backgroundColor: "#f7fafc",
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  infoLabel: { color: "#718096" },
  infoValue: { fontWeight: "600", color: "#2d3748" },
  locationInputContainer: {
    marginBottom: 16,
  },
  locationInputRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  locationInput: {
    flex: 1,
    marginRight: 8,
    minHeight: 60,
  },
  mapButton: {
    backgroundColor: "#e74c3c",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 60,
  },
  coordinateText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    fontStyle: "italic",
  },
  quantityInfo: {
    padding: 10,
    backgroundColor: "#e6f7ff",
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#91d5ff",
  },
  locationStatusContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  locationStatusLabel: { color: "#718096", fontSize: 12 },
  locationStatusValue: { fontSize: 12, fontWeight: "600" },
  error: {
    color: "#e53e3e",
    marginBottom: 10,
    backgroundColor: "#fed7d7",
    padding: 10,
    borderRadius: 6,
  },
  submitButton: {
    backgroundColor: "#3182ce",
    padding: 14,
    borderRadius: 8,
    marginTop: 24,
    alignItems: "center",
  },
  submitButtonText: { color: "white", fontWeight: "bold", fontSize: 16 },
  disabledButton: { backgroundColor: "#a0aec0" },
});
