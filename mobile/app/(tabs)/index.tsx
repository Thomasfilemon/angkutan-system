import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
// --- 1. Import the dedicated apiClient ---
import apiClient from "../../src/services/api";
import { useAuth } from "../../src/contexts/AuthContext";
import { FontAwesome5 } from "@expo/vector-icons";

// --- Interfaces for your data structures ---
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
  quantity: number;
  status:
    | "assigned"
    | "otw_to_destination"
    | "at_destination"
    | "otw_to_base"
    | "completed"
    | "cancelled";
  load_location: string;
  unload_location: string;
  purchaseOrder?: PurchaseOrder;
  vehicle?: Vehicle;
  trip_allowance: number;
  expenses_total: number;
  remaining_allowance: number;
  created_at: string;
  driver_name?: string;
}

const DriverDashboard = () => {
  const router = useRouter(); // <-- 2. Inisialisasi router
  const { signOut } = useAuth();
  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // --- 2. This function now uses the reliable apiClient ---
  const fetchMyTasks = async () => {
    try {
      // The apiClient automatically adds the base URL and Authorization header.
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
      // The signOut logic for 401 errors is crucial and correct.
      if (err.response?.status === 401) {
        signOut();
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // --- 3. This function also uses the apiClient ---
  const handleUpdateStatus = async (
    orderId: number,
    action: "start" | "arrive" | "return" | "complete"
  ) => {
    try {
      // Use the apiClient to make the patch request.
      await apiClient.patch(`/delivery-orders/${orderId}/${action}`);
      // Refetch data to get the latest, confirmed state from the server.
      await fetchMyTasks();
    } catch (err: any) {
      console.error(
        `Error updating status for order ${orderId} to ${action}:`,
        err.response?.data || err.message
      );
      alert(`Gagal memperbarui status. Silakan coba lagi.`);
      // Refetch to revert any optimistic UI updates if the call failed.
      await fetchMyTasks();
    }
  };

  // useFocusEffect is perfect for this use case. No changes needed here.
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

  const renderActionButtons = (order: DeliveryOrder) => {
    switch (order.status) {
      case "assigned":
        return (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleUpdateStatus(order.id, "start")}
          >
            <FontAwesome5 name="truck" size={16} color="white" />
            <Text style={styles.actionButtonText}>Mulai OTW ke Tujuan</Text>
          </TouchableOpacity>
        );
      case "otw_to_destination":
        return (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleUpdateStatus(order.id, "arrive")}
          >
            <FontAwesome5 name="map-marker-alt" size={16} color="white" />
            <Text style={styles.actionButtonText}>Sudah Sampai Tujuan</Text>
          </TouchableOpacity>
        );
      case "at_destination":
        return (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleUpdateStatus(order.id, "return")}
          >
            <FontAwesome5 name="warehouse" size={16} color="white" />
            <Text style={styles.actionButtonText}>Mulai OTW ke Gudang</Text>
          </TouchableOpacity>
        );
      case "otw_to_base":
        return (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleUpdateStatus(order.id, "complete")}
          >
            <FontAwesome5 name="check-circle" size={16} color="white" />
            <Text style={styles.actionButtonText}>Selesaikan Tugas</Text>
          </TouchableOpacity>
        );
      default:
        return null;
    }
  };

  // Helper to get status badge background color
  const getStatusColor = (status: DeliveryOrder["status"]) => {
    switch (status) {
      case "assigned":
        return { backgroundColor: "#3498db" };
      case "otw_to_destination":
        return { backgroundColor: "#f39c12" };
      case "at_destination":
        return { backgroundColor: "#e67e22" };
      case "otw_to_base":
        return { backgroundColor: "#1abc9c" };
      case "completed":
        return { backgroundColor: "#2ecc71" };
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
        return "BARU";
      case "otw_to_destination":
        return "OTW TUJUAN";
      case "at_destination":
        return "DI LOKASI";
      case "otw_to_base":
        return "OTW PULANG";
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
        disabled={false} // Tetap bisa diklik, tapi read-only
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
              color="#28a745"
              style={{ marginLeft: 8 }}
            />
          )}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.customerName}>{item.customer_name}</Text>
          <Text style={styles.itemDetails}>
            {item.item_name} - {item.quantity} Ton
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

        {/* <View style={styles.allowanceContainer}>
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
        </View> */}

        {/* Allowance info - dengan styling berbeda untuk completed */}
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

// --- Styles (No changes needed, but included for completeness) ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f6f8",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  listContainer: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
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
  doNumber: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  cardBody: {
    marginBottom: 12,
  },
  customerName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#555",
  },
  cardFooter: {
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: "#27ae60",
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
  errorText: {
    color: "red",
    textAlign: "center",
    margin: 10,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 50,
    fontSize: 16,
    color: "#888",
  },
  allowanceContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  allowanceItem: {
    alignItems: "center",
  },
  allowanceLabel: {
    fontSize: 12,
    color: "#666",
  },
  allowanceValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  remainingValue: {
    color: "#28a745", // Warna hijau untuk sisa saldo
  },

  completedCard: {
    opacity: 0.8,
    borderColor: "#28a745",
    borderWidth: 2,
  },

  completedAllowanceContainer: {
    backgroundColor: "#f8fff8",
  },

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
  routeContainer: {
    marginTop: 8,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  routeText: {
    fontSize: 14,
    color: "#333",
    marginTop: 4,
    marginBottom: 4,
  },
});

export default DriverDashboard;
