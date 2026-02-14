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

  const getIncentiveWithFuel = (j: any) => {
    const firstStaff = (j.assignedStaff && j.assignedStaff[0]) ? j.assignedStaff[0] : null;
    const tankCount = Number(j.tankCount ?? j.tank_count ?? 1);
    const perTank = Number(firstStaff?.perTankIncentive ?? firstStaff?.per_tank_incentive ?? 0);
    const perJob = Number(firstStaff?.defaultPerJobIncentive ?? firstStaff?.default_per_job_incentive ?? 0);
    const staffFuel = Number(firstStaff?.defaultFuelExpense ?? firstStaff?.default_fuel_expense ?? 0);
    const totalWithFuel = tankCount * perTank + perJob + staffFuel;
    if (firstStaff && (perTank > 0 || perJob > 0 || staffFuel > 0)) return totalWithFuel;
    return Number(j.incentivePerJob ?? j.incentive_per_job) || 0;
  };

  const totalEarned = jobs.filter((j: any) => j.status === 'completed').reduce((s: number, j: any) => s + getIncentiveWithFuel(j), 0);
  const thisMonthEarned = jobs
    .filter((j: any) => j.status === 'completed' && j.timeline?.completedAt)
    .filter((j: any) => {
      const d = new Date(j.timeline.completedAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s: number, j: any) => s + getIncentiveWithFuel(j), 0);

  const onRefresh = () => {
    setRefreshing(true);
    loadJobs();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FF9500';
      case 'on_the_way':
        return '#f59e0b';
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
      case 'on_the_way':
        return 'car-outline';
      case 'in_progress':
        return 'play-circle-outline';
      case 'completed':
        return 'checkmark-circle-outline';
      default:
        return 'help-circle-outline';
    }
  };

  const renderJob = ({ item }: { item: any }) => {
    const incentive = getIncentiveWithFuel(item);
    const firstStaff = (item.assignedStaff && item.assignedStaff[0]) ? item.assignedStaff[0] : null;
    const tankCount = Number(item.tankCount ?? item.tank_count ?? 1);
    const perTank = Number(firstStaff?.perTankIncentive ?? firstStaff?.per_tank_incentive ?? 0);
    const perJob = Number(firstStaff?.defaultPerJobIncentive ?? firstStaff?.default_per_job_incentive ?? 0);
    const staffFuel = Number(firstStaff?.defaultFuelExpense ?? firstStaff?.default_fuel_expense ?? 0);
    const hasBreakdown = firstStaff && (perTank > 0 || perJob > 0 || staffFuel > 0);
    const Row = ({ label, value, valueBold }: { label: string; value: string; valueBold?: boolean }) => (
      <View style={styles.tableRow}>
        <Text style={styles.tableLabel}>{label}</Text>
        <Text style={[styles.tableValue, valueBold && styles.tableValueBold]} numberOfLines={1}>{value}</Text>
      </View>
    );
    return (
    <TouchableOpacity
      style={styles.jobCard}
      activeOpacity={0.8}
      onPress={() => router.push({
        pathname: '/(staff)/job-detail',
        params: { jobId: item._id }
      })}
    >
      <View style={styles.jobHeader}>
        <Text style={styles.customerName}>{item.customerName}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Ionicons name={getStatusIcon(item.status) as any} size={14} color="#fff" />
          <Text style={styles.statusText}>{item.status === 'on_the_way' ? 'On the Way' : item.status.replace('_', ' ')}</Text>
        </View>
      </View>

      <View style={styles.tableBox}>
        <Row label="Location" value={item.address || '—'} />
        <Row label="Contact" value={item.mobileNumber || 'N/A'} />
        <Row label="Tank" value={`${item.tankSize || '—'} • ${item.serviceType || '—'}`} />
        <Row label="No. of tanks" value={String(tankCount)} />
        <Row
          label="Payment"
          value={item.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
        />
        <Row
          label="Service charge"
          value={(item.serviceCharge ?? item.service_charge) > 0 ? `₹${Number(item.serviceCharge ?? item.service_charge).toLocaleString('en-IN')}` : 'On request'}
        />
      </View>

      <View style={styles.incentiveBox}>
        <Text style={styles.incentiveBoxTitle}>Incentive {item.status === 'completed' ? 'earned' : 'on completion'}</Text>
        {hasBreakdown ? (
          <>
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Per tank × tanks</Text>
              <Text style={styles.tableValue}>₹{perTank} × {tankCount}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Per job</Text>
              <Text style={styles.tableValue}>₹{perJob.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Fuel</Text>
              <Text style={styles.tableValue}>₹{staffFuel.toLocaleString('en-IN')}</Text>
            </View>
            <View style={[styles.tableRow, styles.tableRowTotal]}>
              <Text style={styles.tableLabelTotal}>Total</Text>
              <Text style={styles.tableValueTotal}>₹{incentive.toLocaleString('en-IN')}</Text>
            </View>
          </>
        ) : (
          <View style={[styles.tableRow, styles.tableRowTotal]}>
            <Text style={styles.tableLabel}>Total</Text>
            <Text style={styles.tableValueTotal}>₹{incentive.toLocaleString('en-IN')}</Text>
          </View>
        )}
      </View>

      {item.notes ? (
        <View style={styles.notesBox}>
          <Text style={styles.notesLabel}>Notes</Text>
          <Text style={styles.notesText} numberOfLines={2}>{item.notes}</Text>
        </View>
      ) : null}
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  earningsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
    fontFamily: FONT_MEDIUM,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
    fontFamily: FONT_MEDIUM,
  },
  tableBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  tableLabel: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: FONT_REGULAR,
    flex: 1,
  },
  tableValue: {
    fontSize: 12,
    color: '#0f172a',
    fontFamily: FONT_MEDIUM,
    marginLeft: 8,
    maxWidth: '60%',
  },
  tableValueBold: {
    fontWeight: '700',
  },
  incentiveBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  incentiveBoxTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    letterSpacing: 0.5,
    marginBottom: 8,
    fontFamily: FONT_MEDIUM,
  },
  tableRowTotal: {
    borderBottomWidth: 0,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#bbf7d0',
  },
  tableLabelTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    fontFamily: FONT_MEDIUM,
  },
  tableValueTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#16a34a',
    fontFamily: FONT_MEDIUM,
  },
  notesBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  notesLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
    fontFamily: FONT_MEDIUM,
  },
  notesText: {
    fontSize: 12,
    color: '#78350f',
    fontStyle: 'italic',
    fontFamily: FONT_REGULAR,
  },
  jobFooter: {
    marginTop: 6,
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
