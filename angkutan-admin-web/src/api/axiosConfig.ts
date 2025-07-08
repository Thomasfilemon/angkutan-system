// src/api/axiosConfig.ts
import axios from "axios";

const BASE_API_URL =
  process.env.REACT_APP_API_URL || "http://localhost:3000/api";
const WEB_API_URL = BASE_API_URL.endsWith("/web")
  ? BASE_API_URL
  : `${BASE_API_URL}/web`;
const AUTH_API_URL = BASE_API_URL.replace("/web", "");

const safeHeaders = {
  "ngrok-skip-browser-warning": "true",
  "Content-Type": "application/json",
};

const apiClient = axios.create({
  baseURL: WEB_API_URL,
  timeout: 20000,
  headers: safeHeaders,
});

export const authClient = axios.create({
  baseURL: AUTH_API_URL,
  timeout: 20000,
  headers: safeHeaders,
});

// Request interceptors
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers["ngrok-skip-browser-warning"] = "true";
    return config;
  },
  (error) => Promise.reject(error)
);

authClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.url === "/auth/login") {
      config.url = "/auth/web/login";
    }

    config.headers["ngrok-skip-browser-warning"] = "true";
    return config;
  },
  (error) => Promise.reject(error)
);

// ✅ UPDATE: Keep response interceptor for all EXCEPT cash and big-delivery-orders endpoints
apiClient.interceptors.response.use(
  (response) => {
    // Skip interceptor for endpoints that need full response with pagination/stats
    if (
      response.config.url?.includes("/cash/") ||
      response.config.url?.includes("/big-delivery-orders") ||
      response.config.url?.includes("/trips") ||
      response.config.url?.includes("/purchase-orders") ||
      response.config.url?.includes("/payments") ||
      response.config.url?.includes("/delivery-orders")
    ) {
      return response; // Return full response for these endpoints
    }

    // Apply interceptor for all other endpoints (stock, purchase-orders, etc.)
    if (
      response.data &&
      response.data.success &&
      response.data.data !== undefined
    ) {
      return { ...response, data: response.data.data };
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

authClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes("/auth/web/login")
    ) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default apiClient;
