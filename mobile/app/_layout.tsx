import React, { useEffect, useRef } from "react";
import { Slot } from "expo-router";
import { AuthProvider } from "../src/contexts/AuthContext";
import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    // Listen for notifications when app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      // Optionally show a custom alert
      // Alert.alert(notification.request.content.title, notification.request.content.body);
    });

    // Listen for user interaction with notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      // You can navigate or handle data here
      // Example: console.log(response.notification.request.content.data);
    });

    return () => {
      if (notificationListener.current) Notifications.removeNotificationSubscription(notificationListener.current);
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  return (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  );
}
