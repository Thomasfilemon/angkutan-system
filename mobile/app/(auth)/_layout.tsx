import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';

export default function AuthLayout() {
  const { isSignedIn, isLoading } = useAuth();

  if (isLoading) {
    return null; // or a loading screen
  }

  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
