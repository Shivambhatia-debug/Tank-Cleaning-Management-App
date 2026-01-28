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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../utils/api';

export default function JobsManagementScreen() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
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

    setCreatingJob(true);
    try {
      // Use default coordinates if not set
      const jobData = {
        ...newJob,
        latitude: newJob.latitude || 12.9716,
        longitude: newJob.longitude || 77.5946,
      };

      await api.post('/jobs', jobData);
      Alert.alert('Success', 'Job created successfully');
      setModalVisible(false);
      resetForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create job');
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

  const filteredJobs = filterStatus === 'all' 
    ? jobs 
    : jobs.filter(job => job.status === filterStatus);

  const renderJobCard = ({ item }: { item: any }) => (
    <View style={styles.jobCard}>
      <View style={styles.jobHeader}>
        <Text style={styles.customerName}>{item.customer_name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
        </View>
      </View>
      <Text style={styles.address}>{item.address}</Text>
      {item.notes && (
        <Text style={styles.notes} numberOfLines={2}>
          {item.notes}
        </Text>
      )}
      <View style={styles.jobFooter}>
        <Text style={styles.assignedCount}>
          Assigned to {item.assigned_staff_ids.length} staff
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
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.addButtonText}>+ Create Job</Text>
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
        keyExtractor={(item) => item.id}
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

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add any special instructions"
                value={newJob.notes}
                onChangeText={(text) => setNewJob({ ...newJob, notes: text })}
                multiline
                numberOfLines={2}
              />

              <Text style={styles.label}>Assign Staff *</Text>
              {staff.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.staffItem,
                    newJob.assigned_staff_ids.includes(s.id) &&
                      styles.staffItemSelected,
                  ]}
                  onPress={() => toggleStaffSelection(s.id)}
                >
                  <Text
                    style={[
                      styles.staffName,
                      newJob.assigned_staff_ids.includes(s.id) &&
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
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#F5F5F5',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  list: {
    padding: 16,
  },
  jobCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  address: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  notes: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  jobFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 8,
    marginTop: 8,
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
});
