import React, { useEffect, useState, ChangeEvent } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import apiClient from "../../src/services/api";
import { useRouter } from "expo-router";

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

export default function CreateTrip() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [form, setForm] = useState({
    do_number: "",
    customer_name: "",
    item_name: "",
    quantity: "",
    purchase_order_id: "",
    driver_id: "",
    vehicle_id: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch drivers, vehicles, and PO
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [driversRes, vehiclesRes, poRes] = await Promise.all([
          apiClient.get("/users?role=driver&status=available"),
          apiClient.get("/vehicles?status=available"),
          apiClient.get("/purchase-orders"),
        ]);
        setDrivers(driversRes.data);
        setVehicles(vehiclesRes.data);
        setPurchaseOrders(poRes.data);
      } catch (err) {
        setError("Gagal memuat data master.");
      }
    };
    fetchData();
  }, []);

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
    if (
      !form.do_number ||
      !form.customer_name ||
      !form.item_name ||
      !form.quantity ||
      !form.purchase_order_id ||
      !form.driver_id ||
      !form.vehicle_id
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
      setError("Gagal membuat trip. " + (err.response?.data?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Buat Trip/Delivery Order Baru</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.label}>DO Number</Text>
      <TextInput
        style={styles.input}
        value={form.do_number}
        onChangeText={(v) => handleChange("do_number", v)}
        placeholder="Nomor DO"
      />

      <Text style={styles.label}>Customer</Text>
      <TextInput
        style={styles.input}
        value={form.customer_name}
        onChangeText={(v) => handleChange("customer_name", v)}
        placeholder="Nama Customer"
      />

      <Text style={styles.label}>Item</Text>
      <TextInput
        style={styles.input}
        value={form.item_name}
        onChangeText={(v) => handleChange("item_name", v)}
        placeholder="Nama Barang"
      />

      <Text style={styles.label}>Quantity (Ton)</Text>
      <TextInput
        style={styles.input}
        value={form.quantity}
        onChangeText={(v) => handleChange("quantity", v)}
        placeholder="Jumlah"
        keyboardType="numeric"
      />

      <Text style={styles.label}>Purchase Order</Text>
      <View style={styles.select}>
        <select
          value={form.purchase_order_id}
          onChange={(e) => handleChange("purchase_order_id", e.target.value)}
        >
          <option value="">Pilih PO</option>
          {purchaseOrders.map((po) => (
            <option key={po.id} value={po.id}>
              {po.po_number}
            </option>
          ))}
        </select>
      </View>

      <Text style={styles.label}>Driver</Text>
      <View style={styles.select}>
        <select
          value={form.driver_id}
          onChange={(e) => handleChange("driver_id", e.target.value)}
        >
          <option value="">Pilih Driver</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.driverProfile?.full_name || d.username}
            </option>
          ))}
        </select>
      </View>

      <Text style={styles.label}>Mobil</Text>
      <View style={styles.select}>
        <select
          value={form.vehicle_id}
          onChange={(e) => handleChange("vehicle_id", e.target.value)}
        >
          <option value="">Pilih Mobil</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.license_plate} ({v.type})
            </option>
          ))}
        </select>
      </View>

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

      <TouchableOpacity
        style={styles.submitButton}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.submitButtonText}>
          {loading ? "Menyimpan..." : "Simpan Trip"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#fff", flexGrow: 1 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 18 },
  label: { marginTop: 12, marginBottom: 4, fontWeight: "bold" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    backgroundColor: "#f9f9f9",
  },
  select: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    backgroundColor: "#f9f9f9",
    marginBottom: 4,
  },
  error: { color: "red", marginBottom: 10 },
  submitButton: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 8,
    marginTop: 24,
    alignItems: "center",
  },
  submitButtonText: { color: "white", fontWeight: "bold", fontSize: 16 },
});
