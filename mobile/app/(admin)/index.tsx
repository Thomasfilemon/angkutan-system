// mobile/app/(admin)/index.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import apiClient from "../../src/services/api";
import { FontAwesome5 } from "@expo/vector-icons";

interface DeliveryOrder {
  id: number;
  do_number: string;
  customer_name: string;
  item_name: string;
  minimal_load_quantity: number;
  actual_load_quantity?: number;
  status: string;
  trip_allowance: number;
  created_at: string;
  driver?: {
    driverProfile?: { full_name?: string };
    username: string;
  };
  vehicle?: {
    license_plate: string;
    type: string;
  };
  purchaseOrder?: {
    po_number: string;
  };
  surat_jalan_photo_url?: string;
}

export default function AdminIndex() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchOrders = async () => {
    try {
      const res = await apiClient.get<DeliveryOrder[]>("/delivery-orders");
      setOrders(res.data);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching orders:", err);
      setError("Gagal memuat data trip.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      fetchOrders();
    }, [])
  );

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, []);

  const getStatusColor = (status: string) => {
    const colors = {
      assigned: "#6c757d",
      otw_to_load_location: "#3498db",
      at_load_location: "#f39c12",
      otw_to_unload_location: "#e67e22",
      at_unload_location: "#9b59b6",
      otw_to_base: "#1abc9c",
      completed: "#27ae60",
      cancelled: "#e74c3c",
    };
    return colors[status as keyof typeof colors] || "#95a5a6";
  };

  const formatStatus = (status: string) => {
    const statusMap = {
      assigned: "ASSIGNED",
      otw_to_load_location: "OTW TO LOAD",
      at_load_location: "AT LOAD LOCATION",
      otw_to_unload_location: "OTW TO UNLOAD",
      at_unload_location: "AT UNLOAD LOCATION",
      otw_to_base: "OTW TO POOL",
      completed: "COMPLETED",
      cancelled: "CANCELLED",
    };
    return statusMap[status as keyof typeof statusMap] || status.toUpperCase();
  };

  const renderItem = ({ item }: { item: DeliveryOrder }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: "/(admin)/do-detail/[id]",
          params: { id: item.id.toString() },
        })
      }
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.doNumber}>{item.do_number}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>{formatStatus(item.status)}</Text>
        </View>
      </View>

      <Text style={styles.customer}>{item.customer_name}</Text>

      <View style={styles.itemRow}>
        <Text style={styles.item}>
          {item.item_name} - {item.minimal_load_quantity} Ton (min)
        </Text>
        {item.actual_load_quantity && (
          <Text style={styles.actualQuantity}>
            → {item.actual_load_quantity} Ton (actual)
          </Text>
        )}
      </View>

      {item.purchaseOrder && (
        <Text style={styles.poNumber}>PO: {item.purchaseOrder.po_number}</Text>
      )}

      <View style={styles.assignmentRow}>
        <Text style={styles.driver}>
          👤{" "}
          {item.driver?.driverProfile?.full_name ||
            item.driver?.username ||
            "-"}
        </Text>
        <Text style={styles.vehicle}>
          🚛 {item.vehicle?.license_plate || "-"}
        </Text>
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.allowance}>
          💰 Rp {Number(item.trip_allowance).toLocaleString("id-ID")}
        </Text>
        <Text style={styles.date}>
          {new Date(item.created_at).toLocaleDateString("id-ID")}
        </Text>
      </View>

      {item.surat_jalan_photo_url && (
        <View style={styles.documentIndicator}>
          <FontAwesome5 name="camera" size={12} color="#27ae60" />
          <Text style={styles.documentText}>Surat Jalan</Text>
        </View>
      )}

      {/* Click indicator */}
      <View style={styles.clickIndicator}>
        <FontAwesome5 name="chevron-right" size={16} color="#cbd5e0" />
      </View>
    </TouchableOpacity>
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
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading delivery orders...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchOrders}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 30 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <FontAwesome5 name="truck" size={48} color="#cbd5e0" />
              <Text style={styles.empty}>Belum ada delivery order</Text>
              <Text style={styles.emptySubtext}>
                Buat trip baru untuk memulai
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6f8" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: { marginTop: 12, fontSize: 16, color: "#666" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: { fontSize: 22, fontWeight: "bold", color: "#1f2937" },
  addButton: {
    flexDirection: "row",
    backgroundColor: "#2563eb",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: { color: "white", marginLeft: 8, fontWeight: "bold" },

  card: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: "relative",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  doNumber: { fontWeight: "bold", fontSize: 18, color: "#1f2937" },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },

  customer: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
    color: "#374151",
  },
  itemRow: { marginBottom: 6 },
  item: {
    color: "#6b7280",
    fontSize: 14,
    marginBottom: 2,
  },
  actualQuantity: {
    color: "#059669",
    fontSize: 14,
    fontWeight: "500",
  },
  poNumber: {
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic",
    marginBottom: 8,
  },

  assignmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  driver: {
    color: "#6b7280",
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  vehicle: {
    color: "#6b7280",
    fontSize: 13,
    flex: 1,
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  allowance: {
    fontSize: 14,
    fontWeight: "600",
    color: "#059669",
  },
  date: {
    fontSize: 12,
    color: "#9ca3af",
  },

  documentIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  documentText: {
    fontSize: 11,
    color: "#059669",
    marginLeft: 4,
    fontWeight: "500",
  },

  clickIndicator: {
    position: "absolute",
    right: 16,
    top: "50%",
    transform: [{ translateY: -8 }],
  },

  error: {
    color: "#dc2626",
    textAlign: "center",
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: "white",
    fontWeight: "bold",
  },

  empty: {
    textAlign: "center",
    fontSize: 18,
    color: "#6b7280",
    marginTop: 16,
    fontWeight: "500",
  },
  emptySubtext: {
    textAlign: "center",
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 4,
  },
});
