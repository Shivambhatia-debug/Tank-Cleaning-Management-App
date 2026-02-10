import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../../components/AppHeader';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';

type Lead = {
  _id: string;
  customerName: string;
  mobileNumber: string;
  address?: string;
  status: string;
  source?: string;
  latitude?: number;
  longitude?: number;
  nextFollowUpAt?: string;
  discussionLogs?: {
    at: string;
    by: string;
    notes: string;
    nextFollowUpAt?: string;
  }[];
};

const STATUS_OPTIONS = ['All', 'New', 'Follow-up', 'Confirmed', 'Cancelled', 'Converted'] as const;

export default function LeadsScreen() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<(typeof STATUS_OPTIONS)[number]>('All');

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const [creating, setCreating] = useState(false);
  const [newLead, setNewLead] = useState({
    customerName: '',
    mobileNumber: '',
    address: '',
    source: 'Direct Call',
  });

  const [logText, setLogText] = useState('');
  const [logNextDate, setLogNextDate] = useState('');
  const [addingLog, setAddingLog] = useState(false);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterStatus !== 'All') params.status = filterStatus;
      const res = await api.get<Lead[]>('/leads', { params });
      setLeads(res.data);
    } catch (err: any) {
      console.error('Error loading leads', err.response?.data || err.message);
      Alert.alert('Error', 'Failed to load leads');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLeads();
  };

  const handleCreateLead = async () => {
    const name = newLead.customerName.trim();
    const mobile = newLead.mobileNumber.replace(/\D/g, '').slice(0, 10);
    if (!name || !mobile) {
      Alert.alert('Missing info', 'Customer name and 10 digit mobile are required');
      return;
    }
    if (mobile.length !== 10) {
      Alert.alert('Invalid mobile', 'Enter exactly 10 digit mobile number');
      return;
    }

    setCreating(true);
    try {
      const res = await api.post<Lead>('/leads', {
        customerName: name,
        mobileNumber: mobile,
        address: newLead.address.trim(),
        source: newLead.source || 'Direct Call',
      });
      setCreateModalVisible(false);
      setNewLead({ customerName: '', mobileNumber: '', address: '', source: 'Direct Call' });
      // Prepend new lead to list so admin sees it immediately
      setLeads((prev) => [res.data, ...prev]);
    } catch (err: any) {
      console.error('Create lead error', err.response?.data || err.message);
      Alert.alert('Error', err.response?.data?.message || 'Failed to create lead');
    } finally {
      setCreating(false);
    }
  };

  const openLeadDetail = async (lead: Lead) => {
    try {
      const res = await api.get<Lead>(`/leads/${lead._id}`);
      setSelectedLead(res.data);
      setDetailModalVisible(true);
    } catch (err: any) {
      console.error('Load lead detail error', err.response?.data || err.message);
      Alert.alert('Error', 'Failed to load lead details');
    }
  };

  const handleAddLog = async () => {
    if (!selectedLead) return;
    const notes = logText.trim();
    if (!notes) {
      Alert.alert('Missing notes', 'Please write discussion notes');
      return;
    }
    setAddingLog(true);
    try {
      const payload: any = { notes };
      if (logNextDate) payload.nextFollowUpAt = logNextDate;
      const res = await api.post<Lead>(`/leads/${selectedLead._id}/logs`, payload);
      setSelectedLead(res.data);
      setLogText('');
      setLogNextDate('');
    } catch (err: any) {
      console.error('Add log error', err.response?.data || err.message);
      Alert.alert('Error', err.response?.data?.message || 'Failed to add log');
    } finally {
      setAddingLog(false);
    }
  };

  const filteredLeads =
    filterStatus === 'All' ? leads : leads.filter((l) => l.status === filterStatus);

  const renderLead = ({ item }: { item: Lead }) => (
    <TouchableOpacity
      style={styles.leadCard}
      activeOpacity={0.85}
      onPress={() => openLeadDetail(item)}
    >
      <View style={styles.leadHeader}>
        <Text style={styles.leadName}>{item.customerName}</Text>
        <View style={[styles.statusChip, getStatusChipStyle(item.status)]}>
          <Text style={styles.statusChipText}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.leadPhone}>📱 {item.mobileNumber}</Text>
      {item.address ? <Text style={styles.leadAddress}>📍 {item.address}</Text> : null}
      <View style={styles.leadMetaRow}>
        <Text style={styles.leadMeta}>
          Source: <Text style={styles.leadMetaBold}>{item.source || 'Direct Call'}</Text>
        </Text>
        {item.nextFollowUpAt && (
          <Text style={styles.leadMeta}>
            Next: {new Date(item.nextFollowUpAt).toLocaleDateString()}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const getStatusChipStyle = (status: string) => {
    switch (status) {
      case 'New':
        return { backgroundColor: '#DBEAFE', color: '#1D4ED8' };
      case 'Follow-up':
        return { backgroundColor: '#FEF3C7', color: '#92400E' };
      case 'Confirmed':
        return { backgroundColor: '#DCFCE7', color: '#166534' };
      case 'Converted':
        return { backgroundColor: '#E0F2FE', color: '#075985' };
      case 'Cancelled':
        return { backgroundColor: '#FEE2E2', color: '#B91C1C' };
      default:
        return { backgroundColor: '#E5E7EB', color: '#4B5563' };
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title={user?.name || 'Admin'} subtitle="Leads & CRM" />

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {STATUS_OPTIONS.map((st) => {
            const active = filterStatus === st;
            return (
              <TouchableOpacity
                key={st}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => {
                  setFilterStatus(st);
                  setRefreshing(true);
                  loadLeads();
                }}
              >
                <Text
                  style={[styles.filterChipText, active && styles.filterChipTextActive]}
                >
                  {st}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setCreateModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add lead</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredLeads}
        keyExtractor={(item) => item._id}
        renderItem={renderLead}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No leads yet. Add your first lead.</Text>
          </View>
        }
      />

      {/* Create lead modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New lead</Text>

            <Text style={styles.label}>Customer name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor="#9CA3AF"
              value={newLead.customerName}
              onChangeText={(t) => setNewLead({ ...newLead, customerName: t })}
            />

            <Text style={styles.label}>Mobile *</Text>
            <TextInput
              style={styles.input}
              placeholder="10 digit mobile"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={10}
              value={newLead.mobileNumber}
              onChangeText={(t) =>
                setNewLead({ ...newLead, mobileNumber: t.replace(/\D/g, '').slice(0, 10) })
              }
            />

            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Area / landmark"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={2}
              value={newLead.address}
              onChangeText={(t) => setNewLead({ ...newLead, address: t })}
            />

            <Text style={styles.label}>Source</Text>
            <TextInput
              style={styles.input}
              placeholder="Facebook / WhatsApp / Call"
              placeholderTextColor="#9CA3AF"
              value={newLead.source}
              onChangeText={(t) => setNewLead({ ...newLead, source: t })}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setCreateModalVisible(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={handleCreateLead}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Lead detail + discussion log */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            {selectedLead ? (
              <>
                <Text style={styles.modalTitle}>{selectedLead.customerName}</Text>
                <Text style={styles.detailLine}>📱 {selectedLead.mobileNumber}</Text>
                {selectedLead.address ? (
                  <Text style={styles.detailLine}>📍 {selectedLead.address}</Text>
                ) : null}
                <Text style={styles.detailLine}>
                  Source: <Text style={styles.leadMetaBold}>{selectedLead.source}</Text>
                </Text>
                <Text style={styles.detailLine}>
                  Status: <Text style={styles.leadMetaBold}>{selectedLead.status}</Text>
                </Text>
                {selectedLead.nextFollowUpAt && (
                  <Text style={styles.detailLine}>
                    Next follow‑up:{' '}
                    {new Date(selectedLead.nextFollowUpAt).toLocaleString()}
                  </Text>
                )}

                <View style={styles.logsSection}>
                  <Text style={styles.logsTitle}>Conversation log</Text>
                  <ScrollView style={styles.logsList}>
                    {selectedLead.discussionLogs && selectedLead.discussionLogs.length > 0 ? (
                      selectedLead.discussionLogs
                        .slice()
                        .reverse()
                        .map((log, index) => (
                          <View key={index} style={styles.logItem}>
                            <Text style={styles.logDate}>
                              {new Date(log.at).toLocaleString()} – {log.by}
                            </Text>
                            <Text style={styles.logNotes}>{log.notes}</Text>
                            {log.nextFollowUpAt && (
                              <Text style={styles.logNext}>
                                Next: {new Date(log.nextFollowUpAt).toLocaleString()}
                              </Text>
                            )}
                          </View>
                        ))
                    ) : (
                      <Text style={styles.emptyLogText}>No discussions yet.</Text>
                    )}
                  </ScrollView>
                </View>

                <View style={styles.addLogSection}>
                  <Text style={styles.label}>Add discussion</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Notes from call / visit"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={2}
                    value={logText}
                    onChangeText={setLogText}
                  />
                  <Text style={styles.labelSmall}>Next follow‑up (optional, ISO or leave blank)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 2026-02-20T10:00:00"
                    placeholderTextColor="#9CA3AF"
                    value={logNextDate}
                    onChangeText={setLogNextDate}
                  />
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnPrimary]}
                    onPress={handleAddLog}
                    disabled={addingLog}
                  >
                    {addingLog ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.modalBtnPrimaryText}>Save log</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <ActivityIndicator size="large" color="#007AFF" />
            )}

            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnCancel, { marginTop: 12 }]}
              onPress={() => setDetailModalVisible(false)}
            >
              <Text style={styles.modalBtnCancelText}>Close</Text>
            </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  listContent: {
    padding: 14,
    paddingBottom: 40,
  },
  leadCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  leadName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  leadPhone: {
    fontSize: 13,
    color: '#4B5563',
  },
  leadAddress: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  leadMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  leadMeta: {
    fontSize: 11,
    color: '#6B7280',
  },
  leadMetaBold: {
    fontWeight: '600',
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
    backgroundColor: 'rgba(0,0,0,0.45)',
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
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  labelSmall: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
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
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#F3F4F6',
  },
  modalBtnCancelText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  modalBtnPrimary: {
    backgroundColor: '#0EA5E9',
  },
  modalBtnPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  detailLine: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 4,
  },
  logsSection: {
    marginTop: 8,
  },
  logsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  logsList: {
    maxHeight: 180,
  },
  logItem: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  logDate: {
    fontSize: 11,
    color: '#6B7280',
  },
  logNotes: {
    fontSize: 13,
    color: '#111827',
  },
  logNext: {
    fontSize: 11,
    color: '#4B5563',
  },
  emptyLogText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  addLogSection: {
    marginTop: 10,
  },
});

