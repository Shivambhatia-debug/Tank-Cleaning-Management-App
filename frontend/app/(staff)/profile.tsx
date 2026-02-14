import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';

const FONT_REGULAR = Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'System' });
const FONT_MEDIUM = Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: 'System' });

const formatCurrency = (v: any) => {
  const n = Number(v);
  if (!v && v !== 0) return '--';
  if (Number.isNaN(n)) return '--';
  return `Rs.${n.toLocaleString('en-IN')}`;
};

export default function StaffProfileScreen() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = async () => {
    try {
      const [profileRes, statsRes] = await Promise.all([
        api.get('/users/me'),
        api.get(`/stats/staff/${user?.id}`).catch(() => ({ data: null })),
      ]);
      setProfile(profileRes.data);
      setStats(statsRes.data);
    } catch (e) {
      console.error('Profile load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  const p = profile || {};

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar header */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={44} color="#fff" />
          </View>
          <Text style={styles.profileName}>{p.name || user?.name || 'Staff'}</Text>
          <Text style={styles.profilePhone}>{p.phone || ''}</Text>
          {p.staffCode ? <Text style={styles.profileBadge}>ID: {p.staffCode}</Text> : null}
        </View>

        {/* Personal Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Information</Text>
          <InfoRow icon="business-outline" label="Business" value={p.businessName || '--'} />
          <InfoRow icon="location-outline" label="Location" value={p.location || '--'} />
          <InfoRow icon="bicycle-outline" label="Has Bike" value={p.hasBike ? 'Yes' : 'No'} />
          <InfoRow icon="calendar-outline" label="Joining Date" value={p.joiningDate ? new Date(p.joiningDate).toLocaleDateString('en-IN') : '--'} />
          <InfoRow icon="shield-checkmark-outline" label="Status" value={p.employmentStatus || (p.isActive ? 'Active' : 'Inactive')} />
          <InfoRow icon="construct-outline" label="Staff Type" value={p.staffType || '--'} />
        </View>

        {/* Compensation */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Compensation</Text>
          <View style={styles.compGrid}>
            <CompensationItem label="Fixed Salary" value={formatCurrency(p.fixedSalary)} color="#0EA5E9" icon="wallet-outline" />
            <CompensationItem label="Per Tank Incentive" value={formatCurrency(p.perTankIncentive)} color="#8b5cf6" icon="water-outline" />
            <CompensationItem label="Per Job Incentive" value={formatCurrency(p.defaultPerJobIncentive)} color="#f59e0b" icon="trophy-outline" />
            <CompensationItem label="Fuel Allowance" value={formatCurrency(p.fuelAllowance)} color="#22c55e" icon="car-outline" />
          </View>
        </View>

        {/* Earnings / Performance */}
        {stats && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Earnings & Performance</Text>
            <View style={styles.statsGrid}>
              <StatItem label="Total Jobs" value={String(stats.totalJobs ?? 0)} />
              <StatItem label="Completed" value={String(stats.completedJobs ?? 0)} />
              <StatItem label="Completion %" value={`${stats.completionRate ?? 0}%`} />
            </View>
            <View style={styles.divider} />
            <View style={styles.earningsBlock}>
              <View style={styles.earningsRow}>
                <Text style={styles.earningsLabel}>Total Revenue (from jobs)</Text>
                <Text style={styles.earningsValue}>{formatCurrency(stats.totalRevenue)}</Text>
              </View>
              <View style={styles.earningsRow}>
                <Text style={styles.earningsLabel}>This Month Revenue</Text>
                <Text style={styles.earningsValue}>{formatCurrency(stats.monthlyRevenue)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.earningsRow}>
                <Text style={styles.earningsLabel}>Total Incentive Earned</Text>
                <Text style={[styles.earningsValue, { color: '#16a34a' }]}>{formatCurrency(stats.totalIncentive)}</Text>
              </View>
              <View style={styles.earningsRow}>
                <Text style={styles.earningsLabel}>This Month Incentive</Text>
                <Text style={[styles.earningsValue, { color: '#16a34a' }]}>{formatCurrency(stats.monthlyIncentive)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        <Ionicons name={icon as any} size={18} color="#64748b" />
        <Text style={styles.infoRowLabel}>{label}</Text>
      </View>
      <Text style={styles.infoRowValue}>{value}</Text>
    </View>
  );
}

function CompensationItem({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <View style={[styles.compItem, { borderLeftColor: color }]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={styles.compValue}>{value}</Text>
      <Text style={styles.compLabel}>{label}</Text>
    </View>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
    backgroundColor: '#f0f4f8',
  },
  scroll: {
    paddingBottom: 20,
  },
  // Avatar section
  avatarSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: '#0EA5E9',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    fontFamily: FONT_MEDIUM,
  },
  profilePhone: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    fontFamily: FONT_REGULAR,
  },
  profileBadge: {
    fontSize: 12,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
    fontFamily: FONT_MEDIUM,
    overflow: 'hidden',
  },
  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 14,
    fontFamily: FONT_MEDIUM,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoRowLabel: {
    fontSize: 13,
    color: '#64748b',
    fontFamily: FONT_REGULAR,
  },
  infoRowValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
    fontFamily: FONT_MEDIUM,
    maxWidth: '50%',
    textAlign: 'right',
  },
  // Compensation grid
  compGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  compItem: {
    width: '47%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    gap: 4,
  },
  compValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: FONT_MEDIUM,
  },
  compLabel: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: FONT_REGULAR,
  },
  // Stats
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: FONT_MEDIUM,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontFamily: FONT_REGULAR,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
  earningsBlock: {
    gap: 6,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  earningsLabel: {
    fontSize: 13,
    color: '#475569',
    fontFamily: FONT_REGULAR,
  },
  earningsValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: FONT_MEDIUM,
  },
  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONT_MEDIUM,
  },
});
