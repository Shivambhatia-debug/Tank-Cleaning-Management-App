import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import AppHeader from '../../components/AppHeader';

const FONT_REGULAR = Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'System' });
const FONT_MEDIUM = Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: 'System' });

export default function StaffJobsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const response = await api.get(`/jobs?staffId=${user?.id}`);
      setJobs(response.data);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const totalEarned = jobs.filter((j: any) => j.status === 'completed').reduce((s: number, j: any) => s + (Number(j.incentivePerJob ?? j.incentive_per_job) || 0), 0);
  const thisMonthEarned = jobs
    .filter((j: any) => j.status === 'completed' && j.timeline?.completedAt) 
    .filter((j: any) => {
      const d = new Date(j.timeline.completedAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s: number, j: any) => s + (Number(j.incentivePerJob ?? j.incentive_per_job) || 0), 0);

  const onRefresh = () => {
    setRefreshing(true);
    loadJobs();
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return 'time-outline';
      case 'in_progress':
        return 'play-circle-outline';
      case 'completed':
        return 'checkmark-circle-outline';
      default:
        return 'help-circle-outline';
    }
  };

  const renderJob = ({ item }: { item: any }) => {
    const incentive = Number(item.incentivePerJob ?? item.incentive_per_job) || 0;
    return (
    <TouchableOpacity
      style={styles.jobCard}
      onPress={() => router.push({
        pathname: '/(staff)/job-detail',
        params: { jobId: item._id }
      })}
    >
      <View style={styles.jobHeader}>
        <Text style={styles.customerName}>{item.customerName}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Ionicons
            name={getStatusIcon(item.status) as any}
            size={16}
            color="#fff"
          />
          <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
        </View>
      </View>
      <View style={styles.jobInfo}>
        <Ionicons name="location-outline" size={16} color="#8E8E93" />
        <Text style={styles.address} numberOfLines={2}>
          {item.address}
        </Text>
      </View>
      <View style={styles.jobDetails}>
        <Text style={styles.detailLine}>📱 {item.mobileNumber || 'N/A'}</Text>
        <Text style={styles.detailLine}>🛢 {item.tankSize || '—'} • {item.serviceType || '—'}</Text>
        <Text style={styles.detailLine}>
          💰 {item.paymentStatus === 'paid' ? 'Paid' : 'Pending'} • {(item.serviceCharge ?? item.service_charge) > 0 ? `₹${Number(item.serviceCharge ?? item.service_charge).toLocaleString('en-IN')}` : 'Price on request'}
        </Text>
        <Text style={styles.incentiveLine}>
          👷 Incentive {item.status === 'completed' ? 'earned' : 'on completion'}: ₹{incentive.toLocaleString('en-IN')}
        </Text>
      </View>
      {item.notes && (
        <Text style={styles.notes} numberOfLines={2}>
          {item.notes}
        </Text>
      )}
      <View style={styles.jobFooter}>
        <Text style={styles.tapHint}>Tap to view details →</Text>
      </View>
    </TouchableOpacity>
  );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title={user?.name} subtitle="My Jobs" />

      <FlatList
        data={jobs}
        renderItem={renderJob}
        keyExtractor={(item) => item._id || item.id || String(Math.random())}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View style={styles.earningsCard}>
            <Text style={styles.earningsTitle}>💰 Your earnings (incentive)</Text>
            <View style={styles.earningsRow}>
              <Text style={styles.earningsLabel}>Total earned</Text>
              <Text style={styles.earningsValue}>₹{totalEarned.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.earningsRow}>
              <Text style={styles.earningsLabel}>This month</Text>
              <Text style={styles.earningsValue}>₹{thisMonthEarned.toLocaleString('en-IN')}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="briefcase-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyText}>No jobs assigned yet</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  earningsCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  earningsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
    fontFamily: FONT_MEDIUM,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  earningsLabel: {
    fontSize: 13,
    color: '#64748b',
    fontFamily: FONT_REGULAR,
  },
  earningsValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16a34a',
    fontFamily: FONT_MEDIUM,
  },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    fontFamily: FONT_MEDIUM,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
    fontFamily: FONT_MEDIUM,
  },
  jobInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  address: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
    fontFamily: FONT_REGULAR,
  },
  jobDetails: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f1f5f9',
    gap: 4,
  },
  detailLine: {
    fontSize: 12,
    color: '#475569',
    fontFamily: FONT_REGULAR,
  },
  incentiveLine: {
    fontSize: 13,
    color: '#16a34a',
    fontWeight: '700',
    marginTop: 4,
    fontFamily: FONT_MEDIUM,
  },
  notes: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 6,
    fontStyle: 'italic',
    fontFamily: FONT_REGULAR,
  },
  jobFooter: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f1f5f9',
  },
  tapHint: {
    fontSize: 12,
    color: '#0EA5E9',
    textAlign: 'right',
    fontWeight: '600',
    fontFamily: FONT_MEDIUM,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 12,
    fontFamily: FONT_REGULAR,
  },
});
