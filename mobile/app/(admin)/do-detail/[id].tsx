// mobile/app/(admin)/do-detail/[id].tsx

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { FontAwesome5 } from "@expo/vector-icons";
import apiClient from "../../../src/services/api";

interface DODetails {
  id: number;
  do_number: string;
  customer_name: string;
  item_name: string;
  minimal_load_quantity: number;
  actual_load_quantity?: number;
  unit_price: number;
  total_amount: number;
  trip_allowance: number;
  gaji: number;
  load_location: string;
  unload_location: string;
  status: string;
  created_at: string;
  surat_jalan_photo_url?: string;

  // Related data
  purchaseOrder?: {
    id: number;
    po_number: string;
    total_quantity: number;
    item_name: string;
  };
  driver?: {
    id: number;
    username: string;
    driverProfile?: {
      full_name: string;
      phone: string;
    };
  };
  vehicle?: {
    id: number;
    license_plate: string;
    type: string;
  };
  expenses?: Array<{
    id: number;
    jenis: string;
    amount: number;
    created_at: string;
  }>;

  // Calculated fields
  expenses_total: number;
  remaining_allowance: number;
  financial_summary: {
    trip_allowance: number;
    gaji: number;
    total_for_driver: number;
    expenses_total: number;
  };
}

const DODetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [doDetails, setDoDetails] = useState<DODetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [poSummary, setPoSummary] = useState<any>(null);

  const fetchDODetails = async () => {
    if (!id) return;

    try {
      const [doResponse, poSummaryResponse] = await Promise.all([
        apiClient.get(`/delivery-orders/${id}`),
        doDetails?.purchaseOrder?.id
          ? apiClient.get(
              `/purchase-orders/${doDetails.purchaseOrder.id}/summary`
            )
          : Promise.resolve({ data: null }),
      ]);

      setDoDetails(doResponse.data);
      setPoSummary(poSummaryResponse.data);
    } catch (error: any) {
      console.error("Error fetching DO details:", error);
      Alert.alert("Error", "Failed to load delivery order details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchDODetails();
    }, [id])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDODetails();
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

  const getStatusText = (status: string) => {
    const statusMap = {
      assigned: "Ditugaskan",
      otw_to_load_location: "Menuju Lokasi Muat",
      at_load_location: "Di Lokasi Muat",
      otw_to_unload_location: "Menuju Lokasi Bongkar",
      at_unload_location: "Di Lokasi Bongkar",
      otw_to_base: "Perjalanan Pulang",
      completed: "Selesai",
      cancelled: "Dibatalkan",
    };
    return statusMap[status as keyof typeof statusMap] || status;
  };

  const calculatePOProgress = () => {
    if (!doDetails?.purchaseOrder || !poSummary) return null;

    const totalQuantity = parseFloat(
      doDetails.purchaseOrder.total_quantity.toString()
    );
    const deliveredQuantity = parseFloat(poSummary.delivered_quantity || "0");
    const progressPercentage = (deliveredQuantity / totalQuantity) * 100;

    return {
      total: totalQuantity,
      delivered: deliveredQuantity,
      remaining: totalQuantity - deliveredQuantity,
      percentage: progressPercentage,
    };
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading details...</Text>
      </View>
    );
  }

  if (!doDetails) {
    return (
      <View style={styles.centered}>
        <Text>Delivery Order not found</Text>
      </View>
    );
  }

  const poProgress = calculatePOProgress();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Text style={styles.doNumber}>{doDetails.do_number}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(doDetails.status) },
            ]}
          >
            <Text style={styles.statusText}>
              {getStatusText(doDetails.status)}
            </Text>
          </View>
        </View>
        <Text style={styles.customerName}>{doDetails.customer_name}</Text>
        <Text style={styles.itemName}>{doDetails.item_name}</Text>
      </View>

      {/* Purchase Order Information */}
      {doDetails.purchaseOrder && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Purchase Order Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>PO Number:</Text>
            <Text style={styles.infoValue}>
              {doDetails.purchaseOrder.po_number}
            </Text>
          </View>

          {poProgress && (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Total PO Quantity:</Text>
                <Text style={styles.infoValue}>
                  {poProgress.total.toLocaleString("id-ID")} Ton
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Delivered:</Text>
                <Text style={styles.infoValue}>
                  {poProgress.delivered.toLocaleString("id-ID")} Ton
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Remaining:</Text>
                <Text style={[styles.infoValue, { color: "#e67e22" }]}>
                  {poProgress.remaining.toLocaleString("id-ID")} Ton
                </Text>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <Text style={styles.progressLabel}>PO Progress</Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(poProgress.percentage, 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {poProgress.percentage.toFixed(1)}% Complete
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* Quantity Information */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📦 Quantity Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Minimal Load:</Text>
          <Text style={styles.infoValue}>
            {doDetails.minimal_load_quantity} Ton
          </Text>
        </View>
        {doDetails.actual_load_quantity && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Actual Load:</Text>
            <Text style={[styles.infoValue, { color: "#27ae60" }]}>
              {doDetails.actual_load_quantity} Ton
            </Text>
          </View>
        )}
        {doDetails.actual_load_quantity && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Load Efficiency:</Text>
            <Text style={styles.infoValue}>
              {(
                (doDetails.actual_load_quantity /
                  doDetails.minimal_load_quantity) *
                100
              ).toFixed(1)}
              %
            </Text>
          </View>
        )}
      </View>

      {/* Location Information */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📍 Location Information</Text>
        <View style={styles.locationItem}>
          <FontAwesome5 name="arrow-up" size={16} color="#3498db" />
          <View style={styles.locationText}>
            <Text style={styles.locationLabel}>Loading Location:</Text>
            <Text style={styles.locationValue}>{doDetails.load_location}</Text>
          </View>
        </View>
        <View style={styles.locationItem}>
          <FontAwesome5 name="arrow-down" size={16} color="#e74c3c" />
          <View style={styles.locationText}>
            <Text style={styles.locationLabel}>Unloading Location:</Text>
            <Text style={styles.locationValue}>
              {doDetails.unload_location}
            </Text>
          </View>
        </View>
      </View>

      {/* Assignment Information */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>👥 Assignment Information</Text>
        {doDetails.driver && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Driver:</Text>
            <Text style={styles.infoValue}>
              {doDetails.driver.driverProfile?.full_name ||
                doDetails.driver.username}
            </Text>
          </View>
        )}
        {doDetails.driver?.driverProfile?.phone && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone:</Text>
            <Text style={styles.infoValue}>
              {doDetails.driver.driverProfile.phone}
            </Text>
          </View>
        )}
        {doDetails.vehicle && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vehicle:</Text>
            <Text style={styles.infoValue}>
              {doDetails.vehicle.license_plate} ({doDetails.vehicle.type})
            </Text>
          </View>
        )}
      </View>

      {/* Financial Information */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>💰 Financial Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Trip Allowance:</Text>
          <Text style={styles.infoValue}>
            Rp {Number(doDetails.trip_allowance).toLocaleString("id-ID")}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Driver Salary:</Text>
          <Text style={styles.infoValue}>
            Rp {Number(doDetails.gaji).toLocaleString("id-ID")}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Total Cost:</Text>
          <Text
            style={[styles.infoValue, { fontWeight: "bold", color: "#2563eb" }]}
          >
            Rp{" "}
            {Number(
              doDetails.financial_summary.total_for_driver
            ).toLocaleString("id-ID")}
          </Text>
        </View>
        {doDetails.expenses_total > 0 && (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Expenses Used:</Text>
              <Text style={[styles.infoValue, { color: "#e74c3c" }]}>
                Rp {Number(doDetails.expenses_total).toLocaleString("id-ID")}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Remaining Balance:</Text>
              <Text style={[styles.infoValue, { color: "#27ae60" }]}>
                Rp{" "}
                {Number(doDetails.remaining_allowance).toLocaleString("id-ID")}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Expenses History */}
      {doDetails.expenses && doDetails.expenses.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🧾 Expenses History</Text>
          {doDetails.expenses.map((expense, index) => (
            <View key={expense.id} style={styles.expenseItem}>
              <View style={styles.expenseHeader}>
                <Text style={styles.expenseType}>{expense.jenis}</Text>
                <Text style={styles.expenseAmount}>
                  Rp {Number(expense.amount).toLocaleString("id-ID")}
                </Text>
              </View>
              <Text style={styles.expenseDate}>
                {new Date(expense.created_at).toLocaleDateString("id-ID")}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Documents */}
      {doDetails.surat_jalan_photo_url && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📄 Documents</Text>
          <TouchableOpacity style={styles.documentItem}>
            <FontAwesome5 name="file-image" size={20} color="#3498db" />
            <Text style={styles.documentText}>Surat Jalan Photo</Text>
            <FontAwesome5 name="external-link-alt" size={16} color="#666" />
          </TouchableOpacity>
        </View>
      )}

      {/* Timestamps */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⏰ Timeline</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Created:</Text>
          <Text style={styles.infoValue}>
            {new Date(doDetails.created_at).toLocaleString("id-ID")}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6f8" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 16, color: "#666" },

  headerCard: {
    backgroundColor: "#2563eb",
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  doNumber: { fontSize: 24, fontWeight: "bold", color: "#fff" },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  customerName: { fontSize: 18, color: "#fff", marginBottom: 4 },
  itemName: { fontSize: 16, color: "#e2e8f0" },

  card: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#1f2937",
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  infoLabel: { fontSize: 14, color: "#6b7280", flex: 1 },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1f2937",
    flex: 1,
    textAlign: "right",
  },

  progressContainer: { marginTop: 12 },
  progressLabel: { fontSize: 14, color: "#6b7280", marginBottom: 6 },
  progressBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
    textAlign: "center",
  },

  locationItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  locationText: { marginLeft: 12, flex: 1 },
  locationLabel: { fontSize: 14, color: "#6b7280", marginBottom: 2 },
  locationValue: { fontSize: 14, color: "#1f2937" },

  expenseItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 8,
    marginBottom: 8,
  },
  expenseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  expenseType: { fontSize: 14, fontWeight: "500", color: "#1f2937" },
  expenseAmount: { fontSize: 14, fontWeight: "bold", color: "#dc2626" },
  expenseDate: { fontSize: 12, color: "#6b7280", marginTop: 2 },

  documentItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
  },
  documentText: { flex: 1, marginLeft: 12, fontSize: 14, color: "#1f2937" },
});

export default DODetailScreen;
