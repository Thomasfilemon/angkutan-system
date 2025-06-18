// src/services/api.js

import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

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

// === EXISTING FUNCTIONS ===
export const getPoDetailsForNewDo = (poId) => {
  return apiClient.get(`/purchase-orders/${poId}/details`);
};

export const getDeliveryOrderDetails = (id) => {
  return apiClient.get(`/delivery-orders/${id}`);
};

export const createDriverExpense = (expenseData) => {
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

  if (expenseData.receipt) {
    console.log("Adding receipt to form data:", expenseData.receipt);
    try {
      formData.append("receipt", expenseData.receipt);
    } catch (error) {
      console.error("Error appending receipt to FormData:", error);
    }
  }

  return apiClient.post("/driver-expenses", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
      "X-Debug-Info": "trip-expense-submission",
    },
    timeout: 30000,
  });
};

// === NEW STATUS UPDATE FUNCTIONS ===
export const updateDeliveryStatus = (doId, action) => {
  return apiClient.patch(`/delivery-orders/${doId}/status`, { action });
};

export const confirmLoad = (doId, loadData) => {
  const formData = new FormData();

  formData.append(
    "actual_load_quantity",
    loadData.actual_load_quantity.toString()
  );

  if (loadData.surat_jalan_photo) {
    formData.append("surat_jalan_photo", loadData.surat_jalan_photo);
  }

  return apiClient.post(`/delivery-orders/${doId}/confirm-load`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 30000,
  });
};

export const getLoadStatus = (doId) => {
  return apiClient.get(`/delivery-orders/${doId}/load-status`);
};

export default apiClient;
