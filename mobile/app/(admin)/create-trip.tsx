import React, { useState, useCallback } from "react";
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
import { Picker } from "@react-native-picker/picker";
import apiClient, { getPoDetailsForNewDo } from "../../src/services/api";
import MapSelector from "../../components/MapSelector"; // INI GAK ERROR, CUMAN VSCODE AJA YANG OON
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
    minimal_load_quantity: "",
    driver_id: "",
    vehicle_id: "",
    trip_allowance: "",
    gaji: "",
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
        apiClient.get("/purchase-orders"),
      ]);
      setMasterData({
        drivers: driversRes.data,
        vehicles: vehiclesRes.data,
        purchaseOrders: poRes.data,
      });
    } catch (err) {
      console.error("Error fetching master data:", err);
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

  const handleSubmit = async () => {
    setError(null);

    if (
      parseFloat(form.minimal_load_quantity) >
      (poDetails?.remaining_quantity ?? 0)
    ) {
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
      !form.minimal_load_quantity ||
      !form.purchase_order_id ||
      !form.driver_id ||
      !form.vehicle_id ||
      !form.trip_allowance ||
      !form.gaji ||
      !form.load_location ||
      !form.unload_location
    ) {
      setError("Semua field wajib diisi.");
      return;
    }
    console.log("Form data before submit:", form); // Debug log

    setLoading(true);
    try {
      const formData = new FormData();

      // Append semua field
      Object.entries(form).forEach(([key, value]) =>
        formData.append(key, value)
      );
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

  // RENDER DI SINI:
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Buat Trip/Delivery Order Baru</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Informasi Purchase Order</Text>
        <Text style={styles.label}>Pilih Purchase Order</Text>
        <View style={styles.select}>
          {Platform.OS === "web" ? (
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
          ) : (
            <Picker
              selectedValue={form.purchase_order_id}
              onValueChange={(itemValue) => handlePoChange(itemValue)}
              style={{ width: "100%" }}
            >
              <Picker.Item label="-- Pilih PO --" value="" />
              {masterData.purchaseOrders.map((po) => (
                <Picker.Item key={po.id} label={po.po_number} value={po.id} />
              ))}
            </Picker>
          )}
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
          <Text style={styles.label}>Minimal Kuantitas Muatan (Ton)</Text>
          <TextInput
            style={styles.input}
            value={form.minimal_load_quantity}
            onChangeText={(v) => handleChange("minimal_load_quantity", v)}
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
            {Platform.OS === "web" ? (
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
            ) : (
              <Picker
                selectedValue={form.driver_id}
                onValueChange={(itemValue) =>
                  handleChange("driver_id", itemValue)
                }
                style={{ width: "100%" }}
              >
                <Picker.Item
                  label={
                    masterData.drivers.length === 0
                      ? "Tidak ada driver tersedia"
                      : "Pilih Driver"
                  }
                  value=""
                />
                {masterData.drivers.map((d) => (
                  <Picker.Item
                    key={d.id}
                    label={d.driverProfile?.full_name || d.username}
                    value={d.id}
                  />
                ))}
              </Picker>
            )}
          </View>
          {masterData.drivers.length === 0 && (
            <Text style={{ color: "red", marginBottom: 8 }}>
              Semua Driver Sibuk. Tidak ada driver yang tersedia untuk sekarang.
            </Text>
          )}

          <Text style={styles.label}>Mobil</Text>
          <View style={styles.select}>
            {Platform.OS === "web" ? (
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
            ) : (
              <Picker
                selectedValue={form.vehicle_id}
                onValueChange={(itemValue) =>
                  handleChange("vehicle_id", itemValue)
                }
                style={{ width: "100%" }}
              >
                <Picker.Item
                  label={
                    masterData.vehicles.length === 0
                      ? "Tidak ada mobil tersedia"
                      : "Pilih Mobil"
                  }
                  value=""
                />
                {masterData.vehicles.map((v) => (
                  <Picker.Item
                    key={v.id}
                    label={`${v.license_plate} (${v.type})`}
                    value={v.id}
                  />
                ))}
              </Picker>
            )}
          </View>

          <View style={styles.financialSection}>
            <Text style={styles.sectionTitle}>💰 Finansial</Text>

            <Text style={styles.label}>Uang Jalan - Operasional (Rp) *</Text>
            <TextInput
              style={styles.input}
              value={form.trip_allowance}
              onChangeText={(v) => handleChange("trip_allowance", v)}
              placeholder="Contoh: 2500000 (untuk bensin, tol, dll)"
              keyboardType="numeric"
            />

            <Text style={styles.label}>Gaji Driver (Rp) *</Text>
            <TextInput
              style={styles.input}
              value={form.gaji}
              onChangeText={(v) => handleChange("gaji", v)}
              placeholder="Contoh: 1500000 (untuk payroll internal)"
              keyboardType="numeric"
            />

            <View style={styles.infoContainer}>
              <FontAwesome5 name="info-circle" size={16} color="#666" />
              <Text style={styles.infoText}>
                Data gaji disimpan untuk keperluan payroll bulanan dan tidak
                ditampilkan ke driver.
              </Text>
            </View>

            {/* Financial Summary */}
            {form.trip_allowance && form.gaji && (
              <View style={styles.financialSummary}>
                <Text style={styles.summaryTitle}>
                  Ringkasan Finansial (Admin View):
                </Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    Uang Operasional (Visible to Driver):
                  </Text>
                  <Text style={styles.summaryValue}>
                    Rp{" "}
                    {Number(form.trip_allowance || 0).toLocaleString("id-ID")}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>
                    Gaji Driver (Internal Only):
                  </Text>
                  <Text style={[styles.summaryValue, { fontStyle: "italic" }]}>
                    Rp {Number(form.gaji || 0).toLocaleString("id-ID")}
                  </Text>
                </View>
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total Cost (Internal):</Text>
                  <Text style={styles.totalValue}>
                    Rp{" "}
                    {(
                      Number(form.trip_allowance || 0) + Number(form.gaji || 0)
                    ).toLocaleString("id-ID")}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.infoContainer}>
            <FontAwesome5 name="info-circle" size={16} color="#3498db" />
            <Text style={styles.infoText}>
              Driver akan menginput berat muatan aktual dan mengupload foto
              surat jalan saat berangkat dari lokasi muat.
            </Text>
          </View>
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
        onPress={() => {
          console.log("Button pressed!"); // Debug log
          handleSubmit();
        }}
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
  // Financial Section
  financialSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2d3748",
    marginBottom: 12,
  },
  financialSummary: {
    backgroundColor: "#f7fafc",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2d3748",
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  summaryLabel: {
    fontSize: 13,
    color: "#4a5568",
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "500",
    color: "#2d3748",
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e0",
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2d3748",
  },
  totalValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#3182ce",
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
  infoContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#e6f7ff",
    borderRadius: 6,
    padding: 10,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#91d5ff",
  },
  infoText: {
    flex: 1,
    color: "#2d3748",
    fontSize: 13,
    marginLeft: 8,
  },
});
