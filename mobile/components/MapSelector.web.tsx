// mobile/components/MapSelector.web.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

interface MapSelectorProps {
  title: string;
  initialLocation?: Location;
  onLocationSelect: (location: Location) => void;
  onClose: () => void;
  visible: boolean;
}

const MapSelector: React.FC<MapSelectorProps> = ({
  title,
  initialLocation,
  onLocationSelect,
  onClose,
  visible,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Location[]>([]);

  const searchLocation = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=5`
      );
      const results = await response.json();

      if (results.length > 0) {
        const locations = results.map((result: any) => ({
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          address: result.display_name,
        }));
        setSearchResults(locations);
      } else {
        Alert.alert("Error", "Lokasi tidak ditemukan");
        setSearchResults([]);
      }
    } catch (error) {
      Alert.alert("Error", "Gagal mencari lokasi");
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectLocation = (location: Location) => {
    onLocationSelect(location);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <FontAwesome5 name="times" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Cari alamat atau lokasi..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={searchLocation}
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={searchLocation}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <FontAwesome5 name="search" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.infoContainer}>
            <FontAwesome5 name="info-circle" size={16} color="#3498db" />
            <Text style={styles.infoText}>
              Untuk pengalaman map yang optimal, gunakan aplikasi mobile. Di
              web, Anda dapat mencari dan memilih lokasi dari hasil pencarian.
            </Text>
          </View>

          {searchResults.length > 0 && (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsTitle}>Hasil Pencarian:</Text>
              {searchResults.map((location, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.resultItem}
                  onPress={() => handleSelectLocation(location)}
                >
                  <FontAwesome5
                    name="map-marker-alt"
                    size={16}
                    color="#3498db"
                  />
                  <View style={styles.resultTextContainer}>
                    <Text style={styles.resultAddress}>{location.address}</Text>
                    <Text style={styles.resultCoordinates}>
                      {location.latitude.toFixed(6)},{" "}
                      {location.longitude.toFixed(6)}
                    </Text>
                  </View>
                  <FontAwesome5 name="chevron-right" size={14} color="#666" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {initialLocation && (
            <View style={styles.currentLocationContainer}>
              <Text style={styles.currentLocationTitle}>Lokasi Saat Ini:</Text>
              <TouchableOpacity
                style={styles.resultItem}
                onPress={() => handleSelectLocation(initialLocation)}
              >
                <FontAwesome5 name="map-marker-alt" size={16} color="#27ae60" />
                <View style={styles.resultTextContainer}>
                  <Text style={styles.resultAddress}>
                    {initialLocation.address || "Lokasi yang sudah dipilih"}
                  </Text>
                  <Text style={styles.resultCoordinates}>
                    {initialLocation.latitude.toFixed(6)},{" "}
                    {initialLocation.longitude.toFixed(6)}
                  </Text>
                </View>
                <FontAwesome5 name="chevron-right" size={14} color="#666" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Batal</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  closeButton: { padding: 8 },
  content: { flex: 1, padding: 20 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#e3f2fd",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: "#1976d2",
    lineHeight: 20,
  },
  resultsContainer: { marginBottom: 20 },
  resultsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  currentLocationContainer: { marginBottom: 20 },
  currentLocationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  resultTextContainer: { flex: 1, marginLeft: 12 },
  resultAddress: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
    marginBottom: 4,
  },
  resultCoordinates: {
    fontSize: 12,
    color: "#666",
    fontFamily: "monospace",
  },
  actionButtons: {
    flexDirection: "row",
    padding: 16,
    paddingTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
  },
  cancelButtonText: { fontSize: 16, color: "#666", fontWeight: "600" },
});

export default MapSelector;
