import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../utils/api';
import BrandText from '../../components/BrandText';
import DropdownPicker from '../../components/DropdownPicker';
import CalendarPicker from '../../components/CalendarPicker';

const CATEGORY_OPTIONS = ['Staff', 'Fuel', 'Chemical', 'Repair', 'Miscellaneous'] as const;
const EXPENSE_PAYMENT_MODES = ['Cash', 'UPI', 'Online', 'Card', 'Bank Transfer'];

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterCategory, setFilterCategory] = useState<'All' | (typeof CATEGORY_OPTIONS)[number]>('All');
  const [dashStats, setDashStats] = useState<any>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newExpense, setNewExpense] = useState({
    date: '',
    amount: '',
    category: 'Staff' as (typeof CATEGORY_OPTIONS)[number],
    purpose: '',
    staffName: '',
    paymentMode: '',
    notes: '',
  });

  useEffect(() => {
    loadExpenses();
    loadDashStats();
  }, []);

  const loadDashStats = async () => {
    try {
      const res = await api.get('/stats/dashboard');
      setDashStats(res.data);
    } catch (e) { /* ignore */ }
  };

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterCategory !== 'All') params.category = filterCategory;
      const res = await api.get('/expenses', { params });
      setExpenses(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Expenses load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadExpenses();
  };

  const handleSaveExpense = async () => {
    const amountNum = Number(newExpense.amount);
    if (!newExpense.date || !newExpense.amount || Number.isNaN(amountNum)) {
      alert('Please fill date and valid amount');
      return;
    }

    setSaving(true);
    try {
      await api.post('/expenses', {
        date: newExpense.date,
        amount: amountNum,
        category: newExpense.category,
        purpose: newExpense.purpose.trim(),
        staffName: newExpense.staffName.trim(),
        paymentMode: newExpense.paymentMode.trim(),
        notes: newExpense.notes.trim(),
      });
      setModalVisible(false);
      setNewExpense({
        date: '',
        amount: '',
        category: 'Staff',
        purpose: '',
        staffName: '',
        paymentMode: '',
        notes: '',
      });
      loadExpenses();
    } catch (e: any) {
      console.error('Create expense error', e.response?.data || e.message);
      alert(e.response?.data?.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const renderExpense = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.amount}>₹{(item.amount || 0).toLocaleString('en-IN')}</Text>
        <View style={[styles.categoryTag, styles[`cat_${item.category}` as keyof typeof styles] || null]}>
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>
      </View>
      <Text style={styles.dateText}>
        {item.date ? new Date(item.date).toLocaleDateString() : ''}
      </Text>
      {item.purpose ? (
        <Text style={styles.purposeText} numberOfLines={2}>
          {item.purpose}
        </Text>
      ) : null}
      <View style={styles.metaRow}>
        {item.staffName ? (
          <Text style={styles.metaText}>👷 {item.staffName}</Text>
        ) : null}
        {item.paymentMode ? (
          <Text style={styles.metaText}>💳 {item.paymentMode}</Text>
        ) : null}
      </View>
      {item.notes ? (
        <Text style={styles.notesText} numberOfLines={2}>
          {item.notes}
        </Text>
      ) : null}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Expenses</Text>
        <View style={styles.headerBrand}>
          <BrandText faded />
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {dashStats && (
        <View style={styles.profitSummary}>
          <View style={styles.profitRow}>
            <View style={[styles.profitBox, { borderLeftColor: '#16a34a' }]}>
              <Text style={styles.profitLabel}>Revenue</Text>
              <Text style={[styles.profitValue, { color: '#16a34a' }]}>₹{(dashStats.totalRevenue || 0).toLocaleString('en-IN')}</Text>
            </View>
            <View style={[styles.profitBox, { borderLeftColor: '#dc2626' }]}>
              <Text style={styles.profitLabel}>Expenses</Text>
              <Text style={[styles.profitValue, { color: '#dc2626' }]}>₹{(dashStats.totalExpenses || 0).toLocaleString('en-IN')}</Text>
            </View>
            <View style={[styles.profitBox, { borderLeftColor: '#0EA5E9' }]}>
              <Text style={styles.profitLabel}>Profit</Text>
              <Text style={[styles.profitValue, { color: (dashStats.totalProfit ?? 0) >= 0 ? '#0EA5E9' : '#dc2626' }]}>₹{(dashStats.totalProfit ?? 0).toLocaleString('en-IN')}</Text>
            </View>
          </View>
          <View style={styles.profitRow}>
            <View style={[styles.profitBox, { borderLeftColor: '#8b5cf6' }]}>
              <Text style={styles.profitLabel}>Monthly Revenue</Text>
              <Text style={[styles.profitValue, { color: '#8b5cf6' }]}>₹{(dashStats.monthlyRevenue || 0).toLocaleString('en-IN')}</Text>
            </View>
            <View style={[styles.profitBox, { borderLeftColor: '#f59e0b' }]}>
              <Text style={styles.profitLabel}>Monthly Expense</Text>
              <Text style={[styles.profitValue, { color: '#f59e0b' }]}>₹{(dashStats.monthlyExpense || 0).toLocaleString('en-IN')}</Text>
            </View>
          </View>
          {(dashStats.totalStaffIncentive > 0 || dashStats.monthlyStaffIncentive > 0) && (
            <Text style={styles.profitNote}>
              Expenses include staff incentive (total ₹{(dashStats.totalStaffIncentive || 0).toLocaleString('en-IN')}, this month ₹{(dashStats.monthlyStaffIncentive || 0).toLocaleString('en-IN')}). Profit = Revenue − Expenses.
            </Text>
          )}
        </View>
      )}

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['All', ...CATEGORY_OPTIONS] as const).map((cat) => {
            const active = filterCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => {
                  setFilterCategory(cat as any);
                  setRefreshing(true);
                  loadExpenses();
                }}
              >
                <Text
                  style={[styles.filterChipText, active && styles.filterChipTextActive]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item._id || item.id}
        renderItem={renderExpense}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No expenses recorded yet.</Text>
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add expense</Text>
            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
              <CalendarPicker
                label="Date *"
                placeholder="Select date"
                value={newExpense.date}
                onChange={(d) => setNewExpense({ ...newExpense, date: d })}
              />

              <Text style={styles.label}>Amount (₹) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 500"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={newExpense.amount}
                onChangeText={(t) => setNewExpense({ ...newExpense, amount: t })}
              />

              <Text style={styles.label}>Category *</Text>
              <View style={styles.chipRow}>
                {CATEGORY_OPTIONS.map((cat) => {
                  const active = newExpense.category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setNewExpense({ ...newExpense, category: cat })}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Purpose</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Short reason (e.g. Staff salary, Diesel refill)"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={2}
                value={newExpense.purpose}
                onChangeText={(t) => setNewExpense({ ...newExpense, purpose: t })}
              />

              <Text style={styles.label}>Staff Name (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Ravi / Ramesh"
                placeholderTextColor="#9CA3AF"
                value={newExpense.staffName}
                onChangeText={(t) => setNewExpense({ ...newExpense, staffName: t })}
              />

              <DropdownPicker
                label="Payment Mode"
                placeholder="Select payment mode"
                value={newExpense.paymentMode}
                options={EXPENSE_PAYMENT_MODES}
                onSelect={(v) => setNewExpense({ ...newExpense, paymentMode: v })}
              />

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Any extra detail (bill no, etc.)"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={2}
                value={newExpense.notes}
                onChangeText={(t) => setNewExpense({ ...newExpense, notes: t })}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.submitButton]}
                  onPress={handleSaveExpense}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  profitSummary: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  profitRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  profitBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  profitLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  profitValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  profitNote: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 8,
    paddingHorizontal: 4,
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  headerBrand: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  filterBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  list: {
    padding: 14,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  categoryTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  dateText: {
    fontSize: 12,
    color: '#6b7280',
  },
  purposeText: {
    fontSize: 13,
    color: '#111827',
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#6b7280',
  },
  notesText: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#111827',
    marginBottom: 10,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f9fafb',
  },
  chipActive: {
    borderColor: '#0ea5e9',
    backgroundColor: '#e0f2fe',
  },
  chipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#0369a1',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#0EA5E9',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Category-specific background helpers (light tints)
  cat_Staff: {
    backgroundColor: '#dbeafe',
  },
  cat_Fuel: {
    backgroundColor: '#fee2e2',
  },
  cat_Chemical: {
    backgroundColor: '#e0f2fe',
  },
  cat_Repair: {
    backgroundColor: '#fef3c7',
  },
  cat_Miscellaneous: {
    backgroundColor: '#e5e7eb',
  },
});

