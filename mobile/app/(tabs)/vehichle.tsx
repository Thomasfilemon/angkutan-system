// app/(tabs)/vehicle.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import axios from 'axios';

interface Vehicle {
  id: number;
  license_plate: string;
  type: string;
  capacity: number;
  status: string;
  last_service_date?: string;
  next_service_due?: string;
  stnk_number?: string;
  stnk_expired_date?: string;
  tax_due_date?: string;
}

interface VehicleService {
  id: number;
  service_date: string;
  service_type: string;
  total_cost: number;
  note?: string;
}

export default function VehicleScreen() {
  const { user, token } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [serviceHistory, setServiceHistory] = useState<VehicleService[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const API_BASE_URL = 'https://localhost:3000/api';

  useEffect(() => {
    fetchVehicleInfo();
  }, []);

  const fetchVehicleInfo = async () => {
    try {
      setIsLoading(true);
      // Get current active trip to find assigned vehicle
      const tripsResponse = await axios.get(
        `${API_BASE_URL}/trips?driver_id=${user?.id}&status=on_progress,otw,perjalanan_pulang`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (tripsResponse.data.length > 0) {
        const activeTrip = tripsResponse.data[0];
        const vehicleResponse = await axios.get(
          `${API_BASE_URL}/vehicles/${activeTrip.vehicle_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setVehicle(vehicleResponse.data);

        // Fetch service history
        const serviceResponse = await axios.get(
          `${API_BASE_URL}/vehicle-service?vehicle_id=${activeTrip.vehicle_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setServiceHistory(serviceResponse.data);
      }
    } catch (error) {
      console.error('Error fetching vehicle info:', error);
      Alert.alert('Error', 'Failed to fetch vehicle information');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchVehicleInfo();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return '#10b981';
      case 'in_use': return '#3b82f6';
      case 'maintenance': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID');
  };

  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  const isDateNear = (dateString: string, days: number = 30) => {
    const targetDate = new Date(dateString);
    const today = new Date();
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= days && diffDays >= 0;
  };

  const isDateOverdue = (dateString: string) => {
    const targetDate = new Date(dateString);
    const today = new Date();
    return targetDate < today;
  };

  if (!vehicle) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="car" size={64} color="#9ca3af" />
          <Text style={styles.emptyStateText}>No Vehicle Assigned</Text>
          <Text style={styles.emptyStateSubtext}>
            You don't have any active trips with assigned vehicles
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
      {/* Vehicle Info Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Vehicle Information</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(vehicle.status) }]}>
            <Text style={styles.statusBadgeText}>{vehicle.status}</Text>
          </View>
        </View>
        
        <View style={styles.cardContent}>
          <View style={styles.vehicleIcon}>
            <Ionicons name="car" size={48} color="#3b82f6" />
          </View>
          
          <View style={styles.vehicleDetails}>
            <Text style={styles.licensePlate}>{vehicle.license_plate}</Text>
            <Text style={styles.vehicleType}>{vehicle.type}</Text>
            <Text style={styles.vehicleCapacity}>Capacity: {vehicle.capacity} kg</Text>
          </View>
        </View>
      </View>

      {/* Document Status */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Document Status</Text>
        </View>
        
        <View style={styles.cardContent}>
          {vehicle.stnk_number && (
            <View style={styles.documentItem}>
              <View style={styles.documentInfo}>
                <Text style={styles.documentLabel}>STNK</Text>
                <Text style={styles.documentValue}>{vehicle.stnk_number}</Text>
                {vehicle.stnk_expired_date && (
                  <Text style={[
                    styles.documentDate,
                    isDateOverdue(vehicle.stnk_expired_date) ? styles.overdueDate :
                    isDateNear(vehicle.stnk_expired_date) ? styles.nearDate : styles.normalDate
                  ]}>
                    Expires: {formatDate(vehicle.stnk_expired_date)}
                  </Text>
                )}
              </View>
              <Ionicons 
                name={
                  vehicle.stnk_expired_date && isDateOverdue(vehicle.stnk_expired_date) ? "alert-circle" :
                  vehicle.stnk_expired_date && isDateNear(vehicle.stnk_expired_date) ? "warning" : "checkmark-circle"
                } 
                size={24} 
                color={
                  vehicle.stnk_expired_date && isDateOverdue(vehicle.stnk_expired_date) ? "#ef4444" :
                  vehicle.stnk_expired_date && isDateNear(vehicle.stnk_expired_date) ? "#f59e0b" : "#10b981"
                } 
              />
            </View>
          )}

          {vehicle.tax_due_date && (
            <View style={styles.documentItem}>
              <View style={styles.documentInfo}>
                <Text style={styles.documentLabel}>Tax Due</Text>
                <Text style={[
                  styles.documentDate,
                  isDateOverdue(vehicle.tax_due_date) ? styles.overdueDate :
                  isDateNear(vehicle.tax_due_date) ? styles.nearDate : styles.normalDate
                ]}>
                  Due: {formatDate(vehicle.tax_due_date)}
                </Text>
              </View>
              <Ionicons 
                name={
                  isDateOverdue(vehicle.tax_due_date) ? "alert-circle" :
                  isDateNear(vehicle.tax_due_date) ? "warning" : "checkmark-circle"
                } 
                size={24} 
                color={
                  isDateOverdue(vehicle.tax_due_date) ? "#ef4444" :
                  isDateNear(vehicle.tax_due_date) ? "#f59e0b" : "#10b981"
                } 
              />
            </View>
          )}
        </View>
      </View>

      {/* Service Information */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Service Information</Text>
        </View>
        
        <View style={styles.cardContent}>
          <View style={styles.serviceInfo}>
            <View style={styles.serviceItem}>
              <Text style={styles.serviceLabel}>Last Service</Text>
              <Text style={styles.serviceValue}>
                {vehicle.last_service_date ? formatDate(vehicle.last_service_date) : 'No record'}
              </Text>
            </View>
            <View style={styles.serviceItem}>
              <Text style={styles.serviceLabel}>Next Service Due</Text>
              <Text style={[
                styles.serviceValue,
                vehicle.next_service_due && isDateNear(vehicle.next_service_due) ? styles.nearDate : styles.normalDate
              ]}>
                {vehicle.next_service_due ? formatDate(vehicle.next_service_due) : 'Not scheduled'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Service History */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Recent Service History</Text>
        </View>
        
        <View style={styles.serviceHistory}>
          {serviceHistory.length > 0 ? (
            serviceHistory.slice(0, 5).map((service, index) => (
              <View key={service.id} style={[styles.serviceHistoryItem, index > 0 && styles.serviceHistoryBorder]}>
                <View style={styles.serviceHistoryHeader}>
                  <Text style={styles.serviceHistoryType}>{service.service_type}</Text>
                  <Text style={styles.serviceHistoryCost}>{formatCurrency(service.total_cost)}</Text>
                </View>
                <Text style={styles.serviceHistoryDate}>{formatDate(service.service_date)}</Text>
                {service.note && (
                  <Text style={styles.serviceHistoryNote}>{service.note}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  card: {
    backgroundColor: 'white',
    margin: 16,
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
