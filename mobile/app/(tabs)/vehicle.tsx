// app/(tabs)/vehicle.tsx
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import apiClient from "../../src/services/api";

interface Vehicle {
  id: number;
  license_plate: string;
  type: string;
  capacity: number;
  status: "available" | "in_use" | "maintenance";
  last_service_date?: string;
  next_service_due?: string;
  stnk_number?: string;
  stnk_expired_date?: string;
  tax_due_date?: string;
}

interface VehicleService {
  id: number;
  service_date: string;
  description: string;
  cost: number;
  workshop_name?: string;
}

export default function VehicleScreen() {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [serviceHistory, setServiceHistory] = useState<VehicleService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setError(null);
      console.log("🔄 Fetching driver's active delivery orders...");

      // ✅ Fix 1: Use /delivery-orders/me endpoint (lebih spesifik untuk driver)
      const ordersResponse = await apiClient.get("/delivery-orders/me");
      console.log("📥 Active orders response:", ordersResponse.data);

      // ✅ Fix 2: Filter active orders di frontend jika backend tidak filter
      const activeOrders = ordersResponse.data.filter((order: any) =>
        [
          "assigned",
          "otw_to_load_location",
          "at_load_location",
          "otw_to_unload_location",
          "at_unload_location",
          "otw_to_base",
        ].includes(order.status)
      );

      console.log("🚛 Active orders found:", activeOrders.length);

      if (activeOrders.length > 0) {
        const activeOrder = activeOrders[0];
        const vehicleId = activeOrder.vehicle_id;

        console.log("🔍 Vehicle ID from active order:", vehicleId);

        if (!vehicleId) {
          console.log("❌ No vehicle assigned to active order");
          setVehicle(null);
          setServiceHistory([]);
          return;
        }

        // ✅ Fix 3: Fetch vehicle data with better error handling
        console.log("🔄 Fetching vehicle details...");
        const vehicleResponse = await apiClient.get(`/vehicles/${vehicleId}`);
        console.log("📥 Vehicle data:", vehicleResponse.data);

        setVehicle(vehicleResponse.data);

        // ✅ Fix 4: Fetch service history with error handling
        try {
          console.log("🔄 Fetching service history...");
          const historyResponse = await apiClient.get(
            `/vehicles/${vehicleId}/history`
          );
          console.log("📥 Service history:", historyResponse.data);
          setServiceHistory(historyResponse.data || []);
        } catch (historyError: any) {
          console.log("⚠️ Service history fetch failed:", historyError.message);
          // Don't fail the whole component if service history fails
          setServiceHistory([]);
        }
      } else {
        console.log("ℹ️ No active delivery orders found");
        setVehicle(null);
        setServiceHistory([]);
      }
    } catch (error: any) {
      console.error("💥 Error fetching vehicle info:", error);

      // ✅ Fix 5: Better error messages
      let errorMessage = "Failed to fetch vehicle information";

      if (error.response?.status === 401) {
        errorMessage = "Authentication failed. Please login again.";
      } else if (error.response?.status === 500) {
        errorMessage = "Server error. Please try again later.";
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      setVehicle(null);
      setServiceHistory([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchData();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "#10b981";
      case "in_use":
        return "#3b82f6";
      case "maintenance":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("id-ID");
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString("id-ID")}`;
  };

  const isDateNear = (dateString?: string, days: number = 30) => {
    if (!dateString) return false;
    const targetDate = new Date(dateString);
    const today = new Date();
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= days && diffDays >= 0;
  };

  const isDateOverdue = (dateString?: string) => {
    if (!dateString) return false;
    const targetDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return targetDate < today;
  };

  // ✅ Fix 6: Loading state
  if (isLoading) {
    return (
      <View style={styles.emptyState}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading vehicle information...</Text>
      </View>
    );
  }

  // ✅ Fix 7: Error state
  if (error) {
    return (
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Error Loading Vehicle</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Text style={styles.errorSubtext}>Pull down to refresh</Text>
        </View>
      </ScrollView>
    );
  }

  // ✅ Fix 8: No vehicle state
  if (!vehicle) {
    return (
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.emptyState}>
          <Ionicons name="car-sport-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyStateText}>No Vehicle Assigned</Text>
          <Text style={styles.emptyStateSubtext}>
            You do not have an active delivery order with an assigned vehicle.
          </Text>
        </View>
      </ScrollView>
    );
  }

  // ✅ Main vehicle display
  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Vehicle Info Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Vehicle Information</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(vehicle.status) },
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {vehicle.status.replace("_", " ").toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.vehicleIcon}>
            <Ionicons name="car-sport" size={48} color="#3b82f6" />
          </View>
          <View style={styles.vehicleDetails}>
            <Text style={styles.licensePlate}>{vehicle.license_plate}</Text>
            <Text style={styles.vehicleType}>{vehicle.type}</Text>
            <Text style={styles.vehicleCapacity}>
              Capacity: {vehicle.capacity.toLocaleString()} kg
            </Text>
          </View>
        </View>
      </View>

      {/* Documents Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Documents</Text>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.documentItem}>
            <View style={styles.documentInfo}>
              <Text style={styles.documentLabel}>STNK Number</Text>
              <Text style={styles.documentValue}>
                {vehicle.stnk_number || "N/A"}
              </Text>
              <Text
                style={[
                  styles.documentDate,
                  isDateOverdue(vehicle.stnk_expired_date)
                    ? styles.overdueDate
                    : isDateNear(vehicle.stnk_expired_date)
                    ? styles.nearDate
                    : styles.normalDate,
                ]}
              >
                Expires: {formatDate(vehicle.stnk_expired_date)}
              </Text>
            </View>
          </View>
          <View style={styles.documentItem}>
            <View style={styles.documentInfo}>
              <Text style={styles.documentLabel}>Tax Due Date</Text>
              <Text
                style={[
                  styles.documentDate,
                  isDateOverdue(vehicle.tax_due_date)
                    ? styles.overdueDate
                    : isDateNear(vehicle.tax_due_date)
                    ? styles.nearDate
                    : styles.normalDate,
                ]}
              >
                {formatDate(vehicle.tax_due_date)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Service Information Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Service Information</Text>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.serviceInfo}>
            <View style={styles.serviceItem}>
              <Text style={styles.serviceLabel}>Last Service</Text>
              <Text style={styles.serviceValue}>
                {formatDate(vehicle.last_service_date)}
              </Text>
            </View>
            <View style={styles.serviceItem}>
              <Text style={styles.serviceLabel}>Next Service Due</Text>
              <Text
                style={[
                  styles.serviceValue,
                  isDateNear(vehicle.next_service_due)
                    ? { color: "#f59e0b" }
                    : isDateOverdue(vehicle.next_service_due)
                    ? { color: "#ef4444" }
                    : {},
                ]}
              >
                {formatDate(vehicle.next_service_due)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Service History Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Recent Service History</Text>
        </View>
        <View style={styles.serviceHistory}>
          {serviceHistory.length > 0 ? (
            serviceHistory.slice(0, 5).map((service, index) => (
              <View
                key={service.id}
                style={[
                  styles.serviceHistoryItem,
                  index > 0 && styles.serviceHistoryBorder,
                ]}
              >
                <View style={styles.serviceHistoryHeader}>
                  <Text style={styles.serviceHistoryType}>
                    {service.description}
                  </Text>
                  <Text style={styles.serviceHistoryCost}>
                    {formatCurrency(service.cost)}
                  </Text>
                </View>
                <Text style={styles.serviceHistoryDate}>
                  {formatDate(service.service_date)}
                </Text>
                {service.workshop_name && (
                  <Text style={styles.serviceHistoryNote}>
                    Workshop: {service.workshop_name}
                  </Text>
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyHistoryText}>
                No service history available
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  card: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "500",
  },
  cardContent: {
    padding: 16,
  },
  vehicleIcon: {
    alignItems: "center",
    marginBottom: 16,
  },
  vehicleDetails: {
    alignItems: "center",
  },
  licensePlate: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  vehicleType: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 4,
  },
  vehicleCapacity: {
    fontSize: 14,
    color: "#9ca3af",
  },
  documentItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  documentInfo: {
    flex: 1,
  },
  documentLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  documentValue: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 2,
  },
  documentDate: {
    fontSize: 12,
  },
  normalDate: {
    color: "#10b981",
  },
  nearDate: {
    color: "#f59e0b",
  },
  overdueDate: {
    color: "#ef4444",
  },
  serviceInfo: {
    gap: 16,
  },
  serviceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  serviceLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  serviceValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  serviceHistory: {
    paddingBottom: 16,
  },
  serviceHistoryItem: {
    padding: 16,
  },
  serviceHistoryBorder: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  serviceHistoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  serviceHistoryType: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1f2937",
  },
  serviceHistoryCost: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
  },
  serviceHistoryDate: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  serviceHistoryNote: {
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  emptyHistory: {
    padding: 32,
    alignItems: "center",
  },
  emptyHistoryText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6b7280",
  },
  errorState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    minHeight: 400,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ef4444",
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
  },
});
