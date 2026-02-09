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

const DEFAULT_MAP_REGION = {
  latitude: 26.1775,
  longitude: 85.8714,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export default function JobsManagementScreen() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const [pickerLat, setPickerLat] = useState(26.1775);
  const [pickerLng, setPickerLng] = useState(85.8714);
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
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [jobsRes, staffRes] = await Promise.all([
        api.get('/jobs'),
        api.get('/users?role=staff'),
      ]);
      setJobs(jobsRes.data);
      setStaff(staffRes.data);
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
      const jobData = {
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
      };

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
      </View>

      {item.completionPhoto && (
        <View style={{ marginBottom: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#eee' }}>
          <Text style={{ fontSize: 12, color: '#333', fontWeight: '500', marginBottom: 6 }}>📷 Completion Photo</Text>
          <Image
            source={{ uri: `${getUploadsBaseUrl()}/uploads/${item.completionPhoto}` }}
            style={styles.completionThumb}
            resizeMode="cover"
          />
          {item.completionPhotoAt && (
            <Text style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
              📅 {new Date(item.completionPhotoAt).toLocaleDateString()} {new Date(item.completionPhotoAt).toLocaleTimeString()}
            </Text>
          )}
          {item.completionLatitude != null && item.completionLongitude != null && (
            <Text style={{ fontSize: 11, color: '#666' }}>
              📍 {Number(item.completionLatitude).toFixed(5)}, {Number(item.completionLongitude).toFixed(5)}
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

              <Text style={styles.label}>Target Location</Text>
              {Platform.OS !== 'web' && (
                <TouchableOpacity
                  style={styles.chooseOnMapButton}
                  onPress={() => {
                    setPickerLat(newJob.latitude || DEFAULT_MAP_REGION.latitude);
                    setPickerLng(newJob.longitude || DEFAULT_MAP_REGION.longitude);
                    setMapPickerVisible(true);
                  }}
                >
                  <Ionicons name="map-outline" size={22} color="#007AFF" />
                  <Text style={styles.chooseOnMapButtonText}>Choose on map</Text>
                </TouchableOpacity>
              )}
              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.labelSmall}>Latitude</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 26.17"
                    value={String(newJob.latitude || '')}
                    onChangeText={(text) => setNewJob({ ...newJob, latitude: parseFloat(text) || 0 })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ width: 10 }} />
                <View style={styles.col}>
                  <Text style={styles.labelSmall}>Longitude</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 85.87"
                    value={String(newJob.longitude || '')}
                    onChangeText={(text) => setNewJob({ ...newJob, longitude: parseFloat(text) || 0 })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>Tank Size</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 1000L"
                    value={newJob.tank_size}
                    onChangeText={(text) => setNewJob({ ...newJob, tank_size: text })}
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

              <Text style={styles.label}>Service Details</Text>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.col]}
                  placeholder="Service Type (Water Tank)"
                  value={newJob.service_type}
                  onChangeText={(text) => setNewJob({ ...newJob, service_type: text })}
                />
                <View style={{ width: 10 }} />
                <TextInput
                  style={[styles.input, styles.col]}
                  placeholder="Lead Source (FB/Ref)"
                  value={newJob.lead_source}
                  onChangeText={(text) => setNewJob({ ...newJob, lead_source: text })}
                />
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

      {/* Map picker modal - tap on map to choose location */}
      <Modal
        visible={mapPickerVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setMapPickerVisible(false)}
      >
        <SafeAreaView style={styles.mapPickerContainer}>
          <View style={styles.mapPickerHeader}>
            <Text style={styles.mapPickerTitle}>Choose job location</Text>
            <Text style={styles.mapPickerHint}>Tap on map to set pin</Text>
          </View>
          <View style={styles.mapPickerMapWrap}>
            <MapView
              style={styles.mapPickerMap}
              initialRegion={{
                latitude: pickerLat,
                longitude: pickerLng,
                latitudeDelta: DEFAULT_MAP_REGION.latitudeDelta,
                longitudeDelta: DEFAULT_MAP_REGION.longitudeDelta,
              }}
              onPress={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                setPickerLat(latitude);
                setPickerLng(longitude);
              }}
            >
              <Marker
                coordinate={{ latitude: pickerLat, longitude: pickerLng }}
                title="Job location"
              />
            </MapView>
          </View>
          <View style={styles.mapPickerCoords}>
            <Text style={styles.mapPickerCoordsText}>
              {pickerLat.toFixed(5)}, {pickerLng.toFixed(5)}
            </Text>
          </View>
          <View style={styles.mapPickerButtons}>
            <TouchableOpacity
              style={[styles.mapPickerBtn, styles.mapPickerBtnCancel]}
              onPress={() => setMapPickerVisible(false)}
            >
              <Text style={styles.mapPickerBtnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mapPickerBtn, styles.mapPickerBtnUse]}
              onPress={() => {
                setNewJob({ ...newJob, latitude: pickerLat, longitude: pickerLng });
                setMapPickerVisible(false);
              }}
            >
              <Text style={styles.mapPickerBtnUseText}>Use this location</Text>
            </TouchableOpacity>
          </View>
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
  chooseOnMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
  },
  chooseOnMapButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  mapPickerContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapPickerHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  mapPickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  mapPickerHint: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  mapPickerMapWrap: {
    flex: 1,
    minHeight: 300,
  },
  mapPickerMap: {
    width: '100%',
    height: '100%',
  },
  mapPickerCoords: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
  },
  mapPickerCoordsText: {
    fontSize: 13,
    color: '#555',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  mapPickerButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  mapPickerBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  mapPickerBtnCancel: {
    backgroundColor: '#F0F0F0',
  },
  mapPickerBtnCancelText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  mapPickerBtnUse: {
    backgroundColor: '#007AFF',
  },
  mapPickerBtnUseText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
