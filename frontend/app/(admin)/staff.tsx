import React, { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api, { resolvePhotoUrl } from '../../utils/api';
import BrandText from '../../components/BrandText';
import CalendarPicker from '../../components/CalendarPicker';

const STAFF_TYPE_OPTIONS = ['Full Time', 'Part Time'] as const;
const STAFF_STATUS_OPTIONS = ['Active', 'Inactive', 'Terminated'] as const;
const FONT_REGULAR = Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'System' });
const FONT_MEDIUM = Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: 'System' });

const formatCurrencyOrDash = (value: any) => {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return `₹${num.toLocaleString('en-IN')}`;
};

export default function StaffManagementScreen() {
  const { openStaffId } = useLocalSearchParams<{ openStaffId?: string }>();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [newStaff, setNewStaff] = useState({
    name: '',
    phone: '',
    password: '',
    businessName: '',
    location: '',
    staffCode: '',
    staffType: 'Full Time' as (typeof STAFF_TYPE_OPTIONS)[number],
    fixedSalary: '',
    perTankIncentive: '',
    defaultPerJobIncentive: '',
    defaultFuelExpense: '',
    hasBike: false,
    joiningDate: '',
    employmentStatus: 'Active' as (typeof STAFF_STATUS_OPTIONS)[number],
    remarks: '',
  });
  const [addingStaff, setAddingStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string | number>>({});
  const [staffStats, setStaffStats] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [staffJobs, setStaffJobs] = useState<any[]>([]);

  useEffect(() => {
    loadStaff();
  }, []);

  useEffect(() => {
    if (openStaffId && staff.length > 0) {
      const s = staff.find((x: any) => x._id === openStaffId);
      if (s) {
        setSelectedStaff(s);
        setDetailModalVisible(true);
        loadStaffStats(s._id);
      }
    }
  }, [openStaffId, staff]);

  const loadStaff = async () => {
    try {
      const response = await api.get('/users?role=staff');
      setStaff(response.data);
    } catch (error) {
      console.error('Error loading staff:', error);
      Alert.alert('Error', 'Failed to load staff members');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAddStaff = async () => {
    if (!newStaff.name || !newStaff.phone || !newStaff.password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    const phoneDigits = newStaff.phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      Alert.alert('Error', 'Enter exactly 10 digit phone number');
      return;
    }

    setAddingStaff(true);
    try {
      await api.post('/users/staff', {
        name: newStaff.name,
        phone: phoneDigits,
        password: newStaff.password,
        role: 'staff',
        businessName: newStaff.businessName.trim(),
        location: newStaff.location.trim(),
        staffCode: newStaff.staffCode.trim() || undefined,
        staffType: newStaff.staffType,
        fixedSalary: newStaff.fixedSalary ? Number(newStaff.fixedSalary) || 0 : undefined,
        perTankIncentive: newStaff.perTankIncentive ? Number(newStaff.perTankIncentive) || 0 : undefined,
        defaultPerJobIncentive: newStaff.defaultPerJobIncentive ? Number(newStaff.defaultPerJobIncentive) || 0 : undefined,
        defaultFuelExpense: newStaff.defaultFuelExpense ? Number(newStaff.defaultFuelExpense) || 0 : undefined,
        hasBike: newStaff.hasBike,
        joiningDate: newStaff.joiningDate || undefined,
        employmentStatus: newStaff.employmentStatus,
        remarks: newStaff.remarks.trim() || undefined,
      });
      Alert.alert(
        'Staff added',
        `Share this password with them: ${newStaff.password}\n\n(Note it down; it won't be shown again.)`
      );
      setModalVisible(false);
      setNewStaff({
        name: '',
        phone: '',
        password: '',
        businessName: '',
        location: '',
        staffCode: '',
        staffType: 'Full Time',
        fixedSalary: '',
        perTankIncentive: '',
        defaultPerJobIncentive: '',
        defaultFuelExpense: '',
        hasBike: false,
        joiningDate: '',
        employmentStatus: 'Active',
        remarks: '',
      });
      loadStaff();
    } catch (error: any) {
      const msg = error.response?.data?.message || error.response?.data?.detail || error.message || 'Failed to add staff';
      Alert.alert('Error', msg);
    } finally {
      setAddingStaff(false);
    }
  };

  const toggleStaffStatus = async (staffId: string, currentStatus: boolean) => {
    try {
      await api.put(`/users/${staffId}`, {
        isActive: !currentStatus,
      });
      loadStaff();
    } catch (error) {
      Alert.alert('Error', 'Failed to update staff status');
    }
  };

  const handleDeleteStaff = (staffId: string, name: string) => {
    Alert.alert(
      'Delete staff',
      `Remove "${name}" from staff? They will not be able to login.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/users/${staffId}`);
              setDetailModalVisible(false);
              setSelectedStaff(null);
              loadStaff();
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to delete staff');
            }
          },
        },
      ]
    );
  };

  const loadStaffStats = async (staffId: string) => {
    try {
      setLoadingStats(true);
      const [statsRes, jobsRes] = await Promise.all([
        api.get(`/stats/staff/${staffId}`),
        api.get(`/jobs?staffId=${staffId}`).catch(() => ({ data: [] })),
      ]);
      setStaffStats(statsRes.data);
      setStaffJobs(Array.isArray(jobsRes.data) ? jobsRes.data : []);
    } catch (e) {
      console.error('Staff stats error', e);
    } finally {
      setLoadingStats(false);
    }
  };

  const renderStaffCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.staffCard}
      onPress={() => { setSelectedStaff(item); setDetailModalVisible(true); loadStaffStats(item._id); }}
      activeOpacity={0.85}
    >
      <View style={styles.staffInfo}>
        <Text style={styles.staffName}>{item.name}</Text>
        <Text style={styles.staffPhone}>📱 {item.phone}</Text>
        {item.businessName ? <Text style={styles.staffDetail}>🏢 {item.businessName}</Text> : null}
        {item.location ? <Text style={styles.staffDetail}>📍 {item.location}</Text> : null}
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.tapHint}>Tap for details</Text>
        <TouchableOpacity
          style={[styles.statusButton, { backgroundColor: item.isActive ? '#34C759' : '#FF3B30' }]}
          onPress={(e) => { e.stopPropagation(); toggleStaffStatus(item._id, item.isActive); }}
        >
          <Text style={styles.statusText}>{item.isActive ? 'Active' : 'Inactive'}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

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
        <Text style={styles.title}>Staff</Text>
        <View style={styles.headerBrand}>
          <BrandText faded />
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={staff}
        renderItem={renderStaffCard}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadStaff} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No staff members found</Text>
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.fullScreenModal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalBackBtn}>
              <Ionicons name="arrow-back" size={24} color="#0f172a" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Add New Staff</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              <TextInput
                style={styles.input}
                placeholder="Staff Name"
                placeholderTextColor="#9CA3AF"
                value={newStaff.name}
                onChangeText={(text) => setNewStaff({ ...newStaff, name: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Phone (10 digits only)"
                placeholderTextColor="#9CA3AF"
                value={newStaff.phone}
                onChangeText={(t) => setNewStaff({ ...newStaff, phone: t.replace(/\D/g, '').slice(0, 10) })}
                keyboardType="phone-pad"
                maxLength={10}
              />

              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#9CA3AF"
                value={newStaff.password}
                onChangeText={(text) => setNewStaff({ ...newStaff, password: text })}
                secureTextEntry
              />

              <TextInput
                style={styles.input}
                placeholder="Staff ID (optional)"
                placeholderTextColor="#9CA3AF"
                value={newStaff.staffCode}
                onChangeText={(text) => setNewStaff({ ...newStaff, staffCode: text })}
              />

              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>Staff Type</Text>
                  <View style={styles.chipRow}>
                    {STAFF_TYPE_OPTIONS.map((type) => {
                      const active = newStaff.staffType === type;
                      return (
                        <TouchableOpacity
                          key={type}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setNewStaff({ ...newStaff, staffType: type })}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {type}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>Fixed Salary (₹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 12000"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={newStaff.fixedSalary}
                    onChangeText={(t) => setNewStaff({ ...newStaff, fixedSalary: t })}
                  />
                </View>
                <View style={{ width: 10 }} />
                <View style={styles.col}>
                  <Text style={styles.label}>Per Tank Incentive (₹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 20"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={newStaff.perTankIncentive}
                    onChangeText={(t) => setNewStaff({ ...newStaff, perTankIncentive: t })}
                  />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>Default per job incentive (₹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 20 (suggested when creating jobs)"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={newStaff.defaultPerJobIncentive}
                    onChangeText={(t) => setNewStaff({ ...newStaff, defaultPerJobIncentive: t })}
                  />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>Default fuel expense per job (₹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 50"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={newStaff.defaultFuelExpense}
                    onChangeText={(t) => setNewStaff({ ...newStaff, defaultFuelExpense: t })}
                  />
                </View>
                <View style={{ width: 10 }} />
                <View style={styles.col}>
                  <Text style={styles.label}>Bike</Text>
                  <View style={styles.chipRow}>
                    {['Yes', 'No'].map((opt) => {
                      const yes = opt === 'Yes';
                      const active = newStaff.hasBike === yes;
                      return (
                        <TouchableOpacity
                          key={opt}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setNewStaff({ ...newStaff, hasBike: yes })}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {opt}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              <CalendarPicker
                label="Joining Date (optional)"
                placeholder="Select date"
                value={newStaff.joiningDate}
                onChange={(d) => setNewStaff({ ...newStaff, joiningDate: d })}
              />

              <Text style={styles.label}>Status</Text>
              <View style={styles.chipRow}>
                {STAFF_STATUS_OPTIONS.map((st) => {
                  const active = newStaff.employmentStatus === st;
                  return (
                    <TouchableOpacity
                      key={st}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setNewStaff({ ...newStaff, employmentStatus: st })}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {st}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Business name"
                placeholderTextColor="#9CA3AF"
                value={newStaff.businessName}
                onChangeText={(t) => setNewStaff({ ...newStaff, businessName: t })}
              />

              <TextInput
                style={[styles.input, styles.inputArea]}
                placeholder="Location / Address (kahan rehte hain)"
                placeholderTextColor="#9CA3AF"
                value={newStaff.location}
                onChangeText={(t) => setNewStaff({ ...newStaff, location: t })}
                multiline
                numberOfLines={2}
              />

              <TextInput
                style={[styles.input, styles.inputArea]}
                placeholder="Remarks (optional)"
                placeholderTextColor="#9CA3AF"
                value={newStaff.remarks}
                onChangeText={(t) => setNewStaff({ ...newStaff, remarks: t })}
                multiline
                numberOfLines={2}
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
                  onPress={handleAddStaff}
                  disabled={addingStaff}
                >
                  {addingStaff ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Add Staff</Text>
                  )}
                </TouchableOpacity>
              </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={detailModalVisible}
        animationType="slide"
        onRequestClose={() => { setDetailModalVisible(false); setEditingStaff(false); }}
      >
        <SafeAreaView style={styles.fullScreenModal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setDetailModalVisible(false); setEditingStaff(false); }} style={styles.modalBackBtn}>
              <Ionicons name="arrow-back" size={24} color="#0f172a" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Staff Details</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              {selectedStaff && (
                <>
                <View style={[styles.staffDetailBadge, { backgroundColor: selectedStaff.isActive ? '#dcfce7' : '#fee2e2', borderColor: selectedStaff.isActive ? '#86efac' : '#fca5a5' }]}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: selectedStaff.isActive ? '#166534' : '#991b1b' }}>
                    {selectedStaff.isActive ? '● Active' : '● Inactive'}
                  </Text>
                </View>

                <View style={styles.staffDetailCard}>
                  <Text style={styles.staffDetailCardTitle}>PERSONAL INFORMATION</Text>
                  <View style={styles.staffDetailInfoRow}><Text style={styles.staffDetailInfoLabel}>Name</Text><Text style={styles.staffDetailInfoValue}>{selectedStaff.name}</Text></View>
                  <View style={styles.staffDetailInfoRow}><Text style={styles.staffDetailInfoLabel}>Phone</Text><Text style={styles.staffDetailInfoValue}>{selectedStaff.phone}</Text></View>
                  <View style={styles.staffDetailInfoRow}><Text style={styles.staffDetailInfoLabel}>Password</Text><Text style={styles.staffDetailInfoValue}>{selectedStaff.plainPasswordForAdmin || '—'}</Text></View>
                  <View style={styles.staffDetailInfoRow}><Text style={styles.staffDetailInfoLabel}>Business</Text><Text style={styles.staffDetailInfoValue}>{selectedStaff.businessName || '—'}</Text></View>
                  <View style={styles.staffDetailInfoRow}><Text style={styles.staffDetailInfoLabel}>Location</Text><Text style={[styles.staffDetailInfoValue, { flex: 1, textAlign: 'right' }]}>{selectedStaff.location || '—'}</Text></View>
                </View>
                <View style={styles.staffDetailCard}>
                  <Text style={styles.staffDetailCardTitle}>COMPENSATION</Text>
                  <View style={styles.staffDetailInfoRow}><Text style={styles.staffDetailInfoLabel}>Fixed Salary</Text><Text style={styles.staffDetailInfoValue}>{formatCurrencyOrDash(selectedStaff.fixedSalary)}</Text></View>
                  <View style={styles.staffDetailInfoRow}><Text style={styles.staffDetailInfoLabel}>Per Tank Incentive</Text><Text style={styles.staffDetailInfoValue}>{formatCurrencyOrDash(selectedStaff.perTankIncentive)}</Text></View>
                  <View style={styles.staffDetailInfoRow}><Text style={styles.staffDetailInfoLabel}>Default Per Job Incentive</Text><Text style={styles.staffDetailInfoValue}>{formatCurrencyOrDash(selectedStaff.defaultPerJobIncentive)}</Text></View>
                  <View style={styles.staffDetailInfoRow}><Text style={styles.staffDetailInfoLabel}>Default Fuel Expense (per job)</Text><Text style={styles.staffDetailInfoValue}>{formatCurrencyOrDash(selectedStaff.defaultFuelExpense)}</Text></View>
                </View>
                {editingStaff ? (
                  <View style={styles.staffDetailCard}>
                    <Text style={styles.staffDetailCardTitle}>EDIT STAFF</Text>
                    <Text style={styles.label}>Per Tank Incentive (₹)</Text>
                    <TextInput style={styles.input} placeholder="e.g. 100" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={String(editForm.perTankIncentive ?? selectedStaff.perTankIncentive ?? '')} onChangeText={(t) => setEditForm({ ...editForm, perTankIncentive: t })} />
                    <Text style={[styles.label, { marginTop: 8 }]}>Default Per Job Incentive (₹)</Text>
                    <TextInput style={styles.input} placeholder="e.g. 50" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={String(editForm.defaultPerJobIncentive ?? selectedStaff.defaultPerJobIncentive ?? '')} onChangeText={(t) => setEditForm({ ...editForm, defaultPerJobIncentive: t })} />
                    <Text style={[styles.label, { marginTop: 8 }]}>Default Fuel Expense (₹)</Text>
                    <TextInput style={styles.input} placeholder="e.g. 50" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={String(editForm.defaultFuelExpense ?? selectedStaff.defaultFuelExpense ?? '')} onChangeText={(t) => setEditForm({ ...editForm, defaultFuelExpense: t })} />
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                      <TouchableOpacity style={[styles.modalBtn, { flex: 1, backgroundColor: '#0EA5E9' }]} onPress={async () => {
                        try {
                          await api.put(`/users/${selectedStaff._id}`, {
                            perTankIncentive: Number(editForm.perTankIncentive ?? selectedStaff.perTankIncentive) || 0,
                            defaultPerJobIncentive: Number(editForm.defaultPerJobIncentive ?? selectedStaff.defaultPerJobIncentive) || 0,
                            defaultFuelExpense: editForm.defaultFuelExpense !== undefined ? Number(editForm.defaultFuelExpense) || 0 : undefined,
                          });
                          setEditingStaff(false);
                          setSelectedStaff({
                            ...selectedStaff,
                            perTankIncentive: Number(editForm.perTankIncentive ?? selectedStaff.perTankIncentive) || 0,
                            defaultPerJobIncentive: Number(editForm.defaultPerJobIncentive ?? selectedStaff.defaultPerJobIncentive) || 0,
                            defaultFuelExpense: editForm.defaultFuelExpense !== undefined ? Number(editForm.defaultFuelExpense) : selectedStaff.defaultFuelExpense,
                          });
                          loadStaff();
                        } catch (e: any) {
                          Alert.alert('Error', e.response?.data?.message || 'Failed to update');
                        }
                      }}>
                        <Text style={styles.modalBtnPrimaryText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.modalBtn, { flex: 1, backgroundColor: '#94a3b8' }]} onPress={() => { setEditingStaff(false); setEditForm({}); }}>
                        <Text style={styles.modalBtnPrimaryText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#e0f2fe', marginBottom: 12 }]} onPress={() => { setEditingStaff(true); setEditForm({}); }}>
                    <Text style={[styles.modalBtnPrimaryText, { color: '#0284c7' }]}>Edit staff (incentive & expense)</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.staffDetailCard}>
                  <Text style={styles.staffDetailCardTitle}>PERFORMANCE</Text>
                  {loadingStats && (
                    <ActivityIndicator size="small" color="#0EA5E9" style={{ marginVertical: 12 }} />
                  )}
                  {!!staffStats && !loadingStats && (
                    <>
                      <View style={styles.staffStatsGrid}>
                        <View style={styles.staffStatBox}>
                          <Text style={styles.staffStatNumber}>{staffStats.totalJobs}</Text>
                          <Text style={styles.staffStatLabel}>Total Jobs</Text>
                        </View>
                        <View style={styles.staffStatBox}>
                          <Text style={styles.staffStatNumber}>{staffStats.completedJobs}</Text>
                          <Text style={styles.staffStatLabel}>Completed</Text>
                        </View>
                        <View style={styles.staffStatBox}>
                          <Text style={styles.staffStatNumber}>{staffStats.completionRate}%</Text>
                          <Text style={styles.staffStatLabel}>Rate</Text>
                        </View>
                      </View>
                      <View style={styles.staffDetailInfoRow}><Text style={styles.staffDetailInfoLabel}>Total Revenue</Text><Text style={[styles.staffDetailInfoValue, { color: '#16a34a' }]}>₹{(staffStats.totalRevenue ?? 0).toLocaleString('en-IN')}</Text></View>
                      <View style={styles.staffDetailInfoRow}><Text style={styles.staffDetailInfoLabel}>This Month Revenue</Text><Text style={[styles.staffDetailInfoValue, { color: '#16a34a' }]}>₹{(staffStats.monthlyRevenue ?? 0).toLocaleString('en-IN')}</Text></View>
                      <View style={styles.staffDetailInfoRow}><Text style={styles.staffDetailInfoLabel}>Total Incentive</Text><Text style={[styles.staffDetailInfoValue, { color: '#0EA5E9' }]}>₹{(staffStats.totalIncentive ?? 0).toLocaleString('en-IN')}</Text></View>
                      <View style={styles.staffDetailInfoRow}><Text style={styles.staffDetailInfoLabel}>This Month Incentive</Text><Text style={[styles.staffDetailInfoValue, { color: '#0EA5E9' }]}>₹{(staffStats.monthlyIncentive ?? 0).toLocaleString('en-IN')}</Text></View>
                    </>
                  )}
                </View>

                  {staffJobs.filter((j: any) => j.photos?.before?.length || j.photos?.after?.length || j.completionPhoto || j.completion_photo).length > 0 && (
                    <View style={styles.statsBox}>
                      <Text style={styles.statsTitle}>Job Photos (Before / After)</Text>
                      {staffJobs
                        .filter((j: any) => j.photos?.before?.length || j.photos?.after?.length || j.completionPhoto || j.completion_photo)
                        .slice(0, 4)
                        .map((j: any) => (
                          <View key={j._id} style={{ marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e2e8f0', paddingTop: 8 }}>
                            <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontFamily: FONT_REGULAR }}>{j.customerName}</Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              {j.photos?.before?.slice(0, 1).map((p: string, i: number) => (
                                <View key={`b${i}`}>
                                  <Text style={{ fontSize: 10, color: '#f59e0b', fontWeight: '700', marginBottom: 2 }}>BEFORE</Text>
                                  <Image source={{ uri: resolvePhotoUrl(p) || '' }} style={{ width: 64, height: 50, borderRadius: 6, backgroundColor: '#f1f5f9' }} resizeMode="cover" />
                                </View>
                              ))}
                              {(j.photos?.after?.slice(0, 1) || []).map((p: string, i: number) => (
                                <View key={`a${i}`}>
                                  <Text style={{ fontSize: 10, color: '#22c55e', fontWeight: '700', marginBottom: 2 }}>AFTER</Text>
                                  <Image source={{ uri: resolvePhotoUrl(p) || '' }} style={{ width: 64, height: 50, borderRadius: 6, backgroundColor: '#f1f5f9' }} resizeMode="cover" />
                                </View>
                              ))}
                              {!j.photos?.after?.length && (j.completionPhoto || j.completion_photo) && (
                                <View>
                                  <Text style={{ fontSize: 10, color: '#22c55e', fontWeight: '700', marginBottom: 2 }}>AFTER</Text>
                                  <Image source={{ uri: resolvePhotoUrl(j.completionPhoto || j.completion_photo) || '' }} style={{ width: 64, height: 50, borderRadius: 6, backgroundColor: '#f1f5f9' }} resizeMode="cover" />
                                </View>
                              )}
                            </View>
                          </View>
                        ))}
                    </View>
                  )}
                <TouchableOpacity
                  style={styles.staffDeleteBtn}
                  onPress={() => selectedStaff && handleDeleteStaff(selectedStaff._id, selectedStaff.name)}
                >
                  <Ionicons name="trash-outline" size={18} color="#dc2626" />
                  <Text style={styles.staffDeleteBtnText}>Delete staff</Text>
                </TouchableOpacity>
                </>
              )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    fontFamily: FONT_MEDIUM,
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
    fontFamily: FONT_MEDIUM,
  },
  list: {
    padding: 16,
  },
  staffCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    fontFamily: FONT_MEDIUM,
  },
  staffPhone: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 2,
    fontFamily: FONT_REGULAR,
  },
  staffDetail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    fontFamily: FONT_REGULAR,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  tapHint: {
    fontSize: 11,
    color: '#94a3b8',
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    fontFamily: FONT_MEDIUM,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#111827', // dark text so it stays visible in light/dark mode
    backgroundColor: '#ffffff',
    marginBottom: 12,
    fontFamily: FONT_REGULAR,
  },
  inputArea: {
    minHeight: 56,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  col: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
    fontFamily: FONT_MEDIUM,
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
    fontFamily: FONT_REGULAR,
  },
  chipTextActive: {
    color: '#0369a1',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
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
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FONT_MEDIUM,
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FONT_MEDIUM,
  },
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailModal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  detailTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 14,
    fontFamily: FONT_MEDIUM,
  },
  detailBody: {
    marginBottom: 16,
  },
  detailRow: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 8,
    fontFamily: FONT_REGULAR,
  },
  detailLabel: {
    fontWeight: '600',
    color: '#64748b',
    fontFamily: FONT_MEDIUM,
  },
  detailBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  detailBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONT_MEDIUM,
  },
  detailDeleteBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 4,
  },
  detailDeleteText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FONT_MEDIUM,
  },
  detailCloseBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  detailCloseText: {
    color: '#0EA5E9',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FONT_MEDIUM,
  },
  salaryCard: {
    marginTop: 6,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    padding: 10,
  },
  salaryTitle: {
    fontSize: 12,
    color: '#475569',
    fontFamily: FONT_MEDIUM,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  salaryLabel: {
    fontSize: 13,
    color: '#334155',
    fontFamily: FONT_REGULAR,
  },
  salaryValue: {
    fontSize: 14,
    color: '#0f172a',
    fontFamily: FONT_MEDIUM,
  },
  statsBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  statsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    fontFamily: FONT_MEDIUM,
    marginBottom: 4,
  },
  statsLine: {
    fontSize: 12,
    color: '#334155',
    fontFamily: FONT_REGULAR,
    marginBottom: 3,
    lineHeight: 18,
  },
  fullScreenModal: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  modalBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: FONT_MEDIUM,
  },
  staffDetailBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  staffDetailCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  staffDetailCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 10,
    fontFamily: FONT_MEDIUM,
  },
  staffDetailInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  staffDetailInfoLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    fontFamily: FONT_REGULAR,
  },
  staffDetailInfoValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
    fontFamily: FONT_MEDIUM,
  },
  staffStatsGrid: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
  },
  staffStatBox: {
    flex: 1,
    backgroundColor: '#f0f9ff',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  staffStatNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0EA5E9',
    fontFamily: FONT_MEDIUM,
  },
  staffStatLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
    fontFamily: FONT_REGULAR,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  staffDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  staffDeleteBtnText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: FONT_MEDIUM,
  },
});
