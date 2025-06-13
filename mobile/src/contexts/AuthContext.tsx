import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router } from 'expo-router';

// User interface
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

// Auth context interface
interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isSignedIn: boolean;
  signIn: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  register: (userData: any) => Promise<{ success: boolean; error?: string; data?: any }>;
}

// Create context with undefined as initial value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook with proper error handling
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Provider props interface
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [token, setToken] = useState<string | null>(null);

  // Keep your original API URL
  const API_BASE_URL = 'https://192.168.1.7:3000/api';

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async (): Promise<void> => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      
      console.log('Loading stored auth - Token exists:', !!storedToken);
      console.log('Loading stored auth - User exists:', !!storedUser);
      
      if (storedToken && storedUser) {
        // Set token and user immediately without validation
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        
        console.log('Auth loaded successfully from storage');
      } else {
        console.log('No stored auth found');
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
      // Clear potentially corrupted data
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    } finally {
      setIsLoading(false);
    }
  };


  const signIn = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      
      const response = await axios.post(`${API_BASE_URL}/auth/mobile/login`, {
        username,
        password,
      });

      const { token: newToken, user: userData } = response.data;

      // Store token and user data
      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      
      console.log('Token stored successfully:', newToken.substring(0, 20) + '...');

      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

      // Update state
      setToken(newToken);
      setUser(userData);

      return { success: true };
    } catch (error: any) {
      console.error('Sign in error:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
      };
    } finally {
      setIsLoading(false);
    }
  };

  // In your AuthContext, add this to the signOut function
  const signOut = async (): Promise<void> => {
    try {
      console.log('=== SIGNOUT FUNCTION CALLED ===');
      console.log('Current user before signOut:', user);
      console.log('Current token before signOut:', token);
      
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');

      delete axios.defaults.headers.common['Authorization'];

      setToken(null);
      setUser(null);
      
      console.log('=== SIGNOUT COMPLETED ===');
      console.log('User after signOut:', null);
      console.log('About to navigate to /login');
      
      router.replace('/login');
      
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };


  const register = async (userData: any): Promise<{ success: boolean; error?: string; data?: any }> => {
    try {
      setIsLoading(true);
      
      const response = await axios.post(`${API_BASE_URL}/auth/register`, userData);

      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed',
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Create the context value object
  const contextValue: AuthContextType = {
    user,
    token,
    isLoading,
    isSignedIn: !!user,
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
