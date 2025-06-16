// mobile/app/(tabs)/_layout.tsx
import React from "react";
import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";
import { useAuth } from "../../src/contexts/AuthContext";

export default function TabsLayout() {
  const { isSignedIn, isLoading, signOut, user } = useAuth();

  // Jika masih loading auth, jangan render apa‑apa
  if (isLoading) return null;

  // Kalau belum login, lempar ke login
  if (!isSignedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user?.role === "admin") {
    return <Redirect href="/(admin)" />;
  }

  const handleSignOut = () => {
    signOut();
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#6b7280",
        headerShown: true,
        headerStyle: { backgroundColor: "#2563eb" },
        headerTintColor: "white",
        headerTitleStyle: { fontWeight: "600" },
        headerRight: () => (
          <TouchableOpacity
            onPress={handleSignOut}
            style={{ marginRight: 16, padding: 8 }}
          >
            <Ionicons name="log-out-outline" size={24} color="white" />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Trips",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "car" : "car-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      {/* Tambah screen lain sesuai folder (tabs)/index */}
      <Tabs.Screen
        name="vehicle"
        options={{
          title: "Vehicle",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={
                focused ? "information-circle" : "information-circle-outline"
              }
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expenses",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "receipt" : "receipt-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
