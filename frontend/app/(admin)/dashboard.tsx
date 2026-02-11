import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import AppHeader from '../../components/AppHeader';

const { width } = Dimensions.get('window');
const isSmallDevice = width < 375;
const cardWidth = (width - 48) / 2;

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [reports, setReports] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      loadStats();
    }, [])
  );

  const loadStats = async () => {
    setNetworkError(null);
    try {
      const [statsRes, reportsRes] = await Promise.all([
        api.get('/stats/dashboard'),
        api.get('/reports/summary'),
      ]);
      setStats(statsRes.data);
      setReports(reportsRes.data);
    } catch (error: any) {
      console.error('Error loading stats:', error);
      const isNetwork = error?.message === 'Network Error' || error?.code === 'ERR_NETWORK';
      if (isNetwork) {
        setNetworkError(
          'Backend unreachable. 1) Start backend: cd backend_node && node server.js  2) On Android use: npx expo run:android (not Expo Go)'
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  if (loading && !networkError) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (networkError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader title={user?.name} subtitle="Dashboard" onLogout={logout} />
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>⚠️ Cannot connect to server</Text>
          <Text style={styles.errorText}>{networkError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); loadStats(); }}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title={user?.name} subtitle="Dashboard" onLogout={logout} />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.statsContainer}>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.primaryCard]}>
              <View style={styles.statIcon}>
                <Text style={styles.iconText}>💼</Text>
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{stats?.totalJobs || 0}</Text>
                <Text style={styles.statLabel}>Total Jobs</Text>
              </View>
            </View>

            <View style={[styles.statCard, styles.warningCard]}>
              <View style={styles.statIcon}>
                <Text style={styles.iconText}>⏳</Text>
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{stats?.pendingJobs || 0}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>

            <View style={[styles.statCard, styles.successCard]}>
              <View style={styles.statIcon}>
                <Text style={styles.iconText}>🔄</Text>
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{stats?.inProgressJobs || 0}</Text>
                <Text style={styles.statLabel}>In Progress</Text>
              </View>
            </View>

            <View style={[styles.statCard, styles.infoCard]}>
              <View style={styles.statIcon}>
                <Text style={styles.iconText}>👷</Text>
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{stats?.activeStaff || 0}</Text>
                <Text style={styles.statLabel}>Active Staff</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Revenue & Payments summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revenue & payments</Text>
          <View style={styles.rowCards}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Today revenue</Text>
              <Text style={styles.kpiValue}>
                ₹{reports?.dailyRevenue?.toLocaleString?.('en-IN') ?? '0'}
              </Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>This month</Text>
              <Text style={styles.kpiValue}>
                ₹{reports?.monthlyRevenue?.toLocaleString?.('en-IN') ?? '0'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push('/(admin)/jobs')}
          >
            <Text style={styles.linkText}>
              Pending payments: {reports?.pendingPayments?.length ?? 0}
            </Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Reminders: Follow‑ups + repeat cleaning + upcoming jobs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today reminders</Text>

          <View style={styles.reminderCard}>
            <Text style={styles.reminderTitle}>Follow‑ups (Leads)</Text>
            {reports?.reminders?.followUps?.length ? (
              reports.reminders.followUps.slice(0, 3).map((l: any) => (
                <View key={l._id} style={styles.reminderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reminderLine}>
                      {l.customerName} – {l.mobileNumber}
                    </Text>
                    <Text style={styles.reminderSub}>
                      {new Date(l.nextFollowUpAt).toLocaleString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.waButton}
                    onPress={() => {
                      const msg = encodeURIComponent(
                        `Namaste ${l.customerName},\n\nCleaning Hero se aapke tank cleaning ke follow-up ke liye call kar rahe hain.\n\n– Cleaning Hero`
                      );
                      const url = `https://wa.me/91${l.mobileNumber}?text=${msg}`;
                      // We rely on Linking from React Native; Expo will open WhatsApp
                      // (no import here – kept simple deeplink)
                      // @ts-ignore
                      import('react-native').then(({ Linking }) => Linking.openURL(url));
                    }}
                  >
                    <Text style={styles.waButtonText}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text style={styles.reminderEmpty}>No follow‑ups scheduled</Text>
            )}
          </View>

          <View style={styles.reminderCard}>
            <Text style={styles.reminderTitle}>Repeat cleaning (next 15 days)</Text>
            {reports?.reminders?.repeatCleanings?.length ? (
              reports.reminders.repeatCleanings.slice(0, 3).map((j: any) => (
                <View key={j._id} style={styles.reminderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reminderLine}>
                      {j.customerName} – {j.mobileNumber}
                    </Text>
                    <Text style={styles.reminderSub}>
                      Next: {new Date(j.nextServiceAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.waButton}
                    onPress={() => {
                      const msg = encodeURIComponent(
                        `Namaste ${j.customerName},\n\nAapki paichli tank cleaning ke 6 mahine complete ho gaye hain. Next cleaning due hai.\n\nAap kab slot book karwana chahenge?\n\n– Cleaning Hero`
                      );
                      const url = `https://wa.me/91${j.mobileNumber}?text=${msg}`;
                      // @ts-ignore
                      import('react-native').then(({ Linking }) => Linking.openURL(url));
                    }}
                  >
                    <Text style={styles.waButtonText}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              <Text style={styles.reminderEmpty}>No repeat cleaning due</Text>
            )}
          </View>

          <View style={styles.reminderCard}>
            <Text style={styles.reminderTitle}>Upcoming jobs (next 6 hours)</Text>
            {reports?.reminders?.upcomingJobs?.length ? (
              reports.reminders.upcomingJobs.slice(0, 3).map((j: any) => (
                <View key={j._id} style={styles.reminderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reminderLine}>
                      {j.customerName} – {j.mobileNumber}
                    </Text>
                    <Text style={styles.reminderSub}>
                      {new Date(j.scheduledAt).toLocaleTimeString()}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.reminderEmpty}>No upcoming jobs</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick actions</Text>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(admin)/leads')}
          >
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
                <Text style={styles.actionIconText}>➕</Text>
              </View>
              <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Add lead</Text>
              <Text style={styles.actionSubtitle}>New enquiry</Text>
              </View>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(admin)/staff')}
          >
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#dcfce7' }]}>
                <Text style={styles.actionIconText}>👤</Text>
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Staff</Text>
                <Text style={styles.actionSubtitle}>Manage team</Text>
              </View>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(admin)/map')}
          >
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#fef2f2' }]}>
                <Text style={styles.actionIconText}>🗺️</Text>
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Live map</Text>
                <Text style={styles.actionSubtitle}>Track jobs</Text>
              </View>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBox: {
    flex: 1,
    margin: 20,
    padding: 20,
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: cardWidth,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  primaryCard: {
    backgroundColor: '#0EA5E9',
  },
  warningCard: {
    backgroundColor: '#FF9500',
  },
  successCard: {
    backgroundColor: '#34C759',
  },
  infoCard: {
    backgroundColor: '#5856D6',
  },
  statIcon: {
    width: isSmallDevice ? 36 : 40,
    height: isSmallDevice ? 36 : 40,
    borderRadius: isSmallDevice ? 18 : 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  iconText: {
    fontSize: isSmallDevice ? 18 : 20,
  },
  statContent: {
    flex: 1,
    minWidth: 0,
  },
  statValue: {
    fontSize: isSmallDevice ? 20 : 22,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: '#fff',
    marginTop: 1,
    opacity: 0.9,
  },
  section: {
    padding: 14,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  rowCards: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  reminderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  reminderTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  reminderLine: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 8,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  reminderSub: {
    fontSize: 11,
    color: '#6b7280',
  },
  reminderEmpty: {
    fontSize: 12,
    color: '#9ca3af',
  },
  waButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#22c55e',
  },
  waButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f9fafb',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionIconText: {
    fontSize: 20,
  },
  actionContent: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 1,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  actionArrow: {
    fontSize: 20,
    color: '#cbd5e1',
    fontWeight: '400',
  },
});
