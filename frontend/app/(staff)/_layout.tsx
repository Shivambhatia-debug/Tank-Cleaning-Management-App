
import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

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
      const userJson = await AsyncStorage.getItem('user');
      if (!userJson) return;
      const user = JSON.parse(userJson);
      const staffId = user._id || user.id;

      const location = locations[0];
      if (!location) return;

      await fetch(`${API_URL}/location/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        })
      });
    } catch (err) {
      console.error('Background update failed:', err);
    }
  }
});

export default function StaffLayout() {
  const { user } = useAuth();

  useEffect(() => {
    const startTracking = async () => {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Foreground location access is required.');
        return;
      }

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        Alert.alert('Background Permission', 'Please allow "Always" location access for seamless tracking.');
      }

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
    };

    const stopTracking = async () => {
      try {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      } catch (e) {
        // Ignore if already stopped
      }
    };

    if (user && user.role === 'staff') {
      startTracking();
    } else {
      stopTracking();
    }
  }, [user]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0EA5E9',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          borderTopColor: '#E8E8ED',
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 80 : 60,
          backgroundColor: '#fff',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'My Jobs',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="job-detail"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
