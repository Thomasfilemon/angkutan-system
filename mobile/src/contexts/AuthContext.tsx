// src/contexts/AuthContext.js

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
// --- 1. Import your new dedicated API client ---
import apiClient from '../services/api';

// User and AuthContextType interfaces remain the same
interface User {
  id: string;
  username: string;
  role: 'admin' | 'driver' | 'owner';
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
  signIn: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  register: (userData: any) => Promise<{ success: boolean; error?: string; data?: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // This effect runs once on app start to load auth state from storage
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async (): Promise<void> => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');

      if (storedToken && storedUser) {
        // --- 2. Simplified Logic ---
        // Just load the data into React state. The apiClient interceptor will
        // handle getting the token from storage when it's needed for an API call.
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        console.log('Auth state loaded from storage into context.');
      }
    } catch (error) {
      console.error('Failed to load auth state from storage:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      // --- 3. Use the apiClient for the login request ---
      const response = await apiClient.post('/auth/mobile/login', {
        username,
        password,
      });

      const { token: newToken, user: userData } = response.data;

      // Store token and user data in AsyncStorage
      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('user', JSON.stringify(userData));

      // Update React state
      setToken(newToken);
      setUser(userData);

      console.log('Sign in successful. Token stored.');
      return { success: true };
    } catch (error: any) {
      console.error('Sign in error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Login failed. Please check your credentials.',
      };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      // --- 4. Simplified signOut ---
      // Clear data from storage and state. No need to touch axios headers.
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      setToken(null);
      setUser(null);
      
      console.log('Sign out complete. Navigating to login.');
      router.replace('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const register = async (userData: any): Promise<{ success: boolean; error?: string; data?: any }> => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/register', userData);
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('Registration error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Registration failed.',
      };
    } finally {
      setIsLoading(false);
    }
  };

  const contextValue: AuthContextType = {
    user,
    token,
    isLoading,
    isSignedIn: !!token, // A more reliable check is for the token's existence
    signIn,
    signOut,
    register,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
