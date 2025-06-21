// components/DocumentImageViewer.tsx
import React from "react";
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

type DocumentImageViewerProps = {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
};

export default function DocumentImageViewer({
  visible,
  imageUrl,
  onClose,
}: DocumentImageViewerProps) {
  if (!imageUrl) return null;
  const getApiHost = () => {
    const url = process.env.EXPO_PUBLIC_API_BASE_URL!;
    return url.endsWith("/api") ? url.replace(/\/api$/, "") : url;
  };
  const fullImageUrl = imageUrl?.startsWith("http")
    ? imageUrl
    : `${getApiHost()}/${
        imageUrl.startsWith("/") ? imageUrl.slice(1) : imageUrl
      }`;
  // For web, you might want to use a <dialog> or just a full-screen div/modal
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <FontAwesome5 name="times" size={24} color="#fff" />
        </TouchableOpacity>
        <Image
          source={
            Platform.OS === "web"
              ? { uri: fullImageUrl }
              : { uri: fullImageUrl }
          }
          style={styles.image}
          resizeMode="contain"
          onError={(e) => {
            console.log("Image load error:", e.nativeEvent.error);
            alert("Failed to load image. Check the URL or network.");
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  image: { width: "90%", height: "80%" },
  closeBtn: { position: "absolute", top: 40, right: 30, zIndex: 10 },
});
