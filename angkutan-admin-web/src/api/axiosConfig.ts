// src/api/axiosConfig.ts
import axios from "axios";

const BASE_API_URL =
  process.env.REACT_APP_API_URL || "http://localhost:3000/api";
const WEB_API_URL = BASE_API_URL.endsWith("/web")
  ? BASE_API_URL
  : `${BASE_API_URL}/web`;
const AUTH_API_URL = BASE_API_URL.replace("/web", "");

// Default headers - do not force Content-Type here because some requests
// (FormData multipart uploads) must let the browser set the Content-Type
// including the boundary. We'll add an interceptor below to remove
// Content-Type when sending FormData.
const defaultHeaders = {
  "ngrok-skip-browser-warning": "true",
};

const apiClient = axios.create({
  baseURL: WEB_API_URL,
  timeout: 20000,
  headers: defaultHeaders,
});

export const authClient = axios.create({
  baseURL: AUTH_API_URL,
  timeout: 20000,
  headers: defaultHeaders,
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

// Remove Content-Type header when sending FormData so browser can set the
// correct multipart boundary. Also handle x-www-form-urlencoded if needed.
apiClient.interceptors.request.use(
  (config) => {
    try {
      if (config.data instanceof FormData && config.headers) {
        // axios may have headers defined in different places; remove common keys
        if (config.headers["Content-Type"])
          delete config.headers["Content-Type"];
        if (config.headers.common && config.headers.common["Content-Type"]) {
          delete config.headers.common["Content-Type"];
        }
        // Some environments use lowercase header keys
        if (config.headers["content-type"])
          delete config.headers["content-type"];
        if (config.headers.common && config.headers.common["content-type"]) {
          delete config.headers.common["content-type"];
        }
      }
    } catch (e) {
      // don't block requests on interceptor errors
      console.warn("Error in FormData request interceptor", e);
    }
    return config;
  },
  (err) => Promise.reject(err)
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
