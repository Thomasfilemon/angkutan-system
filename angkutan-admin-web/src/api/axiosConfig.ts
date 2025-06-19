// src/api/axiosConfig.ts

import axios from 'axios';

// Create a new axios instance
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: {
    // --- ADD THIS LINE ---
    'ngrok-skip-browser-warning': 'true' 
  }
});

// Add a request interceptor to include the token in every request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;
