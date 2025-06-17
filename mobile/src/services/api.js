// src/services/api.js

import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// Create a dedicated axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "ngrok-skip-browser-warning": "true", // Keep your ngrok header
    "Content-Type": "application/json",
  },
});

// Use an interceptor to inject the token into every request
apiClient.interceptors.request.use(
  async (config) => {
    // Get the token from storage
    const token = await AsyncStorage.getItem("token");
    if (token) {
      // If the token exists, add it to the Authorization header
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    // Handle request errors
    return Promise.reject(error);
  }
);

export const getPoDetailsForNewDo = (poId) => {
  return apiClient.get(`/purchase-orders/${poId}/details`);
};

export const getDeliveryOrderDetails = (id) => {
  return apiClient.get(`/delivery-orders/${id}`);
};

// Fix createDriverExpense untuk better web support
export const createDriverExpense = (expenseData) => {
  console.log("createDriverExpense called with:", expenseData);

  const formData = new FormData();

  // Basic data
  formData.append(
    "delivery_order_id",
    expenseData.delivery_order_id.toString()
  );
  formData.append("jenis", expenseData.jenis);
  formData.append("amount", expenseData.amount.toString());

  if (expenseData.notes) {
    formData.append("notes", expenseData.notes);
  }

  // Receipt file handling with better logging
  if (expenseData.receipt) {
    console.log("Adding receipt to form data:", expenseData.receipt);

    try {
      // Handle both web and mobile formats
      formData.append("receipt", expenseData.receipt);
    } catch (error) {
      console.error("Error appending receipt to FormData:", error);
    }
  }

  // Log the entire FormData for debugging
  console.log("FormData created for submission");

  // Add debug headers for easier troubleshooting
  return apiClient.post("/driver-expenses", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
      "X-Debug-Info": "trip-expense-submission",
    },
    timeout: 30000, // Increase timeout for file uploads
  });
};

export default apiClient;
