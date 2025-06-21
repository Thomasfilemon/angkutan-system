// app/map-view.web.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";

export default function MapViewScreen() {
  const { lat, lng, title, type } = useLocalSearchParams<{
    lat: string;
    lng: string;
    title: string;
    type: string;
  }>();

  const router = useRouter();
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  const handleOpenInGoogleMaps = () => {
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    window.open(googleMapsUrl, "_blank");
  };

  const getMarkerColor = () => {
    return type === "load" ? "#3498db" : "#e74c3c";
  };

  const getLocationIcon = () => {
    return type === "load" ? "arrow-up" : "arrow-down";
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <FontAwesome5 name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <TouchableOpacity
          onPress={handleOpenInGoogleMaps}
          style={styles.mapButton}
        >
          <FontAwesome5 name="external-link-alt" size={16} color="#fff" />
          <Text style={styles.mapButtonText}>Google Maps</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.webMapContainer}>
        <iframe
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${
            longitude - 0.01
          },${latitude - 0.01},${longitude + 0.01},${
            latitude + 0.01
          }&layer=mapnik&marker=${latitude},${longitude}`}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
          }}
          title="Location Map"
        />
      </View>

      <View style={styles.locationInfo}>
        <FontAwesome5
          name={getLocationIcon()}
          size={20}
          color={getMarkerColor()}
        />
        <View style={styles.locationDetails}>
          <Text style={styles.locationTitle}>{title}</Text>
          <Text style={styles.coordinates}>
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </Text>
          <Text style={styles.locationSubtitle}>
            {type === "load" ? "Loading Location" : "Unloading Location"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleOpenInGoogleMaps}
          style={styles.navigateButton}
        >
          <FontAwesome5 name="directions" size={16} color="#fff" />
          <Text style={styles.navigateText}>Navigate</Text>
        </TouchableOpacity>
      </View>
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
    justifyContent: "space-between",
    backgroundColor: "#2563eb",
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 16,
  },
  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  mapButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 4,
  },
  webMapContainer: {
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
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  locationDetails: {
    flex: 1,
    marginLeft: 12,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  locationSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
    marginTop: 2,
  },
  coordinates: {
    fontSize: 14,
    color: "#6b7280",
    fontFamily: "monospace",
  },
  navigateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  navigateText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 4,
  },
});
