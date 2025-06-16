import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import apiClient from "../../src/services/api";
import { FontAwesome5 } from "@expo/vector-icons";

interface DeliveryOrder {
  id: number;
  do_number: string;
  customer_name: string;
  item_name: string;
  quantity: number;
  status: string;
  driver_name?: string;
  vehicle?: { license_plate: string };
  surat_jalan_url?: string;
}

export default function AdminIndex() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<DeliveryOrder[]>("/delivery-orders");
      setOrders(res.data);
      setError(null);
    } catch (err: any) {
      setError("Gagal memuat data trip.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const renderItem = ({ item }: { item: DeliveryOrder }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.doNumber}>{item.do_number}</Text>
        <Text style={styles.status}>{item.status.toUpperCase()}</Text>
      </View>
      <Text style={styles.customer}>{item.customer_name}</Text>
      <Text style={styles.item}>
        {item.item_name} - {item.quantity} Ton
      </Text>
      <Text style={styles.driver}>Driver: {item.driver_name || "-"}</Text>
      <Text style={styles.vehicle}>
        Mobil: {item.vehicle?.license_plate || "-"}
      </Text>
      {item.surat_jalan_url && (
        <Text style={styles.suratJalan}>
          Surat Jalan: {item.surat_jalan_url}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Admin Dashboard</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/(admin)/create-trip")}
        >
          <FontAwesome5 name="plus" size={20} color="white" />
          <Text style={styles.addButtonText}>Buat Trip Baru</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator
          size="large"
          color="#2563eb"
          style={{ marginTop: 40 }}
        />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 30 }}
          ListEmptyComponent={<Text style={styles.empty}>Belum ada trip.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6f8" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  title: { fontSize: 22, fontWeight: "bold" },
  addButton: {
    flexDirection: "row",
    backgroundColor: "#2563eb",
    padding: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  addButtonText: { color: "white", marginLeft: 8, fontWeight: "bold" },
  card: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
    padding: 16,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  doNumber: { fontWeight: "bold", fontSize: 16 },
  status: { fontWeight: "bold", color: "#2563eb" },
  customer: { fontSize: 15, marginBottom: 2 },
  item: { color: "#555", marginBottom: 2 },
  driver: { color: "#888", marginBottom: 2 },
  vehicle: { color: "#888", marginBottom: 2 },
  suratJalan: { color: "#888", fontStyle: "italic", fontSize: 12 },
  error: { color: "red", textAlign: "center", marginTop: 20 },
  empty: { textAlign: "center", marginTop: 40, color: "#888" },
});
