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
  ) => Promise<{ success: boolean; error?: string }>;
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

  const signIn = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const { data } = await apiClient.post("/auth/mobile/login", {
        username,
        password,
      });
      const { token: newToken, user: userData } = data;

      await AsyncStorage.setItem("token", newToken);
      await AsyncStorage.setItem("user", JSON.stringify(userData));

      setToken(newToken);
      setUser(userData);

      return { success: true };
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || err.message || "Login failed";
      console.error("SignIn error:", { message: errorMessage });
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
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
