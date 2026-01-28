import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import api from '../../utils/api';

const { width } = Dimensions.get('window');

export default function JobDetailScreen() {
  const { jobId } = useLocalSearchParams();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [locationSubscription, setLocationSubscription] = useState<any>(null);

  useEffect(() => {
    loadJob();
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  const loadJob = async () => {
    try {
      const response = await api.get(`/jobs/${jobId}`);
      setJob(response.data);
      
      if (response.data.status === 'in_progress') {
        setTracking(true);
      }
    } catch (error) {
      console.error('Error loading job:', error);
      Alert.alert('Error', 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const startJob = async () => {
    Alert.alert(
      'Start Job',
      'This will start location tracking. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            try {
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required');
                return;
              }

              await api.put(`/jobs/${jobId}`, {
                status: 'in_progress',
                start_time: new Date().toISOString(),
              });

              startLocationTracking();
              setTracking(true);
              loadJob();

              Alert.alert('Success', 'Job started! Location tracking is active.');
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to start job');
            }
          },
        },
      ]
    );
  };

  const startLocationTracking = async () => {
    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        async (location) => {
          try {
            await api.post('/location/update', {
              job_id: jobId,
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy,
            });
            console.log('Location updated:', location.coords.latitude, location.coords.longitude);
          } catch (error) {
            console.error('Error updating location:', error);
          }
        }
      );
      setLocationSubscription(subscription);
    } catch (error) {
      console.error('Error starting location tracking:', error);
    }
  };

  const completeJob = () => {
    Alert.alert(
      'Complete Job',
      'Mark this job as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              if (locationSubscription) {
                locationSubscription.remove();
                setLocationSubscription(null);
              }

              await api.put(`/jobs/${jobId}`, {
                status: 'completed',
                end_time: new Date().toISOString(),
              });

              setTracking(false);
              Alert.alert('Success', 'Job completed!', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error: any) {
              Alert.alert('Error', 'Failed to complete job');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FF9500';
      case 'in_progress':
        return '#34C759';
      case 'completed':
        return '#007AFF';
      default:
        return '#8E8E93';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.container}>
        <Text>Job not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Details</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.statusHeader}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(job.status) },
              ]}
            >
              <Text style={styles.statusText}>{job.status.replace('_', ' ')}</Text>
            </View>
          </View>

          {tracking && (
            <View style={styles.trackingIndicator}>
              <View style={styles.trackingDot} />
              <Text style={styles.trackingText}>Location tracking active</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.infoCard}>
            <Text style={styles.customerName}>{job.customer_name}</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📍</Text>
              <Text style={styles.infoText}>{job.address}</Text>
            </View>
          </View>
        </View>

        {job.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Special Instructions</Text>
            <View style={styles.infoCard}>
              <Text style={styles.notesText}>{job.notes}</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location on Map</Text>
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: job.latitude,
                longitude: job.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker
                coordinate={{
                  latitude: job.latitude,
                  longitude: job.longitude,
                }}
                title={job.customer_name}
                description={job.address}
              />
            </MapView>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {job.status === 'pending' && (
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.startButton} onPress={startJob}>
            <Text style={styles.startButtonText}>Start Job</Text>
          </TouchableOpacity>
        </View>
      )}

      {job.status === 'in_progress' && (
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.completeButton} onPress={completeJob}>
            <Text style={styles.completeButtonText}>Mark as Complete</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    width: 60,
  },
  backText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    paddingBottom: 8,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  trackingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
    marginRight: 8,
  },
  trackingText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  customerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  infoText: {
    fontSize: 15,
    color: '#666',
    flex: 1,
    lineHeight: 22,
  },
  notesText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  startButton: {
    backgroundColor: '#34C759',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  completeButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
