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
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';

const { width } = Dimensions.get('window');
const isSmallDevice = width < 375;
const cardWidth = (width - 48) / 2;

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await api.get('/stats/dashboard');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
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
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.greeting} numberOfLines={1}>Hello, {user?.name}</Text>
          <Text style={styles.role}>Admin Dashboard</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutIcon}>🚪</Text>
        </TouchableOpacity>
      </View>

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
                <Text style={styles.statValue}>{stats?.total_jobs || 0}</Text>
                <Text style={styles.statLabel}>Total Jobs</Text>
              </View>
            </View>

            <View style={[styles.statCard, styles.warningCard]}>
              <View style={styles.statIcon}>
                <Text style={styles.iconText}>⏳</Text>
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{stats?.pending_jobs || 0}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>

            <View style={[styles.statCard, styles.successCard]}>
              <View style={styles.statIcon}>
                <Text style={styles.iconText}>🔄</Text>
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{stats?.in_progress_jobs || 0}</Text>
                <Text style={styles.statLabel}>In Progress</Text>
              </View>
            </View>

            <View style={[styles.statCard, styles.infoCard]}>
              <View style={styles.statIcon}>
                <Text style={styles.iconText}>👷</Text>
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{stats?.total_staff || 0}</Text>
                <Text style={styles.statLabel}>Active Staff</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity style={styles.actionCard}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
                <Text style={styles.actionIconText}>➕</Text>
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Create Job</Text>
                <Text style={styles.actionSubtitle}>Add new tank cleaning task</Text>
              </View>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
                <Text style={styles.actionIconText}>👤</Text>
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Add Staff</Text>
                <Text style={styles.actionSubtitle}>Onboard new team member</Text>
              </View>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#FFEBEE' }]}>
                <Text style={styles.actionIconText}>🗺️</Text>
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Live Tracking</Text>
                <Text style={styles.actionSubtitle}>Monitor active jobs</Text>
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
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  greeting: {
    fontSize: isSmallDevice ? 20 : 24,
    fontWeight: 'bold',
    color: '#333',
  },
  role: {
    fontSize: isSmallDevice ? 12 : 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutIcon: {
    fontSize: 20,
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
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryCard: {
    backgroundColor: '#007AFF',
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
    width: isSmallDevice ? 40 : 48,
    height: isSmallDevice ? 40 : 48,
    borderRadius: isSmallDevice ? 20 : 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: isSmallDevice ? 20 : 24,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: isSmallDevice ? 24 : 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: isSmallDevice ? 11 : 12,
    color: '#fff',
    marginTop: 2,
    opacity: 0.9,
  },
  section: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionIconText: {
    fontSize: 24,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
  },
  actionArrow: {
    fontSize: 24,
    color: '#C7C7CC',
    fontWeight: '300',
  },
});
