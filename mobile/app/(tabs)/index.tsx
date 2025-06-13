// app/(tabs)/trips.tsx
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

interface Trip {
  id: number;
  driver_id: number;
  vehicle_id: number;
  drop_lat: number;
  drop_lng: number;
  ritase: number;
  tarif_per_ritase: number;
  status: 'on_progress' | 'otw' | 'perjalanan_pulang' | 'selesai';
  created_at: string;
  vehicle?: {
    license_plate: string;
    type: string;
  };
}

export default function TripsScreen() {
  const { user, token } = useAuth();
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const API_BASE_URL = 'https://localhost:3000/api';

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API_BASE_URL}/trips?driver_id=${user?.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const trips = response.data;
      const active = trips.find((trip: Trip) => 
        ['on_progress', 'otw', 'perjalanan_pulang'].includes(trip.status)
      );
      const recent = trips.filter((trip: Trip) => trip.status === 'selesai').slice(0, 5);
      
      setActiveTrip(active || null);
      setRecentTrips(recent);
    } catch (error) {
      console.error('Error fetching trips:', error);
      Alert.alert('Error', 'Failed to fetch trips');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const updateTripStatus = async (tripId: number, newStatus: string) => {
    try {
      await axios.patch(
        `${API_BASE_URL}/trips/${tripId}/${newStatus}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchTrips();
      
      const statusMessages = {
        otw: 'Perjalanan dimulai',
        sampai_tujuan: 'Sudah sampai tujuan',
        perjalanan_pulang: 'Mulai perjalanan pulang',
        selesai: 'Trip selesai'
      };
      
      Alert.alert('Success', statusMessages[newStatus as keyof typeof statusMessages]);
    } catch (error) {
      console.error('Error updating trip status:', error);
      Alert.alert('Error', 'Failed to update trip status');
    }
  };

  const openMap = (lat: number, lng: number) => {
    Alert.alert('Open Maps', `Opening maps for coordinates: ${lat}, ${lng}`);
    // Implement map opening logic here
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTrips();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on_progress': return '#fbbf24';
      case 'otw': return '#3b82f6';
      case 'perjalanan_pulang': return '#8b5cf6';
      case 'selesai': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'on_progress': return 'On Progress';
      case 'otw': return 'OTW';
      case 'perjalanan_pulang': return 'Pulang';
      case 'selesai': return 'Selesai';
      default: return status;
    }
  };

  const renderActionButton = (trip: Trip) => {
    switch (trip.status) {
      case 'on_progress':
        return (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#3b82f6' }]}
            onPress={() => updateTripStatus(trip.id, 'otw')}
          >
            <Ionicons name="car" size={20} color="white" />
            <Text style={styles.actionButtonText}>Mulai Perjalanan</Text>
          </TouchableOpacity>
        );
      case 'otw':
        return (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#10b981' }]}
            onPress={() => updateTripStatus(trip.id, 'sampai_tujuan')}
          >
            <Ionicons name="location" size={20} color="white" />
            <Text style={styles.actionButtonText}>Sampai Tujuan</Text>
          </TouchableOpacity>
        );
      case 'perjalanan_pulang':
        return (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#059669' }]}
            onPress={() => updateTripStatus(trip.id, 'selesai')}
          >
            <Ionicons name="checkmark-circle" size={20} color="white" />
            <Text style={styles.actionButtonText}>Selesai</Text>
          </TouchableOpacity>
        );
      default:
        return null;
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.profile?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U'}
            </Text>
          </View>
          <View>
            <Text style={styles.driverName}>
              {user?.profile?.full_name || user?.username}
            </Text>
            <Text style={styles.driverId}>Driver ID: {user?.id}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <Ionicons name="notifications" size={24} color="white" />
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationBadgeText}>2</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View>
            <Text style={styles.statusLabel}>Current Status</Text>
            <Text style={styles.statusValue}>Available</Text>
          </View>
          <View style={styles.statusRight}>
            <Text style={styles.statusLabel}>Vehicle</Text>
            <Text style={styles.statusValueBold}>
              {activeTrip?.vehicle?.license_plate || 'No Vehicle'}
            </Text>
          </View>
        </View>
      </View>

      {/* Active Trip */}
      {activeTrip && (
        <View style={styles.tripCard}>
          <View style={styles.tripHeader}>
            <Text style={styles.tripTitle}>Active Trip #{activeTrip.id}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(activeTrip.status) }]}>
              <Text style={styles.statusBadgeText}>{getStatusText(activeTrip.status)}</Text>
            </View>
          </View>
          
          <View style={styles.tripContent}>
            <View style={styles.destinationSection}>
              <Text style={styles.sectionLabel}>Destination</Text>
              <Text style={styles.destinationText}>
                Lat: {activeTrip.drop_lat}, Lng: {activeTrip.drop_lng}
              </Text>
              <TouchableOpacity 
                style={styles.mapButton}
                onPress={() => openMap(activeTrip.drop_lat, activeTrip.drop_lng)}
              >
                <Ionicons name="map" size={16} color="#3b82f6" />
                <Text style={styles.mapButtonText}>Open in Maps</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tripDetails}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Ritase</Text>
                <Text style={styles.detailValue}>{activeTrip.ritase}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Tarif/Ritase</Text>
                <Text style={styles.detailValue}>
                  Rp {activeTrip.tarif_per_ritase?.toLocaleString('id-ID')}
                </Text>
              </View>
            </View>

            <View style={styles.actionSection}>
              {renderActionButton(activeTrip)}
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: '#3b82f6', marginTop: 8 }]}
                onPress={() => {/* Navigate to expense form */}}
              >
                <Ionicons name="add" size={20} color="white" />
                <Text style={styles.actionButtonText}>Tambah Pengeluaran</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Recent Trips */}
      <View style={styles.tripCard}>
        <View style={styles.tripHeader}>
          <Text style={styles.tripTitle}>Recent Trips</Text>
        </View>
        <View style={styles.tripList}>
          {recentTrips.map((trip, index) => (
            <View key={trip.id} style={[styles.tripItem, index > 0 && styles.tripItemBorder]}>
              <View style={styles.tripItemHeader}>
                <Text style={styles.tripItemTitle}>Trip #{trip.id}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(trip.status) }]}>
                  <Text style={styles.statusBadgeText}>{getStatusText(trip.status)}</Text>
                </View>
              </View>
              <Text style={styles.tripItemDetails}>
                {trip.vehicle?.type} - {trip.ritase} Ritase
              </Text>
              <Text style={styles.tripItemDate}>
                {new Date(trip.created_at).toLocaleDateString('id-ID')}
              </Text>
            </View>
          ))}
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
  header: {
    backgroundColor: '#2563eb',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  driverName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  driverId: {
    color: '#bfdbfe',
    fontSize: 12,
  },
  notificationButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  statusRight: {
    alignItems: 'flex-end',
  },
  statusValueBold: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  tripCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tripTitle: {
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
  tripContent: {
    padding: 16,
  },
  destinationSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  destinationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  mapButtonText: {
    color: '#3b82f6',
    fontSize: 12,
    marginLeft: 4,
  },
  tripDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  actionSection: {
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  tripList: {
    paddingBottom: 16,
  },
  tripItem: {
    padding: 16,
  },
  tripItemBorder: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  tripItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripItemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  tripItemDetails: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  tripItemDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
});
