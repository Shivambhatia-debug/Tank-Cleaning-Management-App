import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../utils/api';
import AppHeader from '../../components/AppHeader';
import { useAuth } from '../../contexts/AuthContext';

export default function ReportsScreen() {
  const { user, logout } = useAuth();
  const [reports, setReports] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReports = async () => {
    try {
      const res = await api.get('/reports/summary');
      setReports(res.data);
    } catch (e) {
      console.error('Reports load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title={user?.name || 'Admin'} subtitle="Reports" onLogout={logout} />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadReports(); }} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Revenue cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revenue overview</Text>
          <View style={styles.row}>
            <View style={[styles.card, styles.cardGreen]}>
              <Text style={styles.cardLabel}>Today revenue</Text>
              <Text style={styles.cardValue}>
                ₹{reports?.dailyRevenue?.toLocaleString?.('en-IN') ?? '0'}
              </Text>
            </View>
            <View style={[styles.card, styles.cardBlue]}>
              <Text style={styles.cardLabel}>This month</Text>
              <Text style={styles.cardValue}>
                ₹{reports?.monthlyRevenue?.toLocaleString?.('en-IN') ?? '0'}
              </Text>
            </View>
          </View>
        </View>

        {/* Today summary: Jobs / Revenue / Expense / Net */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Date:{' '}
              <Text style={styles.summaryValue}>
                {reports?.summary?.date
                  ? new Date(reports.summary.date).toLocaleDateString()
                  : '--'}
              </Text>
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Total jobs:{' '}
              <Text style={styles.summaryValue}>{reports?.summary?.totalJobs ?? 0}</Text>
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Total revenue:{' '}
              <Text style={styles.summaryValue}>
                ₹{reports?.summary?.totalRevenue?.toLocaleString?.('en-IN') ?? '0'}
              </Text>
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Total expense:{' '}
              <Text style={styles.summaryValue}>
                ₹{reports?.summary?.totalExpense?.toLocaleString?.('en-IN') ?? '0'}
              </Text>
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Net profit:{' '}
              <Text
                style={[
                  styles.summaryValue,
                  (reports?.summary?.netProfit ?? 0) < 0 && { color: '#b91c1c' },
                ]}
              >
                ₹{reports?.summary?.netProfit?.toLocaleString?.('en-IN') ?? '0'}
              </Text>
            </Text>
          </View>
        </View>

        {/* Staff wise revenue */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Staff wise revenue</Text>
          {reports?.staffWise?.length ? (
            reports.staffWise.map((s: any) => (
              <View key={s._id} style={styles.listRow}>
                <Text style={styles.listLeft}>Staff: {String(s._id).slice(-4)}</Text>
                <Text style={styles.listRight}>₹{s.revenue || 0} · {s.jobs} jobs</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No staff revenue data yet.</Text>
          )}
        </View>

        {/* Pending payments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending payments</Text>
          {reports?.pendingPayments?.length ? (
            reports.pendingPayments.map((p: any) => (
              <View key={p._id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listLeft}>{p.customerName}</Text>
                  <Text style={styles.subLine}>📱 {p.mobileNumber || 'N/A'}</Text>
                </View>
                <Text style={styles.listRight}>₹{p.serviceCharge || 0}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No pending payments 🎉</Text>
          )}
        </View>

        {/* Repeat customers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Repeat customers</Text>
          {reports?.repeatCustomers?.length ? (
            reports.repeatCustomers.map((c: any) => (
              <View key={c._id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listLeft}>{c.customerName || 'Unnamed customer'}</Text>
                  <Text style={styles.subLine}>📱 {c._id}</Text>
                  <Text style={styles.subLine}>
                    Jobs: {c.totalJobs} · Revenue: ₹{c.totalRevenue || 0}
                  </Text>
                </View>
                {c.lastServiceAt && (
                  <Text style={styles.badge}>
                    Last: {new Date(c.lastServiceAt).toLocaleDateString()}
                  </Text>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No repeat customers yet.</Text>
          )}
        </View>

        {/* Repeat cleaning reminders (6 month due) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Repeat cleaning reminders</Text>
          {reports?.reminders?.repeatCleanings?.length ? (
            reports.reminders.repeatCleanings.map((j: any) => {
              const lastService =
                j.timeline?.completedAt ? new Date(j.timeline.completedAt) : null;
              const nextDue = j.nextServiceAt ? new Date(j.nextServiceAt) : null;
              let statusLabel = 'Upcoming';
              if (nextDue) {
                const today = new Date();
                const dOnly = new Date(
                  today.getFullYear(),
                  today.getMonth(),
                  today.getDate()
                );
                const nOnly = new Date(
                  nextDue.getFullYear(),
                  nextDue.getMonth(),
                  nextDue.getDate()
                );
                if (nOnly.getTime() === dOnly.getTime()) statusLabel = 'Due today';
                else if (nOnly.getTime() < dOnly.getTime()) statusLabel = 'Overdue';
              }
              return (
                <View key={j._id} style={styles.listRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listLeft}>{j.customerName || 'Customer'}</Text>
                    <Text style={styles.subLine}>📱 {j.mobileNumber || 'N/A'}</Text>
                    {j.address ? (
                      <Text style={styles.subLine}>📍 {j.address}</Text>
                    ) : null}
                    <Text style={styles.subLine}>
                      Last: {lastService ? lastService.toLocaleDateString() : 'N/A'} · Next:{' '}
                      {nextDue ? nextDue.toLocaleDateString() : 'N/A'}
                    </Text>
                    {j.notes ? (
                      <Text style={styles.subLine} numberOfLines={2}>
                        📝 {j.notes}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.badge}>{statusLabel}</Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No repeat cleaning reminders in next 15 days.</Text>
          )}
        </View>

        <View style={{ height: 24 }} />
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
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
  },
  cardGreen: {
    backgroundColor: '#047857',
  },
  cardBlue: {
    backgroundColor: '#1d4ed8',
  },
  cardLabel: {
    fontSize: 13,
    color: '#E5E7EB',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  listLeft: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  listRight: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  subLine: {
    fontSize: 12,
    color: '#6b7280',
  },
  badge: {
    fontSize: 11,
    color: '#4b5563',
  },
  emptyText: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#4b5563',
  },
  summaryValue: {
    fontWeight: '600',
    color: '#111827',
  },
});

