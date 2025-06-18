// mobile/app/(tabs)/index.tsx

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import apiClient, { updateDeliveryStatus } from "../../src/services/api";
import { useAuth } from "../../src/contexts/AuthContext";
import { FontAwesome5 } from "@expo/vector-icons";

// === UPDATED INTERFACES ===
interface Vehicle {
  id: number;
  license_plate: string;
  type: string;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
}

interface DeliveryOrder {
  id: number;
  do_number: string;
  customer_name: string;
  item_name: string;
  minimal_load_quantity: number;
  actual_load_quantity?: number;
  status:
    | "assigned"
    | "otw_to_load_location"
    | "at_load_location"
    | "otw_to_unload_location"
    | "at_unload_location"
    | "otw_to_base"
    | "completed"
    | "cancelled";
  load_location: string;
  unload_location: string;
  purchaseOrder?: PurchaseOrder;
  vehicle?: Vehicle;
  trip_allowance: number;
  gaji: number;
  expenses_total: number;
  remaining_allowance: number;
  financial_summary?: {
    trip_allowance: number;
    gaji: number;
    total_for_driver: number;
    expenses_total: number;
    remaining_allowance: number;
  };
  created_at: string;
  driver_name?: string;
}

const DriverDashboard = () => {
  const router = useRouter();
  const { signOut } = useAuth();
  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);

  const fetchMyTasks = async () => {
    try {
      const response = await apiClient.get<DeliveryOrder[]>(
        "/delivery-orders/me"
      );
      setDeliveryOrders(response.data);
      setError(null);
    } catch (err: any) {
      console.error(
        "Error fetching delivery orders:",
        err.response?.data || err.message
      );
      setError("Gagal memuat tugas. Tarik ke bawah untuk muat ulang.");
      if (err.response?.status === 401) {
        signOut();
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleUpdateStatus = async (orderId: number, action: string) => {
    setUpdatingStatus(orderId);
    try {
      await updateDeliveryStatus(orderId, action);
      await fetchMyTasks(); // Refresh data

      // Show success message
      const messages = {
        start_to_load: "Berhasil memulai perjalanan ke lokasi muat",
        arrive_at_load: "Berhasil tiba di lokasi muat",
        arrive_at_unload: "Berhasil tiba di lokasi bongkar",
        start_return: "Berhasil memulai perjalanan pulang",
        complete: "Tugas berhasil diselesaikan",
      };

      Alert.alert(
        "Berhasil",
        messages[action as keyof typeof messages] ||
          "Status berhasil diperbarui"
      );
    } catch (err: any) {
      console.error(
        `Error updating status for order ${orderId}:`,
        err.response?.data || err.message
      );
      Alert.alert(
        "Error",
        err.response?.data?.message ||
          "Gagal memperbarui status. Silakan coba lagi."
      );
    } finally {
      setUpdatingStatus(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchMyTasks();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMyTasks();
  }, []);

  // === NEW STATUS ACTIONS MAPPING ===
  const getStatusActions = (order: DeliveryOrder) => {
    const isUpdating = updatingStatus === order.id;

    switch (order.status) {
      case "assigned":
        return {
          action: "start_to_load",
          label: "Berangkat ke Lokasi Muat",
          icon: "truck",
          color: "#3498db",
          disabled: isUpdating,
        };
      case "otw_to_load_location":
        return {
          action: "arrive_at_load",
          label: "Tiba di Lokasi Muat",
          icon: "map-marker-alt",
          color: "#f39c12",
          disabled: isUpdating,
        };
      case "at_load_location":
        return {
          action: "navigate_to_confirm",
          label: "Konfirmasi Muatan & Berangkat",
          icon: "clipboard-check",
          color: "#e67e22",
          disabled: false,
          special: true, // This will navigate to detail page
        };
      case "otw_to_unload_location":
        return {
          action: "arrive_at_unload",
          label: "Tiba di Lokasi Bongkar",
          icon: "map-marker-alt",
          color: "#9b59b6",
          disabled: isUpdating,
        };
      case "at_unload_location":
        return {
          action: "start_return",
          label: "Mulai Perjalanan Pulang",
          icon: "home",
          color: "#1abc9c",
          disabled: isUpdating,
        };
      case "otw_to_base":
        return {
          action: "complete",
          label: "Selesaikan Tugas",
          icon: "check-circle",
          color: "#27ae60",
          disabled: isUpdating,
        };
      default:
        return null;
    }
  };

  const renderActionButtons = (order: DeliveryOrder) => {
    const actionConfig = getStatusActions(order);

    if (!actionConfig) return null;

    const handlePress = () => {
      if (actionConfig.special) {
        // Navigate to detail page for load confirmation
        router.push(`/trip-detail/${order.id}`);
      } else {
        handleUpdateStatus(order.id, actionConfig.action);
      }
    };

    return (
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: actionConfig.color }]}
        onPress={handlePress}
        disabled={actionConfig.disabled}
      >
        {updatingStatus === order.id ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <FontAwesome5 name={actionConfig.icon} size={16} color="white" />
        )}
        <Text style={styles.actionButtonText}>{actionConfig.label}</Text>
      </TouchableOpacity>
    );
  };

  // Helper to get status badge background color
  const getStatusColor = (status: DeliveryOrder["status"]) => {
    switch (status) {
      case "assigned":
        return { backgroundColor: "#6c757d" };
      case "otw_to_load_location":
        return { backgroundColor: "#3498db" };
      case "at_load_location":
        return { backgroundColor: "#f39c12" };
      case "otw_to_unload_location":
        return { backgroundColor: "#e67e22" };
      case "at_unload_location":
        return { backgroundColor: "#9b59b6" };
      case "otw_to_base":
        return { backgroundColor: "#1abc9c" };
      case "completed":
        return { backgroundColor: "#27ae60" };
      case "cancelled":
        return { backgroundColor: "#e74c3c" };
      default:
        return { backgroundColor: "#95a5a6" };
    }
  };

  // Helper to get status text
  const getStatusText = (status: DeliveryOrder["status"]) => {
    switch (status) {
      case "assigned":
        return "DITUGASKAN";
      case "otw_to_load_location":
        return "MENUJU MUAT";
      case "at_load_location":
        return "DI LOK. MUAT";
      case "otw_to_unload_location":
        return "MENUJU BONGKAR";
      case "at_unload_location":
        return "DI LOK. BONGKAR";
      case "otw_to_base":
        return "PULANG";
      case "completed":
        return "SELESAI";
      case "cancelled":
        return "BATAL";
      default:
        return "UNKNOWN";
    }
  };

  const renderTaskItem = ({ item }: { item: DeliveryOrder }) => {
    const isCompleted = item.status === "completed";

    return (
      <TouchableOpacity
        onPress={() => router.push(`/trip-detail/${item.id}`)}
        style={[styles.card, isCompleted && styles.completedCard]}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.doNumber}>{item.do_number}</Text>
          <View style={[styles.statusBadge, getStatusColor(item.status)]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
          {isCompleted && (
            <FontAwesome5
              name="check-circle"
              size={20}
              color="#27ae60"
              style={{ marginLeft: 8 }}
            />
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.customerName}>{item.customer_name}</Text>
          <Text style={styles.itemDetails}>
            {item.item_name} - {item.minimal_load_quantity} Ton (minimal)
            {item.actual_load_quantity &&
              ` → ${item.actual_load_quantity} Ton (aktual)`}
          </Text>
          <View style={styles.locationContainer}>
            <FontAwesome5 name="arrow-up" size={14} color="#3498db" />
            <Text style={styles.locationText}>{item.load_location}</Text>
          </View>
          <View style={styles.locationContainer}>
            <FontAwesome5 name="arrow-down" size={14} color="#e74c3c" />
            <Text style={styles.locationText}>{item.unload_location}</Text>
          </View>
        </View>

        {/* FINANCIAL SUMMARY */}
        <View
          style={[
            styles.allowanceContainer,
            isCompleted && styles.completedAllowanceContainer,
          ]}
        >
          <View style={styles.allowanceItem}>
            <Text style={styles.allowanceLabel}>Uang Jalan</Text>
            <Text style={styles.allowanceValue}>
              Rp {Number(item.trip_allowance).toLocaleString("id-ID")}
            </Text>
          </View>
          <View style={styles.allowanceItem}>
            <Text style={styles.allowanceLabel}>Sisa Saldo</Text>
            <Text style={[styles.allowanceValue, styles.remainingValue]}>
              Rp {Number(item.remaining_allowance).toLocaleString("id-ID")}
            </Text>
          </View>
        </View>

        {/* Info untuk completed trip */}
        {isCompleted && (
          <View style={styles.completedInfo}>
            <Text style={styles.completedInfoText}>
              ✓ Perjalanan telah selesai - Tap untuk melihat detail
            </Text>
          </View>
        )}

        <View style={styles.cardFooter}>{renderActionButtons(item)}</View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <ActivityIndicator size="large" color="#0000ff" style={styles.centered} />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Tugas Saya</Text>
        <TouchableOpacity onPress={signOut}>
          <FontAwesome5 name="sign-out-alt" size={24} color="#e74c3c" />
        </TouchableOpacity>
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      <FlatList
        data={deliveryOrders}
        renderItem={renderTaskItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Tidak ada tugas saat ini.</Text>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
};

// === UPDATED STYLES ===
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6f8" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 24, fontWeight: "bold" },
  listContainer: { paddingHorizontal: 10, paddingBottom: 20 },
  card: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 8,
  },
  doNumber: { fontSize: 16, fontWeight: "bold", color: "#333" },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 },
  statusText: { color: "white", fontSize: 12, fontWeight: "bold" },
  cardBody: { marginBottom: 12 },
  customerName: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  itemDetails: { fontSize: 14, color: "#666", marginBottom: 8 },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  locationText: { marginLeft: 8, fontSize: 14, color: "#555" },
  cardFooter: { marginTop: 8 },
  actionButton: {
    padding: 12,
    borderRadius: 6,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonText: {
    color: "white",
    marginLeft: 10,
    fontSize: 16,
    fontWeight: "bold",
  },
  errorText: { color: "red", textAlign: "center", margin: 10 },
  emptyText: {
    textAlign: "center",
    marginTop: 50,
    fontSize: 16,
    color: "#888",
  },

  // ENHANCED ALLOWANCE SECTION
  allowanceContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  allowanceItem: { alignItems: "center", flex: 1 },
  allowanceLabel: { fontSize: 12, color: "#666" },
  allowanceValue: { fontSize: 14, fontWeight: "bold", color: "#333" },
  remainingValue: { color: "#e67e22" }, // Orange for remaining balance

  completedCard: { opacity: 0.8, borderColor: "#27ae60", borderWidth: 2 },
  completedAllowanceContainer: { backgroundColor: "#f8fff8" },
  completedInfo: {
    marginTop: 12,
    padding: 8,
    backgroundColor: "#e8f5e8",
    borderRadius: 6,
  },
  completedInfoText: {
    fontSize: 12,
    color: "#155724",
    textAlign: "center",
    fontStyle: "italic",
  },
});

export default DriverDashboard;
