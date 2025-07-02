// mobile/components/LoadConfirmationModal.tsx

import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

interface LoadConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (data: {
    actual_load_quantity: number;
    surat_jalan_photo: any;
  }) => void;
  minimalQuantity: number;
  isLoading: boolean;
}

const LoadConfirmationModal: React.FC<LoadConfirmationModalProps> = ({
  visible,
  onClose,
  onConfirm,
  minimalQuantity,
  isLoading,
}) => {
  const [actualQuantity, setActualQuantity] = useState("");
  const [suratJalanPhotos, setSuratJalanPhotos] = useState<any[]>([]);

  const handleImagePicker = () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files[0]) {
          const file = target.files[0];
          setSuratJalanPhotos([
            {
              uri: URL.createObjectURL(file),
              name: file.name,
              type: file.type,
            },
          ]);
        }
      };
      input.click();
    } else {
      Alert.alert(
        "Pilih Foto Surat Jalan",
        "Bagaimana cara Anda ingin mengambil foto?",
        [
          { text: "Kamera", onPress: takePicture },
          { text: "Galeri", onPress: pickFromGallery },
          { text: "Batal", style: "cancel" },
        ]
      );
    }
  };

  const takePicture = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Error", "Permission to access camera was denied");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        setSuratJalanPhotos([result.assets[0]]);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take picture");
    }
  };

  const pickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Error", "Permission to access gallery was denied");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        setSuratJalanPhotos((prev) => [...prev, result.assets[0]]);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleConfirm = () => {
    const quantity = parseFloat(actualQuantity);

    if (!actualQuantity || isNaN(quantity)) {
      Alert.alert("Error", "Masukkan berat muatan aktual yang valid");
      return;
    }

    if (quantity < minimalQuantity) {
      Alert.alert(
        "Error",
        `Muatan aktual (${quantity} ton) kurang dari minimal yang ditetapkan (${minimalQuantity} ton)`
      );
      return;
    }

    if (suratJalanPhotos.length === 0) {
      Alert.alert("Error", "Minimal 1 foto surat jalan harus diambil");
      return;
    }

    console.log("Photos to upload:", suratJalanPhotos);

    onConfirm({
      actual_load_quantity: quantity,
      surat_jalan_photo: suratJalanPhotos, // <-- send as array
    });
  };

  const resetForm = () => {
    setActualQuantity("");
    setSuratJalanPhotos([]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Konfirmasi Muatan</Text>
          <TouchableOpacity onPress={onClose} disabled={isLoading}>
            <FontAwesome5 name="times" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.infoSection}>
            <FontAwesome5 name="info-circle" size={20} color="#3498db" />
            <Text style={styles.infoText}>
              Masukkan berat muatan aktual yang sudah dimuat ke kendaraan dan
              ambil foto surat jalan.
            </Text>
          </View>

          <View style={styles.quantitySection}>
            <Text style={styles.label}>Berat Muatan</Text>
            <View style={styles.quantityInfo}>
              <Text style={styles.minimalText}>
                Minimal: {minimalQuantity} ton
              </Text>
            </View>
            <TextInput
              style={styles.input}
              value={actualQuantity}
              onChangeText={setActualQuantity}
              placeholder="Contoh: 3.2"
              keyboardType="numeric"
              editable={!isLoading}
            />
            <Text style={styles.unitText}>ton</Text>
          </View>

          <View style={styles.photoSection}>
            <Text style={styles.label}>Foto Surat Jalan *</Text>
            {suratJalanPhotos.length > 0 ? (
              <View>
                {suratJalanPhotos.map((photo, idx) => (
                  <View key={idx} style={styles.photoPreview}>
                    <Text>Foto {idx + 1}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setSuratJalanPhotos(
                          suratJalanPhotos.filter((_, i) => i !== idx)
                        );
                      }}
                    >
                      <Text style={{ color: "red" }}>Hapus</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={styles.changePhotoButton}
                  onPress={pickFromGallery}
                  disabled={isLoading}
                >
                  <Text style={styles.changePhotoText}>Tambah Foto</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.photoButton}
                onPress={pickFromGallery}
                disabled={isLoading}
              >
                <FontAwesome5 name="camera" size={24} color="#3498db" />
                <Text style={styles.photoButtonText}>
                  Ambil Foto Surat Jalan
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              resetForm();
              onClose();
            }}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Batal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              (!actualQuantity || suratJalanPhotos.length === 0 || isLoading) &&
                styles.disabledButton,
            ]}
            onPress={handleConfirm}
            disabled={!actualQuantity || suratJalanPhotos.length === 0 || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmButtonText}>
                Konfirmasi & Lanjutkan
              </Text>
            )}
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
  content: { flex: 1, padding: 20 },
  infoSection: {
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
  quantitySection: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: "600", color: "#333", marginBottom: 8 },
  quantityInfo: {
    backgroundColor: "#fff3cd",
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#ffc107",
  },
  minimalText: { fontSize: 14, color: "#856404", fontWeight: "500" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 18,
    backgroundColor: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  unitText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 5,
    fontWeight: "500",
  },
  photoSection: { marginBottom: 20 },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#3498db",
    borderStyle: "dashed",
    borderRadius: 8,
    paddingVertical: 20,
    backgroundColor: "#f8f9fa",
  },
  photoButtonText: {
    fontSize: 16,
    color: "#3498db",
    marginLeft: 10,
    fontWeight: "500",
  },
  photoPreview: {
    alignItems: "center",
    backgroundColor: "#e8f5e8",
    padding: 20,
    borderRadius: 8,
  },
  photoSuccessText: {
    fontSize: 16,
    color: "#27ae60",
    marginVertical: 10,
    fontWeight: "500",
  },
  changePhotoButton: {
    backgroundColor: "#6c757d",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  changePhotoText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  actions: {
    flexDirection: "row",
    padding: 20,
    paddingTop: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
    marginRight: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
  },
  cancelButtonText: { fontSize: 16, color: "#666", fontWeight: "600" },
  confirmButton: {
    flex: 1,
    paddingVertical: 15,
    marginLeft: 10,
    borderRadius: 8,
    backgroundColor: "#27ae60",
    alignItems: "center",
  },
  confirmButtonText: { fontSize: 16, color: "#fff", fontWeight: "600" },
  disabledButton: { backgroundColor: "#ccc" },
});

export default LoadConfirmationModal;
