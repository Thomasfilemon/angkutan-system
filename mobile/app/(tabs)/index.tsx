import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator, // Import ActivityIndicator for loading states
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router'; // Import useFocusEffect for better data fetching
import { useAuth } from '../../src/contexts/AuthContext';
import axios from 'axios';

// The Trip interface remains the same
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
  // Destructure all necessary values from useAuth, including loading and signed-in states
  const { user, token, isSignedIn, isLoading: isAuthLoading } = useAuth();
  
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Default to true for initial load
  const [refreshing, setRefreshing] = useState(false);

  const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

  // --- FIXED DATA FETCHING LOGIC ---

  const fetchTrips = useCallback(async () => {
    // Guard Clause: Don't fetch if the user isn't signed in or if data is missing.
    if (!isSignedIn || !user || !token) {
      console.log('Auth not ready or user not signed in. Skipping fetch.');
      setIsLoading(false); // Ensure loading state is turned off
      setRefreshing(false);
      // Clear data if user logs out
      setActiveTrip(null);
      setRecentTrips([]);
      return;
    }

    // Don't set isLoading(true) here, let the initial loading state handle it.
    // Set it only for pull-to-refresh.
    if (!refreshing) {
        setIsLoading(true);
    }

    try {
      // Now `user.id` and `token` are guaranteed to be available
      const response = await axios.get(`${API_BASE_URL}/trips?driver_id=${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Defensive Check: Ensure the API returned an array before processing it.
      if (Array.isArray(response.data)) {
        const trips: Trip[] = response.data;
        const active = trips.find((trip) =>
          ['on_progress', 'otw', 'perjalanan_pulang'].includes(trip.status)
        );
        const recent = trips.filter((trip) => trip.status === 'selesai').slice(0, 5);

        setActiveTrip(active || null);
        setRecentTrips(recent);
      } else {
        console.error('API did not return an array for trips:', response.data);
        Alert.alert('Error', 'Received unexpected data from the server.');
      }
    } catch (error) {
      console.error('Error fetching trips:', error);
      Alert.alert('Error', 'Failed to fetch trips. Please pull to refresh.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [isSignedIn, user, token, refreshing]); // Add dependencies to useCallback

  // Use useFocusEffect to fetch data when the screen comes into view.
  // This is better than useEffect for tab screens.
  useFocusEffect(
    useCallback(() => {
      // Only run fetchTrips if the authentication process is complete.
      if (!isAuthLoading) {
        fetchTrips();
      }
    }, [isAuthLoading, fetchTrips])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // The fetchTrips function will be re-run with refreshing=true
  }, []);
  
  // --- END OF FIXED LOGIC ---


  // The rest of your component logic remains the same
  const updateTripStatus = async (tripId: number, newStatus: string) => {
    // This function will now work correctly because `token` is guaranteed to be valid
    try {
      await axios.patch(
        `${API_BASE_URL}/trips/${tripId}/${newStatus}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const statusMessages = {
        otw: 'Perjalanan dimulai',
        sampai_tujuan: 'Sudah sampai tujuan',
        selesai: 'Trip selesai'
      };
      
      Alert.alert('Success', statusMessages[newStatus as keyof typeof statusMessages] || 'Status updated!');
      fetchTrips(); // Refetch data to update the UI
    } catch (error) {
      console.error('Error updating trip status:', error);
      Alert.alert('Error', 'Failed to update trip status');
    }
  };

  const openMap = (lat: number, lng: number) => {
    Alert.alert('Open Maps', `Opening maps for coordinates: ${lat}, ${lng}`);
    // Implement map opening logic here
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
  
  // --- ROBUST LOADING AND RENDER LOGIC ---

  // Show a loading indicator while auth status is being checked or initial data is being fetched.
  if (isAuthLoading || (isLoading && !refreshing)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 10, color: '#6b7280' }}>
          {isAuthLoading ? 'Authenticating...' : 'Loading trips...'}
        </Text>
      </View>
    );
  }

  // Show a message if the user is not logged in after auth check is complete.
  if (!isSignedIn) {
      return (
          <View style={styles.centered}>
              <Ionicons name="log-in-outline" size={40} color="#6b7280" />
              <Text style={{ marginTop: 10, fontSize: 16, color: '#6b7280' }}>
                  Please log in to view your trips.
              </Text>
          </View>
      );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563eb"]} />
      }
    >
      {/* Header (Your existing UI) */}
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

      {/* The rest of your UI remains the same */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View>
            <Text style={styles.statusLabel}>Current Status</Text>
            <Text style={styles.statusValue}>{activeTrip ? 'On Trip' : 'Available'}</Text>
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
      {activeTrip ? (
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
                style={[styles.actionButton, { backgroundColor: '#6b7280', marginTop: 8 }]}
                onPress={() => Alert.alert('Add Expense', 'This feature is coming soon!')}
              >
                <Ionicons name="add" size={20} color="white" />
                <Text style={styles.actionButtonText}>Tambah Pengeluaran</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.tripCard}>
            <View style={styles.centeredContent}>
                <Ionicons name="trail-sign-outline" size={40} color="#9ca3af" />
                <Text style={styles.placeholderText}>No active trip at the moment.</Text>
            </View>
        </View>
      )}

      {/* Recent Trips */}
      <View style={styles.tripCard}>
        <View style={styles.tripHeader}>
          <Text style={styles.tripTitle}>Recent Trips</Text>
        </View>
        <View style={styles.tripList}>
          {recentTrips.length > 0 ? recentTrips.map((trip, index) => (
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
                {new Date(trip.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
              </Text>
            </View>
          )) : (
            <View style={styles.centeredContent}>
                <Ionicons name="file-tray-outline" size={30} color="#9ca3af" />
                <Text style={styles.placeholderText}>No recent trips to show.</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

// Your existing styles, with one addition for the loading screen
const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: '#2563eb',
    padding: 16,
    paddingTop: 50, // Added padding for status bar area
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  driverName: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  driverId: {
    color: '#bfdbfe',
    fontSize: 14,
  },
  notificationButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2563eb'
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: -20, // Overlap with header
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  statusRight: {
    alignItems: 'flex-end',
  },
  statusValueBold: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  tripCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden', // Ensure content respects border radius
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
    fontSize: 18,
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
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  destinationText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  mapButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
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
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
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
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  tripList: {
    paddingBottom: 8,
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
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  tripItemDetails: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  tripItemDate: {
    fontSize: 14,
    color: '#9ca3af',
  },
  centeredContent: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 16,
    color: '#6b7280'
  }
});

