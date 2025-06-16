// mobile/app/(auth)/_layout.tsx
import React from "react";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";

export default function AuthLayout() {
  const { isSignedIn, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  // Jika sudah login, langsung ke root (yang akan masuk ke (tabs) layout)
  if (isSignedIn) {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="login"
        options={{
          title: "Login",
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          title: "Register",
        }}
      />
    </Stack>
  );
}
