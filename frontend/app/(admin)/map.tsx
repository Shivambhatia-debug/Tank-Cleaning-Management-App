import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import api from '../../utils/api';

const { width, height } = Dimensions.get('window');

export default function LiveMapScreen() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState(false);
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState({
    latitude: 12.9716,
    longitude: 77.5946,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  });

  useEffect(() => {
    requestLocationPermission();
    loadJobs();
    const interval = setInterval(loadJobs, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
        const location = await Location.getCurrentPositionAsync({});
        setRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        });
      } else {
        Alert.alert('Permission Denied', 'Location permission is required for maps');
      }
    } catch (error) {
      console.error('Location permission error:', error);
    }
  };

  const loadJobs = async () => {
    try {
      const response = await api.get('/jobs?status=in_progress');
      const jobsData = response.data;
      
      // Load latest locations for each job
      const jobsWithLocations = await Promise.all(
        jobsData.map(async (job: any) => {
          try {
            const locResponse = await api.get(`/location/latest/${job.id}`);
            return {
              ...job,
              currentLocation: locResponse.data,
            };
          } catch (error) {
            return job;
          }
        })
      );
      
      setJobs(jobsWithLocations);
      
      // Fit map to show all markers
      if (jobsWithLocations.length > 0 && mapRef.current) {
        const coordinates = jobsWithLocations
          .filter(j => j.currentLocation)
          .map(j => ({
            latitude: j.currentLocation.latitude,
            longitude: j.currentLocation.longitude,
          }));
        
        if (coordinates.length > 0) {
          mapRef.current.fitToCoordinates(coordinates, {
            edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
            animated: true,
          });
        }
      }
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMarkerColor = (status: string) => {
    switch (status) {
      case 'in_progress':
        return '#34C759';
      case 'completed':
        return '#007AFF';
      default:
        return '#FF9500';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Live Tracking</Text>
          <Text style={styles.subtitle}>{jobs.length} active jobs</Text>
        </View>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        showsUserLocation={locationPermission}
        showsMyLocationButton={true}
        showsCompass={true}
        showsTraffic={false}
      >
        {jobs.map((job) => {
          const location = job.currentLocation || {
            latitude: job.latitude,
            longitude: job.longitude,
          };
          
          return (
            <React.Fragment key={job.id}>
              {/* Job destination marker */}
              <Marker
                coordinate={{
                  latitude: job.latitude,
                  longitude: job.longitude,
                }}
                title={job.customer_name}
                description={job.address}
                pinColor="#FF3B30"
              />
              
              {/* Current staff location marker */}
              {job.currentLocation && (
                <Marker
                  coordinate={location}
                  title={`Staff on the way`}
                  description={`Moving to ${job.customer_name}`}
                >
                  <View style={[styles.staffMarker, { borderColor: getMarkerColor(job.status) }]}>
                    <View style={[styles.staffMarkerInner, { backgroundColor: getMarkerColor(job.status) }]} />
                  </View>
                </Marker>
              )}
              
              {/* Route line from staff to destination */}
              {job.currentLocation && (
                <Polyline
                  coordinates={[
                    location,
                    { latitude: job.latitude, longitude: job.longitude },
                  ]}
                  strokeColor="#007AFF"
                  strokeWidth={3}
                  lineDashPattern={[1, 10]}
                />
              )}
            </React.Fragment>
          );
        })}
      </MapView>

      {jobs.length === 0 && (
        <View style={styles.emptyOverlay}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📍</Text>
            <Text style={styles.emptyText}>No active jobs</Text>
            <Text style={styles.emptySubtext}>Jobs will appear when staff start working</Text>
          </View>
        </View>
      )}

      {/* Job info cards at bottom */}
      {jobs.length > 0 && (
        <View style={styles.bottomSheet}>
          <Text style={styles.sheetTitle}>Active Jobs</Text>
          {jobs.map((job) => (
            <TouchableOpacity
              key={job.id}
              style={styles.jobCard}
              onPress={() => {
                if (job.currentLocation) {
                  mapRef.current?.animateToRegion({
                    latitude: job.currentLocation.latitude,
                    longitude: job.currentLocation.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  });
                }
              }}
            >
              <View style={styles.jobCardHeader}>
                <Text style={styles.jobCardTitle}>{job.customer_name}</Text>
                <View style={[styles.statusDot, { backgroundColor: getMarkerColor(job.status) }]} />
              </View>
              <Text style={styles.jobCardAddress} numberOfLines={1}>
                {job.address}
              </Text>
              {job.currentLocation && (
                <Text style={styles.jobCardLocation}>
                  📍 Staff location: {job.currentLocation.latitude.toFixed(4)}, {job.currentLocation.longitude.toFixed(4)}
                </Text>
              )}
            </TouchableOpacity>
          ))}
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
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 6,
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  map: {
    flex: 1,
    width: '100%',
  },
  staffMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  staffMarkerInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  emptyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: height * 0.35,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  jobCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  jobCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  jobCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  jobCardAddress: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  jobCardLocation: {
    fontSize: 11,
    color: '#007AFF',
    fontFamily: 'monospace',
  },
});
