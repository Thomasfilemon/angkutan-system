// mobile/components/MapSelector.native.tsx
import React, { useState, useRef, useEffect } from "react";
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
import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";

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
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(
    initialLocation || null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const mapRef = useRef<MapView>(null);

  // Default center (Jakarta)
  const defaultLocation = {
    latitude: -6.2088,
    longitude: 106.8456,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  useEffect(() => {
    if (visible) {
      getCurrentLocation();
    }
  }, [visible]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Error", "Permission to access location was denied");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const current = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setCurrentLocation(current);

      if (!selectedLocation) {
        setSelectedLocation(current);
      }
    } catch (error) {
      console.log("Error getting location:", error);
    }
  };

  const searchLocation = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=1`
      );
      const results = await response.json();

      if (results.length > 0) {
        const result = results[0];
        const location = {
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          address: result.display_name,
        };

        setSelectedLocation(location);

        if (mapRef.current) {
          mapRef.current.animateToRegion({
            ...location,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      } else {
        Alert.alert("Error", "Lokasi tidak ditemukan");
      }
    } catch (error) {
      Alert.alert("Error", "Gagal mencari lokasi");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMapPress = async (event: any) => {
    const coordinate = event.nativeEvent.coordinate;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordinate.latitude}&lon=${coordinate.longitude}`
      );
      const result = await response.json();

      setSelectedLocation({
        ...coordinate,
        address: result.display_name || "Alamat tidak diketahui",
      });
    } catch (error) {
      setSelectedLocation(coordinate);
    }
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onLocationSelect(selectedLocation);
      onClose();
    }
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

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructions}>
            Tap pada map untuk memilih lokasi atau gunakan pencarian di atas
          </Text>
        </View>

        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={
              selectedLocation
                ? {
                    ...selectedLocation,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }
                : defaultLocation
            }
            onPress={handleMapPress}
          >
            {currentLocation && (
              <Marker
                coordinate={currentLocation}
                title="Lokasi Saya"
                pinColor="blue"
              />
            )}
            {selectedLocation && (
              <Marker
                coordinate={selectedLocation}
                title="Lokasi Dipilih"
                pinColor="red"
                draggable
                onDragEnd={handleMapPress}
              />
            )}
          </MapView>
        </View>

        {selectedLocation && (
          <View style={styles.locationInfo}>
            <Text style={styles.locationLabel}>Lokasi Dipilih:</Text>
            <Text style={styles.locationText}>
              {selectedLocation.address ||
                `${selectedLocation.latitude.toFixed(
                  6
                )}, ${selectedLocation.longitude.toFixed(6)}`}
            </Text>
          </View>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Batal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              !selectedLocation && styles.disabledButton,
            ]}
            onPress={handleConfirm}
            disabled={!selectedLocation}
          >
            <Text style={styles.confirmButtonText}>Konfirmasi</Text>
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
  searchContainer: {
    flexDirection: "row",
    margin: 16,
    alignItems: "center",
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
  instructionsContainer: { paddingHorizontal: 16, marginBottom: 8 },
  instructions: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    fontStyle: "italic",
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  map: { flex: 1 },
  locationInfo: {
    margin: 16,
    padding: 12,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: "row",
    padding: 16,
    paddingTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
  },
  cancelButtonText: { fontSize: 16, color: "#666", fontWeight: "600" },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: "#3b82f6",
    alignItems: "center",
  },
  confirmButtonText: { fontSize: 16, color: "#fff", fontWeight: "600" },
  disabledButton: { backgroundColor: "#ccc" },
});

export default MapSelector;
