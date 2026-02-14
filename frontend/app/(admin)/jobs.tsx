import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import api, { getUploadsBaseUrl } from '../../utils/api';
import BrandText from '../../components/BrandText';
import DropdownPicker from '../../components/DropdownPicker';
import CalendarPicker from '../../components/CalendarPicker';

const TANK_SIZE_OPTIONS = ['500L', '750L', '1000L', '1500L', '2000L', '3000L', '5000L', '10000L'];
const SERVICE_TYPE_OPTIONS = ['Water Tank', 'Sump Cleaning', 'Overhead Tank', 'Underground Tank', 'RO Tank', 'Aquarium Tank', 'Septic Tank', 'Swimming Pool', 'Other'];
const LEAD_SOURCE_OPTIONS = ['Call', 'WhatsApp', 'Facebook', 'Instagram', 'Google', 'Referral', 'Walk-in', 'JustDial', 'Lead', 'Other'];
const PAYMENT_MODE_OPTIONS = ['pending', 'cash', 'upi', 'online', 'card'];

const DEFAULT_MAP_REGION = {
  latitude: 26.1775,
  longitude: 85.8714,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

function CompletionPhotoImage({ filename, getUploadsBaseUrl, style }: { filename: string; getUploadsBaseUrl: () => string; style: any }) {
  const [loadError, setLoadError] = useState(false);
  const uri = `${getUploadsBaseUrl()}/uploads/${filename}`;
  if (loadError) {
    return (
      <View style={[style, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 12, color: '#666' }}>📷 Photo unavailable</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode="cover"
      onError={() => setLoadError(true)}
    />
  );
}

export default function JobsManagementScreen() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<{ name: string; startingPrice: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [newJob, setNewJob] = useState({
    customer_name: '',
    address: '',
    latitude: 0,
    longitude: 0,
    assigned_staff_ids: [] as string[],
    notes: '',
    // CRM Fields
    mobile_number: '',
    tank_size: '500L',
    service_type: 'Water Tank',
    lead_source: 'Call',
    service_charge: '',
    scheduled_at: '',
    incentive_per_job: '',
    payment_mode: 'pending',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [jobsRes, staffRes, servicesRes] = await Promise.all([
        api.get('/jobs'),
        api.get('/users?role=staff'),
        api.get('/services').catch(() => ({ data: [] })),
      ]);
      setJobs(jobsRes.data);
      setStaff(staffRes.data);
      setServices(Array.isArray(servicesRes.data) ? servicesRes.data : []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreateJob = async () => {
    if (!newJob.customer_name || !newJob.address) {
      Alert.alert('Error', 'Please fill customer name and address');
      return;
    }

    if (newJob.assigned_staff_ids.length === 0) {
      Alert.alert('Error', 'Please assign at least one staff member');
      return;
    }
    const mobileDigits = (newJob.mobile_number || '').replace(/\D/g, '');
    if (mobileDigits.length > 0 && mobileDigits.length !== 10) {
      Alert.alert('Error', 'Customer mobile must be 10 digits');
      return;
    }

    setCreatingJob(true);
    try {
      // Map frontend state to backend model keys
      const jobData: any = {
        customerName: newJob.customer_name,
        address: newJob.address,
        // Use entered coordinates, or default to generic center if 0
        targetLatitude: newJob.latitude || 26.1775,
        targetLongitude: newJob.longitude || 85.8714,
        // Also save as main location for backward compatibility
        latitude: newJob.latitude || 26.1775,
        longitude: newJob.longitude || 85.8714,
        assignedStaff: newJob.assigned_staff_ids,
        notes: newJob.notes,
        // New CRM fields
        mobileNumber: mobileDigits || newJob.mobile_number,
        tankSize: newJob.tank_size,
        serviceType: newJob.service_type,
        leadSource: newJob.lead_source,
        serviceCharge: Number(newJob.service_charge) || 0,
        paymentMode: (newJob.payment_mode || 'pending').toLowerCase(),
        incentivePerJob: Number(newJob.incentive_per_job) || 0,
      };

      if (newJob.scheduled_at) {
        jobData.scheduledAt = newJob.scheduled_at;
      }

      await api.post('/jobs', jobData);
      Alert.alert('Success', 'Job created successfully');
      setModalVisible(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Job creation error:', error.response?.data);
      Alert.alert('Error', error.response?.data?.message || 'Failed to create job');
    } finally {
      setCreatingJob(false);
    }
  };

  const resetForm = () => {
    setNewJob({
      customer_name: '',
      address: '',
      latitude: 0,
      longitude: 0,
      assigned_staff_ids: [],
      notes: '',
      mobile_number: '',
      tank_size: '500L',
      service_type: 'Water Tank',
      lead_source: 'Call',
      service_charge: '',
    });
  };

  const toggleStaffSelection = (staffId: string) => {
    if (newJob.assigned_staff_ids.includes(staffId)) {
      setNewJob({
        ...newJob,
        assigned_staff_ids: newJob.assigned_staff_ids.filter((id) => id !== staffId),
      });
    } else {
      setNewJob({
        ...newJob,
        assigned_staff_ids: [...newJob.assigned_staff_ids, staffId],
      });
    }
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

  const handleDeleteJob = (item: any, customerName: string) => {
    const rawId = item.id ?? item._id;
    const jobId = rawId != null ? String(rawId).trim() : '';
    if (!jobId) {
      Alert.alert('Error', 'Cannot delete: job id missing');
      return;
    }
    Alert.alert(
      'Delete Job',
      `Delete job for "${customerName}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/jobs/${jobId}`);
              loadData();
              Alert.alert('Done', 'Job deleted');
            } catch (err: any) {
              const data = err.response?.data;
              const msg = (data && (data.message || data.detail)) || err.message || 'Failed to delete job';
              Alert.alert('Error', msg);
              if (err.response?.status === 404) loadData();
            }
          },
        },
      ]
    );
  };

  const filteredJobs = filterStatus === 'all'
    ? jobs
    : jobs.filter(job => job.status === filterStatus);

  const renderJobCard = ({ item }: { item: any }) => (
    <View style={styles.jobCard}>
      <View style={styles.jobHeader}>
        <Text style={styles.customerName}>{item.customerName}</Text>
        <View style={styles.jobHeaderRight}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
          </View>
          <TouchableOpacity
            style={styles.deleteJobButton}
            onPress={() => handleDeleteJob(item, item.customerName || 'this job')}
          >
            <Ionicons name="trash-outline" size={22} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.address}>{item.address}</Text>
      {item.notes && (
        <Text style={styles.notes} numberOfLines={2}>
          {item.notes}
        </Text>
      )}
      {/* CRM Details Display */}
      <View style={{ marginTop: 4, marginBottom: 8 }}>
        <Text style={{ fontSize: 12, color: '#555' }}>📱 {item.mobileNumber || 'N/A'}</Text>
        <Text style={{ fontSize: 12, color: '#555' }}>🛢 {item.tankSize} • {item.serviceType}</Text>
        <Text style={{ fontSize: 12, color: '#555' }}>
          💰 {item.paymentStatus === 'paid' ? 'Paid' : 'Payment pending'} • {(item.serviceCharge ?? item.service_charge) > 0 ? `₹${Number(item.serviceCharge ?? item.service_charge).toLocaleString('en-IN')}` : 'Price on request'}
        </Text>
        <Text style={{ fontSize: 12, color: '#555' }}>
          👷 Per job incentive: {(item.incentivePerJob ?? item.incentive_per_job) != null && (item.incentivePerJob ?? item.incentive_per_job) !== '' ? `₹${Number(item.incentivePerJob ?? item.incentive_per_job).toLocaleString('en-IN')}` : '—'}
        </Text>
        {item.scheduledAt && (
          <Text style={{ fontSize: 11, color: '#6b7280' }}>
            🗓 {new Date(item.scheduledAt).toLocaleString()}
          </Text>
        )}
        {item.nextServiceAt && (
          <Text style={{ fontSize: 11, color: '#16a34a' }}>
            🔁 Next cleaning: {new Date(item.nextServiceAt).toLocaleDateString()}
          </Text>
        )}
      </View>

      {(item.completionPhoto || item.completion_photo) && (
        <View style={{ marginBottom: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#eee' }}>
          <Text style={{ fontSize: 12, color: '#333', fontWeight: '500', marginBottom: 6 }}>📷 Completion Photo</Text>
          <CompletionPhotoImage
            filename={item.completionPhoto || item.completion_photo}
            getUploadsBaseUrl={getUploadsBaseUrl}
            style={styles.completionThumb}
          />
          {(item.completionPhotoAt || item.completion_photo_at) && (
            <Text style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
              📅 {new Date(item.completionPhotoAt || item.completion_photo_at).toLocaleDateString()} {new Date(item.completionPhotoAt || item.completion_photo_at).toLocaleTimeString()}
            </Text>
          )}
          {(item.completionLatitude != null || item.completion_latitude != null) && (item.completionLongitude != null || item.completion_longitude != null) && (
            <Text style={{ fontSize: 11, color: '#666' }}>
              📍 {Number(item.completionLatitude ?? item.completion_latitude).toFixed(5)}, {Number(item.completionLongitude ?? item.completion_longitude).toFixed(5)}
            </Text>
          )}
        </View>
      )}

      <View style={styles.jobFooter}>
        <Text style={styles.assignedCount}>
          Assigned to {item.assignedStaff?.length || 0} staff
        </Text>
      </View>
    </View>
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
        <Text style={styles.title}>Jobs</Text>
        <View style={styles.headerBrand}>
          <BrandText faded />
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
          <Text style={styles.addButtonText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['all', 'pending', 'in_progress', 'completed'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                filterStatus === status && styles.filterButtonActive,
              ]}
              onPress={() => setFilterStatus(status)}
            >
              <Text
                style={[
                  styles.filterText,
                  filterStatus === status && styles.filterTextActive,
                ]}
              >
                {status.replace('_', ' ').toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredJobs}
        renderItem={renderJobCard}
        keyExtractor={(item) => item._id || item.id || String(item.createdAt || Math.random())}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadData} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No jobs found</Text>
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
          <ScrollView style={styles.modalScroll}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create New Job</Text>

              <Text style={styles.label}>Customer Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter customer name"
                value={newJob.customer_name}
                onChangeText={(text) =>
                  setNewJob({ ...newJob, customer_name: text })
                }
              />

              <Text style={styles.label}>Address *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter full address"
                value={newJob.address}
                onChangeText={(text) => setNewJob({ ...newJob, address: text })}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Mobile (10 digits)</Text>
              <TextInput
                style={styles.input}
                placeholder="10 digit number"
                value={newJob.mobile_number}
                onChangeText={(t) => setNewJob({ ...newJob, mobile_number: t.replace(/\D/g, '').slice(0, 10) })}
                keyboardType="phone-pad"
                maxLength={10}
              />

              <Text style={styles.label}>Target Latitude</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 26.1775"
                keyboardType="numeric"
                value={String(newJob.latitude || '')}
                onChangeText={(text) =>
                  setNewJob({
                    ...newJob,
                    latitude: text ? parseFloat(text) || 0 : 0,
                  })
                }
              />

              <Text style={styles.label}>Target Longitude</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 85.8714"
                keyboardType="numeric"
                value={String(newJob.longitude || '')}
                onChangeText={(text) =>
                  setNewJob({
                    ...newJob,
                    longitude: text ? parseFloat(text) || 0 : 0,
                  })
                }
              />

              {/* Mini map preview so admin can see marker for the decoded plus code */}
              {Platform.OS !== 'web' && newJob.latitude && newJob.longitude ? (
                <View style={styles.previewMapWrap}>
                  <Text style={styles.labelSmall}>Location preview</Text>
                  <MapView
                    style={styles.previewMap}
                    pointerEvents="none"
                    region={{
                      latitude: newJob.latitude,
                      longitude: newJob.longitude,
                      latitudeDelta: DEFAULT_MAP_REGION.latitudeDelta,
                      longitudeDelta: DEFAULT_MAP_REGION.longitudeDelta,
                    }}
                  >
                    <Marker
                      coordinate={{ latitude: newJob.latitude, longitude: newJob.longitude }}
                      title="Job location"
                    />
                  </MapView>
                </View>
              ) : null}

              <View style={styles.row}>
                <View style={styles.col}>
                  <DropdownPicker
                    label="Tank Size"
                    placeholder="Select size"
                    value={newJob.tank_size}
                    options={TANK_SIZE_OPTIONS}
                    onSelect={(v) => setNewJob({ ...newJob, tank_size: v })}
                  />
                </View>
                <View style={{ width: 10 }} />
                <View style={styles.col}>
                  <Text style={styles.label}>Service Charge</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="₹ Amount"
                    value={newJob.service_charge}
                    onChangeText={(text) => setNewJob({ ...newJob, service_charge: text })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <CalendarPicker
                label="Scheduled Date (optional)"
                placeholder="Select date"
                value={newJob.scheduled_at ? newJob.scheduled_at.slice(0, 10) : ''}
                onChange={(d) => setNewJob({ ...newJob, scheduled_at: d ? `${d}T10:00:00` : '' })}
              />

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Per job incentive (₹)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 20"
                value={newJob.incentive_per_job}
                onChangeText={(text) => setNewJob({ ...newJob, incentive_per_job: text })}
                keyboardType="numeric"
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={styles.col}>
              <DropdownPicker
                label="Payment Mode"
                placeholder="Select mode"
                value={newJob.payment_mode}
                options={PAYMENT_MODE_OPTIONS}
                onSelect={(v) => setNewJob({ ...newJob, payment_mode: v })}
              />
            </View>
          </View>

              <View style={styles.row}>
                <View style={styles.col}>
                  <DropdownPicker
                    label="Service Type"
                    placeholder="Select type"
                    value={newJob.service_type}
                    options={SERVICE_TYPE_OPTIONS}
                    onSelect={(v) => setNewJob({ ...newJob, service_type: v })}
                  />
                </View>
                <View style={{ width: 10 }} />
                <View style={styles.col}>
                  <DropdownPicker
                    label="Lead Source"
                    placeholder="Select source"
                    value={newJob.lead_source}
                    options={LEAD_SOURCE_OPTIONS}
                    onSelect={(v) => setNewJob({ ...newJob, lead_source: v })}
                  />
                </View>
              </View>

              <View style={styles.serviceRefBox}>
                <Text style={styles.serviceRefTitle}>Cleaning & pest control – starting prices (reference)</Text>
                <View style={styles.serviceRefGrid}>
                  {services.map((s, idx) => (
                    <View key={idx} style={styles.serviceRefItem}>
                      <Text style={styles.serviceRefName}>{s.name}</Text>
                      <Text style={styles.serviceRefPrice}>{s.startingPrice != null ? `₹${s.startingPrice}` : 'On request'}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add any special instructions"
                value={newJob.notes}
                onChangeText={(text) => setNewJob({ ...newJob, notes: text })}
                multiline
                numberOfLines={2}
              />

              <Text style={styles.label}>Assign Staff * (only active staff)</Text>
              {(staff.filter((s) => s.isActive !== false) || []).map((s) => (
                <TouchableOpacity
                  key={s._id}
                  style={[
                    styles.staffItem,
                    newJob.assigned_staff_ids.includes(s._id) &&
                    styles.staffItemSelected,
                  ]}
                  onPress={() => toggleStaffSelection(s._id)}
                >
                  <Text
                    style={[
                      styles.staffName,
                      newJob.assigned_staff_ids.includes(s._id) &&
                      styles.staffNameSelected,
                    ]}
                  >
                    {s.name}
                  </Text>
                  <Text style={styles.staffPhone}>{s.phone}</Text>
                </TouchableOpacity>
              ))}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setModalVisible(false);
                    resetForm();
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.submitButton]}
                  onPress={handleCreateJob}
                  disabled={creatingJob}
                >
                  {creatingJob ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Create Job</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#f1f5f9',
  },
  filterButtonActive: {
    backgroundColor: '#0EA5E9',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterTextActive: {
    color: '#fff',
  },
  list: {
    padding: 14,
  },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  jobHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  deleteJobButton: {
    padding: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  address: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 6,
  },
  notes: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  jobFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    marginTop: 8,
  },
  completionThumb: {
    width: '100%',
    maxWidth: 280,
    height: 140,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  assignedCount: {
    fontSize: 12,
    color: '#8E8E93',
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
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    marginTop: 60,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  staffItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    marginBottom: 8,
  },
  staffItemSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  staffName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  staffNameSelected: {
    color: '#007AFF',
  },
  staffPhone: {
    fontSize: 14,
    color: '#666',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  col: {
    flex: 1,
  },
  labelSmall: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  serviceRefBox: {
    backgroundColor: '#f0f9ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  serviceRefTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 8,
  },
  serviceRefGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  serviceRefItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  serviceRefName: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '500',
  },
  serviceRefPrice: {
    fontSize: 11,
    color: '#0EA5E9',
    fontWeight: '600',
  },
  previewMapWrap: {
    marginTop: 4,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  previewMap: {
    width: '100%',
    height: 140,
  },
});
