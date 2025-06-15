// app/(tabs)/vehicle.tsx

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

// --- CHANGE 1: Import apiClient and remove axios/useAuth ---
import apiClient from '../../src/services/api';

// Interfaces should match your Sequelize models
interface Vehicle {
  id: number;
  license_plate: string;
  type: string;
  capacity: number;
  status: 'available' | 'in_use' | 'maintenance';
  last_service_date?: string;
  next_service_due?: string;
  stnk_number?: string;
  stnk_expired_date?: string;
  tax_due_date?: string;
}

interface VehicleService {
  id: number;
  service_date: string;
  description: string; // Updated from service_type
  cost: number; // Updated from total_cost
  workshop_name?: string;
}

export default function VehicleScreen() {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [serviceHistory, setServiceHistory] = useState<VehicleService[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [refreshing, setRefreshing] = useState(false);

  // --- CHANGE 2: Create a single, efficient data fetching function ---
  const fetchData = async () => {
    try {
      // Step 1: Find the driver's current active delivery order.
      // The backend will automatically filter by the logged-in driver's ID.
      const activeStatuses = 'assigned,otw_to_destination,at_destination,otw_to_base';
      const ordersResponse = await apiClient.get(`/delivery-orders?status=${activeStatuses}`);

      if (ordersResponse.data.length > 0) {
        const activeOrder = ordersResponse.data[0];
        const vehicleId = activeOrder.vehicle_id;

        if (!vehicleId) {
            setVehicle(null);
            setServiceHistory([]);
            return;
        }

        // Step 2: Fetch vehicle details and its history concurrently for speed.
        const [vehicleResponse, historyResponse] = await Promise.all([
          apiClient.get(`/vehicles/${vehicleId}`),
          apiClient.get(`/vehicles/${vehicleId}/history`) // Use the new RESTful endpoint
        ]);
        
        setVehicle(vehicleResponse.data);
        setServiceHistory(historyResponse.data);

      } else {
        // No active trip, so no vehicle assigned.
        setVehicle(null);
        setServiceHistory([]);
      }
    } catch (error) {
      console.error('Error fetching vehicle info:', error);
      Alert.alert('Error', 'Failed to fetch vehicle information. Please pull down to refresh.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // --- CHANGE 3: Use useFocusEffect to refresh data when the tab is viewed ---
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

  // --- Helper functions (no changes needed) ---
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return '#10b981';
      case 'in_use': return '#3b82f6';
      case 'maintenance': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('id-ID');
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
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
    // Set hours to 0 to compare dates only
    today.setHours(0, 0, 0, 0);
    return targetDate < today;
  };


  // --- Render logic ---
  if (isLoading) {
    return <View style={styles.emptyState}><ActivityIndicator size="large" /></View>;
  }

  if (!vehicle) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="car-sport-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyStateText}>No Vehicle Assigned</Text>
          <Text style={styles.emptyStateSubtext}>
            You do not have an active delivery order with an assigned vehicle.
          </Text>
        </View>
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
      {/* Cards for Vehicle Info, Documents, etc. */}
      {/* ... (The card components are mostly the same, with one key change in Service History) */}

      {/* --- CHANGE 4: Update Service History rendering to match the new model --- */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Recent Service History</Text>
        </View>
        <View style={styles.serviceHistory}>
          {serviceHistory.length > 0 ? (
            serviceHistory.slice(0, 5).map((service, index) => (
              <View key={service.id} style={[styles.serviceHistoryItem, index > 0 && styles.serviceHistoryBorder]}>
                <View style={styles.serviceHistoryHeader}>
                  {/* Use 'description' instead of 'service_type' */}
                  <Text style={styles.serviceHistoryType}>{service.description}</Text>
                  {/* Use 'cost' instead of 'total_cost' */}
                  <Text style={styles.serviceHistoryCost}>{formatCurrency(service.cost)}</Text>
                </View>
                <Text style={styles.serviceHistoryDate}>{formatDate(service.service_date)}</Text>
                {service.workshop_name && (
                  <Text style={styles.serviceHistoryNote}>Workshop: {service.workshop_name}</Text>
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyHistoryText}>No service history available</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

// Styles remain the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  card: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  cardContent: {
    padding: 16,
  },
  vehicleIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },
  vehicleDetails: {
    alignItems: 'center',
  },
  licensePlate: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  vehicleType: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 4,
  },
  vehicleCapacity: {
    fontSize: 14,
    color: '#9ca3af',
  },
  documentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  documentInfo: {
    flex: 1,
  },
  documentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  documentValue: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  documentDate: {
    fontSize: 12,
  },
  normalDate: {
    color: '#10b981',
  },
  nearDate: {
    color: '#f59e0b',
  },
  overdueDate: {
    color: '#ef4444',
  },
  serviceInfo: {
    gap: 16,
  },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  serviceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  serviceHistory: {
    paddingBottom: 16,
  },
  serviceHistoryItem: {
    padding: 16,
  },
  serviceHistoryBorder: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  serviceHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  serviceHistoryType: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  serviceHistoryCost: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  serviceHistoryDate: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  serviceHistoryNote: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  emptyHistory: {
    padding: 32,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
