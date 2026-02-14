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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api, { getUploadsBaseUrl } from '../../utils/api';
import BrandText from '../../components/BrandText';
import CalendarPicker from '../../components/CalendarPicker';

const STAFF_TYPE_OPTIONS = ['Full Time', 'Part Time'] as const;
const STAFF_STATUS_OPTIONS = ['Active', 'Inactive', 'Terminated'] as const;

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
    hasBike: false,
    fuelAllowance: '',
    joiningDate: '',
    employmentStatus: 'Active' as (typeof STAFF_STATUS_OPTIONS)[number],
    remarks: '',
  });
  const [addingStaff, setAddingStaff] = useState(false);
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
        hasBike: newStaff.hasBike,
        fuelAllowance: newStaff.fuelAllowance ? Number(newStaff.fuelAllowance) || 0 : undefined,
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
        hasBike: false,
        fuelAllowance: '',
        joiningDate: '',
        employmentStatus: 'Active',
        remarks: '',
      });
      loadStaff();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add staff');
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
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Staff</Text>
            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
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
                <View style={{ width: 10 }} />
                <View style={styles.col}>
                  <Text style={styles.label}>Fuel Allowance (₹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 1500"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={newStaff.fuelAllowance}
                    onChangeText={(t) => setNewStaff({ ...newStaff, fuelAllowance: t })}
                  />
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
          </View>
        </View>
      </Modal>

      <Modal
        visible={detailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.detailOverlay}
          activeOpacity={1}
          onPress={() => setDetailModalVisible(false)}
        >
          <View style={styles.detailModal}>
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.detailTitle}>Staff details</Text>
              {selectedStaff && (
                <View style={styles.detailBody}>
                  <Text style={styles.detailRow}><Text style={styles.detailLabel}>Name:</Text> {selectedStaff.name}</Text>
                  <Text style={styles.detailRow}><Text style={styles.detailLabel}>Phone:</Text> {selectedStaff.phone}</Text>
                  <Text style={styles.detailRow}><Text style={styles.detailLabel}>Password:</Text> {selectedStaff.plainPasswordForAdmin || '—'}</Text>
                  <Text style={styles.detailRow}><Text style={styles.detailLabel}>Business:</Text> {selectedStaff.businessName || '—'}</Text>
                  <Text style={styles.detailRow}><Text style={styles.detailLabel}>Location:</Text> {selectedStaff.location || '—'}</Text>
                  {(selectedStaff.defaultPerJobIncentive != null && selectedStaff.defaultPerJobIncentive !== '') && (
                    <Text style={styles.detailRow}><Text style={styles.detailLabel}>Default per job incentive:</Text> ₹{Number(selectedStaff.defaultPerJobIncentive).toLocaleString('en-IN')}</Text>
                  )}
                  <View style={[styles.detailBadge, { backgroundColor: selectedStaff.isActive ? '#34C759' : '#FF3B30' }]}>
                    <Text style={styles.detailBadgeText}>{selectedStaff.isActive ? 'Active' : 'Inactive'}</Text>
                  </View>

                  <View style={styles.statsBox}>
                    <Text style={styles.statsTitle}>Performance (auto calculated)</Text>
                    {loadingStats && (
                      <Text style={styles.statsLine}>Loading…</Text>
                    )}
                    {!!staffStats && !loadingStats && (
                      <>
                        <Text style={styles.statsLine}>
                          Total jobs: {staffStats.totalJobs} • Completed: {staffStats.completedJobs} ({staffStats.completionRate}%)
                        </Text>
                        <Text style={styles.statsLine}>
                          Revenue (from jobs): ₹{(staffStats.totalRevenue ?? 0).toLocaleString('en-IN')} total • ₹{(staffStats.monthlyRevenue ?? 0).toLocaleString('en-IN')} this month
                        </Text>
                        <Text style={styles.statsLine}>
                          Per‑job incentive earned: ₹{(staffStats.totalIncentive ?? 0).toLocaleString('en-IN')} total • ₹{(staffStats.monthlyIncentive ?? 0).toLocaleString('en-IN')} this month
                        </Text>
                      </>
                    )}
                  </View>

                  {staffJobs.filter((j: any) => j.status === 'completed' && (j.completionPhoto || j.completion_photo)).length > 0 && (
                    <View style={styles.statsBox}>
                      <Text style={styles.statsTitle}>📷 Completion photos (from jobs)</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                        {staffJobs
                          .filter((j: any) => j.status === 'completed' && (j.completionPhoto || j.completion_photo))
                          .slice(0, 6)
                          .map((j: any) => (
                            <Image
                              key={j._id}
                              source={{ uri: `${getUploadsBaseUrl()}/uploads/${j.completionPhoto || j.completion_photo}` }}
                              style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: '#eee' }}
                              resizeMode="cover"
                            />
                          ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
              <TouchableOpacity
                style={styles.detailDeleteBtn}
                onPress={() => selectedStaff && handleDeleteStaff(selectedStaff._id, selectedStaff.name)}
              >
                <Text style={styles.detailDeleteText}>Delete staff</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.detailCloseBtn} onPress={() => setDetailModalVisible(false)}>
                <Text style={styles.detailCloseText}>Close</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
  },
  staffPhone: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 2,
  },
  staffDetail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
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
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
  },
  detailTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 14,
  },
  detailBody: {
    marginBottom: 16,
  },
  detailRow: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 8,
  },
  detailLabel: {
    fontWeight: '600',
    color: '#64748b',
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
  },
  detailCloseBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  detailCloseText: {
    color: '#0EA5E9',
    fontSize: 15,
    fontWeight: '600',
  },
});
