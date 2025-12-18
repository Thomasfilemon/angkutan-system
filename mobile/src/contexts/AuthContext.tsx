// src/contexts/AuthContext.tsx

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import apiClient from "../services/api";
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

interface User {
  id: string;
  username: string;
  role: "admin" | "driver" | "owner";
  profile?: {
    full_name?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isSignedIn: boolean;
  signIn: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; error?: string; user?: User }>;
  signOut: () => Promise<void>;
  register: (
    userData: any
  ) => Promise<{ success: boolean; error?: string; data?: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      const storedToken = await AsyncStorage.getItem("token");
      const storedUser = await AsyncStorage.getItem("user");
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
      setIsLoading(false);
    })();
  }, []);

  // Helper function to get Expo push token (only works in development builds, not Expo Go)
  const getExpoPushToken = async (): Promise<string | null> => {
    try {
      // Check if we're running in Expo Go (push notifications not supported)
      const isExpoGo = Constants.appOwnership === 'expo';
      
      if (isExpoGo) {
        console.log('Push notifications not available in Expo Go. Use a development build for full functionality.');
        return null;
      }

      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
        return null;
      }

      // Get push token with projectId
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      
      return tokenData.data;
    } catch (error: any) {
      // Gracefully handle errors (e.g., in Expo Go or when notifications aren't available)
      console.warn('Failed to get Expo push token:', error.message);
      return null;
    }
  };

  // Update signIn function
  const signIn = async (username: string, password: string) => {
    try {
      // --- GET EXPO PUSH TOKEN (only if available) ---
      const expoPushToken = await getExpoPushToken();

      // --- LOGIN + SEND PUSH TOKEN TO BACKEND ---
      const { data } = await apiClient.post("/auth/mobile/login", {
        username,
        password,
        expoPushToken, // <-- Send token to backend (null if not available)
      });

      const { token: newToken, user: userData } = data;

      await AsyncStorage.setItem("token", newToken);
      await AsyncStorage.setItem("user", JSON.stringify(userData));

      setToken(newToken);
      setUser(userData);

      return { success: true, user: userData };
    } catch (err: any) {
      console.error("SignIn error:", err);

      let errorMessage = "Login gagal";

      if (err.response?.status === 401) {
        errorMessage = "Username atau password salah";
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const signOut = async () => {
    await AsyncStorage.multiRemove(["token", "user"]);
    setToken(null);
    setUser(null);
    router.replace("/(auth)/login");
  };

  const register = async (userData: any) => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.post("/auth/register", userData);
      return { success: true, data };
    } catch (err: any) {
      console.error("Register error:", err.response?.data || err.message);
      return {
        success: false,
        error: err.response?.data?.message || "Register gagal.",
      };
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isSignedIn: !!token,
        signIn,
        signOut,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
