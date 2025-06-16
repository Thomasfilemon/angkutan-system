// mobile/app/trip-detail/[id].tsx

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
} from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { getDeliveryOrderDetails } from "../../src/services/api"; // Import fungsi baru
import { FontAwesome5 } from "@expo/vector-icons";

// Interface untuk data yang akan kita terima
interface Expense {
  id: number;
  jenis: string;
  amount: string;
  receipt_url: string | null;
  created_at: string;
}

interface DeliveryOrderDetails {
  id: number;
  do_number: string;
  customer_name: string;
  load_location: string;
  unload_location: string;
  trip_allowance: number;
  expenses_total: number;
  remaining_allowance: number;
  expenses: Expense[];
}

const TripDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>(); // Mengambil ID trip dari URL
  const [trip, setTrip] = useState<DeliveryOrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTripDetails = async () => {
    if (!id) return;
    try {
      const response = await getDeliveryOrderDetails(id);
      setTrip(response.data);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Gagal memuat detail trip."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchTripDetails();
    }, [id])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTripDetails();
  }, [id]);

  const renderExpenseItem = ({ item }: { item: Expense }) => (
    <View style={styles.expenseItem}>
      <FontAwesome5 name="receipt" size={20} color="#3498db" />
      <View style={styles.expenseDetails}>
        <Text style={styles.expenseType}>{item.jenis}</Text>
        <Text style={styles.expenseDate}>
          {new Date(item.created_at).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </Text>
      </View>
      <Text style={styles.expenseAmount}>
        -Rp {Number(item.amount).toLocaleString("id-ID")}
      </Text>
    </View>
  );

  if (loading) {
    return <ActivityIndicator size="large" style={styles.centered} />;
  }

  if (!trip) {
    return (
      <View style={styles.centered}>
        <Text>Detail trip tidak ditemukan.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* KARTU INFORMASI SALDO */}
      <View style={styles.saldoCard}>
        <Text style={styles.saldoTitle}>Sisa Uang Jalan</Text>
        <Text style={styles.saldoAmount}>
          Rp {Number(trip.remaining_allowance).toLocaleString("id-ID")}
        </Text>
        <View style={styles.saldoBreakdown}>
          <Text style={styles.breakdownText}>
            Uang Jalan: Rp {Number(trip.trip_allowance).toLocaleString("id-ID")}
          </Text>
          <Text style={styles.breakdownText}>
            Total Pengeluaran: Rp{" "}
            {Number(trip.expenses_total).toLocaleString("id-ID")}
          </Text>
        </View>
      </View>

      {/* KARTU DETAIL TRIP */}
      <View style={styles.detailCard}>
        <Text style={styles.cardTitle}>Detail Perjalanan</Text>
        <Text style={styles.detailText}>DO: {trip.do_number}</Text>
        <Text style={styles.detailText}>Customer: {trip.customer_name}</Text>
        <Text style={styles.detailText}>
          Rute: {trip.load_location} → {trip.unload_location}
        </Text>
      </View>

      {/* RIWAYAT PENGELUARAN */}
      <View style={styles.historyCard}>
        <Text style={styles.cardTitle}>Riwayat Pengeluaran</Text>
        <FlatList
          data={trip.expenses}
          renderItem={renderExpenseItem}
          keyExtractor={(item) => item.id.toString()}
          scrollEnabled={false} // Agar bisa di-scroll bersama ScrollView utama
          ListEmptyComponent={
            <Text style={styles.emptyText}>Belum ada pengeluaran.</Text>
          }
        />
      </View>
    </ScrollView>
  );
};

// --- STYLES BARU YANG LEBIH BAIK ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6f8" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  saldoCard: {
    backgroundColor: "#3b82f6",
    padding: 20,
    margin: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  saldoTitle: { fontSize: 16, color: "#fff", opacity: 0.8 },
  saldoAmount: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#fff",
    marginVertical: 5,
  },
  saldoBreakdown: { marginTop: 10, alignItems: "center" },
  breakdownText: { fontSize: 12, color: "#fff", opacity: 0.8 },
  detailCard: {
    backgroundColor: "white",
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  historyCard: {
    backgroundColor: "white",
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  detailText: { fontSize: 14, color: "#555", marginBottom: 4 },
  expenseItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  expenseDetails: { flex: 1, marginLeft: 12 },
  expenseType: { fontSize: 16, fontWeight: "500", color: "#333" },
  expenseDate: { fontSize: 12, color: "#888" },
  expenseAmount: { fontSize: 16, fontWeight: "bold", color: "#e74c3c" },
  emptyText: { textAlign: "center", color: "#888", paddingVertical: 20 },
});

export default TripDetailScreen;
