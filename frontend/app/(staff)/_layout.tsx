
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import Constants from 'expo-constants';

const LOCATION_TASK_NAME = 'background-location-task';

// Dynamic URL Logic (Redundant but needed globally for Task)
let API_URL = 'http://localhost:8002/api';
if (process.env.EXPO_PUBLIC_BACKEND_URL) {
  API_URL = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
} else {
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(':')[0];
  if (localhost) API_URL = `http://${localhost}:8002/api`;
}

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    try {
      // Get Staff ID from storage (since we're outside React Context)
      const userJson = await AsyncStorage.getItem('user');
      if (!userJson) return; // No login, no track
      const user = JSON.parse(userJson);
      const staffId = user._id || user.id;

      const location = locations[0];
      if (!location) return;

      // Send to REST Endpoint
      await fetch(`${API_URL}/location/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        })
      });
      console.log('📍 Background Location Sent:', location.coords.latitude, location.coords.longitude);
    } catch (err) {
      console.error('Background update failed:', err);
    }
  }
});

export default function StaffLayout() {
  const { user } = useAuth();

  useEffect(() => {
    const startTracking = async () => {
      // 1. Permissions (Foreground & Background)
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Foreground location access is required.');
        return;
      }

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        Alert.alert('Background Permission', 'Please allow "Always" location access for seamless tracking.');
        // Don't return, try foreground at least
      }

      // 2. Start Service
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 5,
        foregroundService: {
          notificationTitle: "Tank Cleaning App",
          notificationBody: "Tracking your location for jobs..."
        },
        pausesUpdatesAutomatically: false,
      });
      console.log('✅ Background Location Service Started');
    };

    const stopTracking = async () => {
      try {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log('🛑 Location Service Stopped');
      } catch (e) {
        // Ignore if already stopped
      }
    };

    if (user && user.role === 'staff') {
      startTracking();
    } else {
      // If no user (logout) or not staff, maybe stop? 
      // User asked: "logout k baad v" -> So maybe we DON'T stop?
      // But we need staffId. If user is null, asyncStorage might be cleared?
      // If asyncStorage is cleared, the task will fail gracefully.
      // So technically, we can leave it running, but it won't send data.
      stopTracking();
    }

    // Cleanup? No, we want it to persist. 
    // Only stop if role changes or explicit logout logic calls it.
  }, [user]);

  const styles = StyleSheet.create({
    trackingBar: {
      backgroundColor: '#059669',
      paddingVertical: 6,
      paddingTop: 28,
      alignItems: 'center',
    },
    trackingText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
  });

  return (
    <View style={{ flex: 1 }}>
      {user && user.role === 'staff' && (
        <View style={styles.trackingBar}>
          <Text style={styles.trackingText}>● Live tracking active</Text>
        </View>
      )}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="jobs" />
      </Stack>
    </View>
  );
}
