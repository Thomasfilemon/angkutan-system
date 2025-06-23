// app/trip-map-view.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  Alert,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";

export default function TripMapViewScreen() {
  const {
    doId,
    loadLat,
    loadLng,
    loadAddress,
    unloadLat,
    unloadLng,
    unloadAddress,
    status,
    doNumber,
  } = useLocalSearchParams<{
    doId: string;
    loadLat: string;
    loadLng: string;
    loadAddress: string;
    unloadLat: string;
    unloadLng: string;
    unloadAddress: string;
    status: string;
    doNumber: string;
  }>();

  const router = useRouter();

  const loadLatitude = parseFloat(loadLat);
  const loadLongitude = parseFloat(loadLng);
  const unloadLatitude = parseFloat(unloadLat);
  const unloadLongitude = parseFloat(unloadLng);

  // Calculate center point for map
  const centerLat = (loadLatitude + unloadLatitude) / 2;
  const centerLng = (loadLongitude + unloadLongitude) / 2;

  // Calculate zoom level based on distance
  const latDiff = Math.abs(loadLatitude - unloadLatitude);
  const lngDiff = Math.abs(loadLongitude - unloadLongitude);
  const maxDiff = Math.max(latDiff, lngDiff);
  const zoomPadding = maxDiff + 0.02; // Add padding

  const handleNavigateToLocation = async (
    type: "load" | "unload",
    app: "google" | "waze"
  ) => {
    const lat = type === "load" ? loadLatitude : unloadLatitude;
    const lng = type === "load" ? loadLongitude : unloadLongitude;
    const address = type === "load" ? loadAddress : unloadAddress;

    let url = "";

    if (app === "google") {
      if (Platform.OS === "ios") {
        url = `http://maps.apple.com/?q=${lat},${lng}`;
      } else {
        url = `geo:${lat},${lng}?q=${lat},${lng}(${
          type === "load" ? "Loading" : "Unloading"
        } Location)`;
      }
    } else if (app === "waze") {
      url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          "Error",
          `${app === "google" ? "Maps" : "Waze"} app not installed`
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to open navigation app");
    }
  };

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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{doNumber}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(status) },
            ]}
          >
            <Text style={styles.statusText}>{getStatusText(status)}</Text>
          </View>
        </View>
      </View>

      {/* Main Content: Make Scrollable */}
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Map Container */}
        {Platform.OS === "web" ? (
          <View style={[styles.mapContainer, { minHeight: 400, height: 400 }]}>
            <iframe
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                centerLng - zoomPadding
              },${centerLat - zoomPadding},${centerLng + zoomPadding},${
                centerLat + zoomPadding
              }&layer=mapnik&marker=${loadLatitude},${loadLongitude}&marker=${unloadLatitude},${unloadLongitude}`}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                minHeight: 400,
              }}
              title="Trip Route Map"
            />
          </View>
        ) : (
          <View style={styles.mobileMapContainer}>
            <View style={styles.mapPlaceholder}>
              <FontAwesome5 name="route" size={64} color="#3b82f6" />
              <Text style={styles.mapPlaceholderText}>
                Route from Loading to Unloading Location
              </Text>
              <Text style={styles.mapPlaceholderSubtext}>
                Use navigation buttons below to open in your preferred map app
              </Text>
            </View>
          </View>
        )}

        {/* Location Cards */}
        <View style={styles.locationsContainer}>
          {/* Loading Location Card */}
          <View style={[styles.locationCard, styles.loadLocationCard]}>
            <View style={styles.locationHeader}>
              <FontAwesome5 name="arrow-up" size={20} color="#3498db" />
              <Text style={styles.locationTitle}>Loading Location</Text>
            </View>
            <Text style={styles.locationAddress}>{loadAddress}</Text>
            <Text style={styles.coordinates}>
              {loadLatitude.toFixed(6)}, {loadLongitude.toFixed(6)}
            </Text>
            <View style={styles.locationButtons}>
              <TouchableOpacity
                style={[styles.locationNavButton, styles.googleButton]}
                onPress={() => handleNavigateToLocation("load", "google")}
              >
                <FontAwesome5 name="directions" size={14} color="#fff" />
                <Text style={styles.locationNavText}>Maps</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.locationNavButton, styles.wazeButton]}
                onPress={() => handleNavigateToLocation("load", "waze")}
              >
                <FontAwesome5 name="route" size={14} color="#fff" />
                <Text style={styles.locationNavText}>Waze</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Route Arrow */}
          <View style={styles.routeArrow}>
            <FontAwesome5 name="arrow-down" size={24} color="#6b7280" />
          </View>

          {/* Unloading Location Card */}
          <View style={[styles.locationCard, styles.unloadLocationCard]}>
            <View style={styles.locationHeader}>
              <FontAwesome5 name="arrow-down" size={20} color="#e74c3c" />
              <Text style={styles.locationTitle}>Unloading Location</Text>
            </View>
            <Text style={styles.locationAddress}>{unloadAddress}</Text>
            <Text style={styles.coordinates}>
              {unloadLatitude.toFixed(6)}, {unloadLongitude.toFixed(6)}
            </Text>
            <View style={styles.locationButtons}>
              <TouchableOpacity
                style={[styles.locationNavButton, styles.googleButton]}
                onPress={() => handleNavigateToLocation("unload", "google")}
              >
                <FontAwesome5 name="directions" size={14} color="#fff" />
                <Text style={styles.locationNavText}>Maps</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.locationNavButton, styles.wazeButton]}
                onPress={() => handleNavigateToLocation("unload", "waze")}
              >
                <FontAwesome5 name="route" size={14} color="#fff" />
                <Text style={styles.locationNavText}>Waze</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f6f8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563eb",
    paddingTop: Platform.OS === "web" ? 20 : 32,
    paddingHorizontal: 16,
    paddingBottom: 8,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  mapContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    backgroundColor: "#fff",
  },
  mobileMapContainer: {
    flex: 1,
    margin: 16,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mapPlaceholderText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
  },
  locationsContainer: {
    padding: 16,
  },
  locationCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  loadLocationCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#3498db",
  },
  unloadLocationCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#e74c3c",
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginLeft: 12,
  },
  locationAddress: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 8,
    lineHeight: 20,
  },
  coordinates: {
    fontSize: 12,
    color: "#9ca3af",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginBottom: 12,
  },
  locationButtons: {
    flexDirection: "row",
    gap: 8,
  },
  locationNavButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
  },
  googleButton: {
    backgroundColor: "#4285f4",
  },
  wazeButton: {
    backgroundColor: "#33ccff",
  },
  locationNavText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 6,
  },
  routeArrow: {
    alignItems: "center",
    paddingVertical: 12,
  },
});
