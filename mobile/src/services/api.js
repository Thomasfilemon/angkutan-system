// src/services/api.js

import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { router } from "expo-router";

const API_BASE_URL = "https://b023b7fef46b.ngrok-free.app/api";

// Create a dedicated axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "ngrok-skip-browser-warning": "true",
    "Content-Type": "application/json",
  },
});

// Use an interceptor to inject the token into every request
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// === RESPONSE INTERCEPTOR UNTUK HANDLE 401 ===
apiClient.interceptors.response.use(
  (response) => {
    // Jika response berhasil, return seperti biasa
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const isLoginEndpoint =
      originalRequest?.url?.includes("/auth/login") ||
      originalRequest?.url?.includes("/auth/mobile/login");
    // Handle error response
    if (error.response?.status === 401 && !isLoginEndpoint) {
      console.log("Token expired or invalid, logging out...");

      // Clear stored auth data
      await AsyncStorage.multiRemove(["token", "user"]);
      // Redirect ke login
      router.replace("/(auth)/login");

      // Optional: Show alert
      if (typeof window !== "undefined") {
        setTimeout(() => {
          alert("Sesi Anda telah berakhir. Silakan login kembali.");
        }, 100);
      }
    }

    return Promise.reject(error);
  }
);

// === FUNGSI HELPER BARU UNTUK MENAMBAHKAN FILE KE FORMDATA ===
const appendFileToFormData = async (formData, fieldName, fileData) => {
  if (!fileData) return;

  let fileUri = fileData.uri;
  let ext = "jpg";

  // Defensive: prefer fileName extension if available
  if (
    fileData.fileName &&
    typeof fileData.fileName === "string" &&
    fileData.fileName.includes(".")
  ) {
    ext = fileData.fileName.split(".").pop();
  } else if (fileUri && typeof fileUri === "string" && fileUri.includes(".")) {
    ext = fileUri.split(".").pop();
  }

  let mimeType = fileData.mimeType || "image/jpeg";
  if (ext === "png") mimeType = "image/png";
  if (ext === "pdf") mimeType = "application/pdf";

  if (Platform.OS === "web") {
    const response = await fetch(fileUri);
    const blob = await response.blob();
    formData.append(
      fieldName,
      blob,
      fileData.fileName || fileData.name || `file.${ext}`
    );
  } else {
    if (!fileUri) {
      console.warn("No fileUri for fileData:", fileData);
      return;
    }
    formData.append(fieldName, {
      uri: fileUri,
      name: fileData.fileName || `file.${ext}`,
      type: mimeType,
    });
  }
};

// === EXISTING FUNCTIONS ===
export const getPoDetailsForNewDo = (poId) => {
  return apiClient.get(`/purchase-orders/${poId}/details`);
};

export const getDeliveryOrderDetails = (id) => {
  return apiClient.get(`/delivery-orders/${id}`);
};

export const createDriverExpense = async (expenseData) => {
  // Pastikan async
  console.log("createDriverExpense called with:", expenseData);

  const formData = new FormData();

  formData.append(
    "delivery_order_id",
    expenseData.delivery_order_id.toString()
  );
  formData.append("jenis", expenseData.jenis);
  formData.append("amount", expenseData.amount.toString());

  if (expenseData.notes) {
    formData.append("notes", expenseData.notes);
  }

  // Gunakan fungsi helper untuk receipt
  await appendFileToFormData(formData, "receipt", expenseData.receipt);

  console.log("FormData created for submission (createDriverExpense)");
  return apiClient.post("/driver-expenses", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 0, // Set timeout to 0 (no timeout) or a very high value for file uploads
  });
};

export const confirmLoad = async (doId, loadData) => {
  try {
    const formData = new FormData();

    formData.append(
      "actual_load_quantity",
      loadData.actual_load_quantity.toString()
    );

    if (Array.isArray(loadData.surat_jalan_photo)) {
      for (let i = 0; i < loadData.surat_jalan_photo.length; i++) {
        const photo = loadData.surat_jalan_photo[i];
        if (photo && photo.uri) {
          const ext = photo.uri.split(".").pop() || "jpg";
          await appendFileToFormData(
            formData,
            "surat_jalan_photo",
            {
              ...photo,
              fileName: photo.fileName || `surat_jalan_${i}.${ext}`,
              mimeType: photo.mimeType || "image/jpeg",
            }
          );
        } else {
          console.warn("Skipping photo without uri:", photo);
        }
      }
    } else if (loadData.surat_jalan_photo && loadData.surat_jalan_photo.uri) {
      const photo = loadData.surat_jalan_photo;
      const ext = photo.uri.split(".").pop() || "jpg";
      await appendFileToFormData(
        formData,
        "surat_jalan_photo",
        {
          ...photo,
          fileName: photo.fileName || `surat_jalan.${ext}`,
          mimeType: photo.mimeType || "image/jpeg",
        }
      );
    }

    // Log form data for debugging
    console.log("FormData contents:");
    for (const [key, value] of formData.entries()) {
      console.log(key, value);
    }

    return apiClient.post(`/delivery-orders/${doId}/confirm-load`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 30000,
    });
  } catch (error) {
    console.error("Error in confirmLoad API call:", {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
    });
    throw error;
  }
};

export const updateDeliveryStatus = (doId, action) => {
  const endpointMapping = {
    start_to_load: `${doId}/start-to-load`,
    arrive_at_load: `${doId}/arrive-at-load`,
    arrive_at_unload: `${doId}/arrive-at-unload`,
    start_return: `${doId}/start-return`,
    complete: `${doId}/complete`,
  };

  const endpoint = endpointMapping[action];
  if (!endpoint) {
    return Promise.reject(new Error(`Invalid action: ${action}`));
  }

  return apiClient.patch(`/delivery-orders/${endpoint}`);
};

export const getLoadStatus = (doId) => {
  return apiClient.get(`/delivery-orders/${doId}/load-status`);
};

export default apiClient;
