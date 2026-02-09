import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import api from '../../utils/api';

const DEFAULT_REGION = {
  latitude: 26.1775,
  longitude: 85.8714,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function LiveMapScreen() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /** Job list dikhao pehle; ispe click karne par map khulega */
  const [selectedJobForMap, setSelectedJobForMap] = useState<any | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const res = await api.get('/jobs');
      const list = Array.isArray(res.data) ? res.data : [];
      setJobs(list);
      setSelectedJobForMap((prev) => {
        if (!prev) return null;
        const id = prev._id || prev.id;
        const stillExists = list.some((j: any) => (j._id || j.id) === id);
        return stillExists ? prev : null;
      });
    } catch (e) {
      setJobs([]);
      setSelectedJobForMap(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const onRefresh = () => {
    setRefreshing(true);
    loadJobs();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const inProgressJobs = jobs.filter((j: any) => j.status === 'in_progress');

  // Pehle job list dikhao — map mat dikhao
  if (!selectedJobForMap) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Live Tracking</Text>
            <Text style={styles.subtitle}>
              Select a job to see location on map
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} disabled={refreshing}>
            <Text style={styles.refreshButtonText}>{refreshing ? '...' : '🔄'}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          style={styles.jobListScroll}
          contentContainerStyle={styles.jobListContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {inProgressJobs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No active jobs</Text>
              <Text style={styles.emptySubtitle}>Jobs with status &quot;In progress&quot; will appear here. Tap one to see map.</Text>
            </View>
          ) : (
            inProgressJobs.map((job: any) => {
              const name = job.customerName || job.customer_name || 'Job';
              const staffCount = (job.assignedStaff || []).length;
              return (
                <TouchableOpacity
                  key={job._id || job.id}
                  style={styles.jobListCard}
                  onPress={() => setSelectedJobForMap(job)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.jobListCardTitle}>{name}</Text>
                  <Text style={styles.jobListCardAddress} numberOfLines={2}>{job.address}</Text>
                  <Text style={styles.jobListCardMeta}>
                    👷 {staffCount} staff assigned • Tap to see map
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Job select hone par: sirf us job ka map + location dikhao
  const job = selectedJobForMap;
  const jobLat = job.latitude ?? job.targetLatitude ?? DEFAULT_REGION.latitude;
  const jobLng = job.longitude ?? job.targetLongitude ?? DEFAULT_REGION.longitude;
  const mapRegion = {
    latitude: jobLat,
    longitude: jobLng,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };
  const staffList = Array.isArray(job.assignedStaff) ? job.assignedStaff : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => setSelectedJobForMap(null)}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title} numberOfLines={1}>
            {job.customerName || job.customer_name || 'Job'}
          </Text>
          <Text style={styles.subtitle}>Location on map</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.mapWrapper}>
        <MapView
          style={styles.map}
          initialRegion={mapRegion}
          showsUserLocation
          showsMyLocationButton
        >
          <Marker
            coordinate={{ latitude: jobLat, longitude: jobLng }}
            title={job.customerName || job.customer_name || 'Job'}
            description={job.address}
            pinColor="#007AFF"
          />
          {staffList.map((staff: any) => {
            if (staff == null || typeof staff !== 'object') return null;
            const slat = staff.lastLatitude;
            const slng = staff.lastLongitude;
            if (slat == null || slng == null) return null;
            return (
              <Marker
                key={staff._id || staff.id}
                coordinate={{ latitude: slat, longitude: slng }}
                title={staff.name || 'Staff'}
                description={staff.lastLocationTime ? new Date(staff.lastLocationTime).toLocaleTimeString() : ''}
                pinColor="#34C759"
              />
            );
          })}
        </MapView>
      </View>

      <View style={styles.mapJobDetail}>
        <Text style={styles.mapJobDetailTitle}>📍 {job.customerName || job.customer_name || 'Job'}</Text>
        <Text style={styles.mapJobDetailAddress}>{job.address}</Text>
        <Text style={styles.mapJobDetailCoords}>
          {jobLat.toFixed(4)}, {jobLng.toFixed(4)}
        </Text>
        {staffList.length > 0 && (
          <Text style={styles.mapJobDetailStaff}>
            👷 {(staffList as any[]).map((s: any) => s.name || s.phone).filter(Boolean).join(', ')}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 8,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  refreshButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  refreshButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  jobListScroll: {
    flex: 1,
  },
  jobListContent: {
    padding: 16,
    paddingBottom: 24,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  jobListCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  jobListCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  jobListCardAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  jobListCardMeta: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  mapWrapper: {
    flex: 1,
    minHeight: 220,
  },
  map: {
    flex: 1,
    width: '100%',
  },
  mapJobDetail: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    padding: 16,
  },
  mapJobDetailTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  mapJobDetailAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  mapJobDetailCoords: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  mapJobDetailStaff: {
    fontSize: 13,
    color: '#555',
  },
});
