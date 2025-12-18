import React, { useEffect, useRef } from "react";
import { Slot } from "expo-router";
import { AuthProvider } from "../src/contexts/AuthContext";
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';

// Set up notification handler (only if notifications are available)
try {
  const isExpoGo = Constants.appOwnership === 'expo';
  
  if (!isExpoGo) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch (error) {
  console.warn('Failed to set up notification handler:', error);
}

export default function RootLayout() {
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    const isExpoGo = Constants.appOwnership === 'expo';
    
    // Skip notification listeners in Expo Go (notifications not fully supported)
    if (isExpoGo) {
      return;
    }

    try {
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
    } catch (error) {
      console.warn('Failed to set up notification listeners:', error);
    }

    return () => {
      try {
        if (notificationListener.current) {
          Notifications.removeNotificationSubscription(notificationListener.current);
        }
        if (responseListener.current) {
          Notifications.removeNotificationSubscription(responseListener.current);
        }
      } catch (error) {
        console.warn('Error cleaning up notification listeners:', error);
      }
    };
  }, []);

  return (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  );
}
