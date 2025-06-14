// src/services/api.js

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// Create a dedicated axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'ngrok-skip-browser-warning': 'true', // Keep your ngrok header
    'Content-Type': 'application/json',
  },
});

// Use an interceptor to inject the token into every request
apiClient.interceptors.request.use(
  async (config) => {
    // Get the token from storage
    const token = await AsyncStorage.getItem('token');
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

export default apiClient;
