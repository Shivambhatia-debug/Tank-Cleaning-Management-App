import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../utils/api';
import BrandText from '../../components/BrandText';

export default function StaffManagementScreen() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [newStaff, setNewStaff] = useState({ name: '', phone: '', password: '', businessName: '', location: '' });
  const [addingStaff, setAddingStaff] = useState(false);

  useEffect(() => {
    loadStaff();
  }, []);

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
      });
      Alert.alert(
        'Staff added',
        `Share this password with them: ${newStaff.password}\n\n(Note it down; it won't be shown again.)`
      );
      setModalVisible(false);
      setNewStaff({ name: '', phone: '', password: '', businessName: '', location: '' });
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

  const renderStaffCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.staffCard}
      onPress={() => { setSelectedStaff(item); setDetailModalVisible(true); }}
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

            <TextInput
              style={styles.input}
              placeholder="Staff Name"
              value={newStaff.name}
              onChangeText={(text) => setNewStaff({ ...newStaff, name: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Phone (10 digits only)"
              value={newStaff.phone}
              onChangeText={(t) => setNewStaff({ ...newStaff, phone: t.replace(/\D/g, '').slice(0, 10) })}
              keyboardType="phone-pad"
              maxLength={10}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              value={newStaff.password}
              onChangeText={(text) => setNewStaff({ ...newStaff, password: text })}
              secureTextEntry
            />

            <TextInput
              style={styles.input}
              placeholder="Business name"
              value={newStaff.businessName}
              onChangeText={(t) => setNewStaff({ ...newStaff, businessName: t })}
            />

            <TextInput
              style={[styles.input, styles.inputArea]}
              placeholder="Location / Address (kahan rehte hain)"
              value={newStaff.location}
              onChangeText={(t) => setNewStaff({ ...newStaff, location: t })}
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
                  <View style={[styles.detailBadge, { backgroundColor: selectedStaff.isActive ? '#34C759' : '#FF3B30' }]}>
                    <Text style={styles.detailBadgeText}>{selectedStaff.isActive ? 'Active' : 'Inactive'}</Text>
                  </View>
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
    marginBottom: 12,
  },
  inputArea: {
    minHeight: 56,
    textAlignVertical: 'top',
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
