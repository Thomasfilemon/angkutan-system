// mobile/app/(admin)/_layout.tsx

import React from "react";
import { Pressable } from "react-native";
import { Redirect, Stack, useRouter } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";

export default function AdminLayout() {
  const { user, isSignedIn, isLoading, signOut } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user?.role !== "admin") {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: "#2563eb" },
        headerTintColor: "white",
        headerRight: () => (
          <Pressable
            onPress={signOut}
            style={({ pressed }) => ({
              opacity: pressed ? 0.5 : 1,
              marginRight: 15,
            })}
          >
            <Ionicons name="log-out-outline" size={24} color="white" />
          </Pressable>
        ),
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Admin Dashboard",
        }}
      />
      <Stack.Screen
        name="create-trip"
        options={{
          title: "Create New Trip",
        }}
      />
      <Stack.Screen
        name="do-detail/[id]"
        options={{
          title: "Delivery Order Details",
        }}
      />
    </Stack>
  );
}
