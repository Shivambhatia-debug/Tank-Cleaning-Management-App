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
import api from '../../utils/api';

// Haversine distance (meters) between two lat/lng points
const distanceInMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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

  // Job select hone par: dummy layout + distance (no real map)
  const job = selectedJobForMap;
  const jobLat = job.latitude ?? job.targetLatitude ?? null;
  const jobLng = job.longitude ?? job.targetLongitude ?? null;
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

      <View style={styles.mapJobDetail}>
        <Text style={styles.mapJobDetailTitle}>
          📍 {job.customerName || job.customer_name || 'Job'}
        </Text>
        <Text style={styles.mapJobDetailAddress}>{job.address}</Text>

        {jobLat != null && jobLng != null && (
          <Text style={styles.mapJobDetailCoords}>
            Target coords: {jobLat.toFixed(4)}, {jobLng.toFixed(4)}
          </Text>
        )}

        <View style={styles.trackingBox}>
          <Text style={styles.trackingTitle}>Live distance (dummy map)</Text>
          {staffList.length === 0 && (
            <Text style={styles.trackingSub}>
              No staff assigned or no live location yet.
            </Text>
          )}
          {staffList.map((staff: any) => {
            if (!staff || typeof staff !== 'object') return null;
            const slat = staff.lastLatitude;
            const slng = staff.lastLongitude;
            if (
              slat == null ||
              slng == null ||
              jobLat == null ||
              jobLng == null
            ) {
              return (
                <View
                  key={staff._id || staff.id || staff.phone}
                  style={styles.distanceRow}
                >
                  <Text style={styles.distanceLabel}>
                    {staff.name || staff.phone || 'Staff'} – waiting for GPS...
                  </Text>
                </View>
              );
            }
            const dMeters = distanceInMeters(slat, slng, jobLat, jobLng);
            const dKm = dMeters / 1000;
            const reached = dMeters <= 50; // ~50m radius ko "arrived" maan lo
            return (
              <View
                key={staff._id || staff.id || staff.phone}
                style={styles.distanceRow}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.distanceLabel}>
                    {staff.name || staff.phone || 'Staff'}
                  </Text>
                  <Text style={styles.distanceValue}>
                    Current distance from job:{' '}
                    {dMeters < 1000
                      ? `${dMeters.toFixed(0)} m`
                      : `${dKm.toFixed(2)} km`}
                  </Text>
                  {staff.lastLocationTime && (
                    <Text style={styles.distanceMeta}>
                      Last update:{' '}
                      {new Date(staff.lastLocationTime).toLocaleTimeString()}
                    </Text>
                  )}
                </View>
                <View>
                  <Text
                    style={[
                      styles.distanceBadge,
                      reached && styles.arrivedBadge,
                    ]}
                  >
                    {reached ? 'ARRIVED' : 'ON THE WAY'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
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
  trackingBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  trackingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  trackingSub: {
    fontSize: 13,
    color: '#6b7280',
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingVertical: 6,
  },
  distanceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  distanceValue: {
    fontSize: 13,
    color: '#4b5563',
    marginTop: 2,
  },
  distanceMeta: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  distanceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
  },
  arrivedBadge: {
    color: '#166534',
    backgroundColor: '#bbf7d0',
  },
});
