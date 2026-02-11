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

const JOB_STATUS_OPTIONS = [
  'New Lead',
  'Confirmed',
  'Assigned',
  'In Progress',
  'Completed',
  'Cancelled',
] as const;

const PAYMENT_STATUS_OPTIONS = ['Pending', 'Received'] as const;

type Lead = {
  _id: string;
  customerName: string;
  mobileNumber: string;
  address?: string;
  area?: string;
  status: string;
  source?: string;
  latitude?: number;
  longitude?: number;
  whatsappNumber?: string;
  mapLink?: string;
  serviceType?: string;
  tankSizeLtr?: number;
  numberOfTanks?: number;
  quotedPrice?: number;
  finalPrice?: number;
  bookingDate?: string;
  timeSlot?: string;
  jobStatus?: (typeof JOB_STATUS_OPTIONS)[number];
  paymentStatus?: (typeof PAYMENT_STATUS_OPTIONS)[number];
  paymentMode?: string;
  notes?: string;
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
  const [staff, setStaff] = useState<any[]>([]);
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
    whatsappNumber: '',
    address: '',
    area: '',
    latitude: '',
    longitude: '',
    mapLink: '',
    serviceType: 'Water Tank',
    tankSizeLtr: '',
    numberOfTanks: '',
    quotedPrice: '',
    finalPrice: '',
    bookingDate: '',
    timeSlot: '',
    jobStatus: 'New Lead' as (typeof JOB_STATUS_OPTIONS)[number],
    paymentStatus: 'Pending' as (typeof PAYMENT_STATUS_OPTIONS)[number],
    paymentMode: 'pending',
    notes: '',
    source: 'Direct Call',
  });

  const [logText, setLogText] = useState('');
  const [logNextDate, setLogNextDate] = useState('');
  const [addingLog, setAddingLog] = useState(false);
  const [creatingJobFromLead, setCreatingJobFromLead] = useState(false);
  const [detailJobStatus, setDetailJobStatus] = useState<(typeof JOB_STATUS_OPTIONS)[number]>('New Lead');
  const [detailPaymentStatus, setDetailPaymentStatus] = useState<(typeof PAYMENT_STATUS_OPTIONS)[number]>('Pending');
   const [selectedJobStaffIds, setSelectedJobStaffIds] = useState<string[]>([]);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterStatus !== 'All') params.status = filterStatus;
      const [leadsRes, staffRes] = await Promise.all([
        api.get<Lead[]>('/leads', { params }),
        api.get('/users?role=staff'),
      ]);
      setLeads(leadsRes.data);
      setStaff(Array.isArray(staffRes.data) ? staffRes.data : []);
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
      const payload: any = {
        customerName: name,
        mobileNumber: mobile,
        address: newLead.address.trim(),
        source: newLead.source || 'Direct Call',
      };

      const wa = newLead.whatsappNumber.replace(/\D/g, '').slice(0, 10);
      if (wa.length === 10) {
        payload.whatsappNumber = wa;
      }
      if (newLead.area.trim()) payload.area = newLead.area.trim();
      if (newLead.mapLink.trim()) payload.mapLink = newLead.mapLink.trim();
      if (newLead.serviceType.trim()) payload.serviceType = newLead.serviceType.trim();
      if (newLead.tankSizeLtr) payload.tankSizeLtr = Number(newLead.tankSizeLtr) || 0;
      if (newLead.numberOfTanks) payload.numberOfTanks = Number(newLead.numberOfTanks) || 0;
      if (newLead.quotedPrice) payload.quotedPrice = Number(newLead.quotedPrice) || 0;
      if (newLead.finalPrice) payload.finalPrice = Number(newLead.finalPrice) || 0;
      if (newLead.bookingDate.trim()) payload.bookingDate = newLead.bookingDate.trim();
      if (newLead.timeSlot.trim()) payload.timeSlot = newLead.timeSlot.trim();
      if (newLead.jobStatus) payload.jobStatus = newLead.jobStatus;
      if (newLead.paymentStatus) payload.paymentStatus = newLead.paymentStatus;
      if (newLead.paymentMode.trim()) payload.paymentMode = newLead.paymentMode.trim();
      if (newLead.notes.trim()) payload.notes = newLead.notes.trim();

      // Optional manual latitude/longitude for precise map location
      const latVal = newLead.latitude.trim();
      const lngVal = newLead.longitude.trim();
      if (latVal && lngVal) {
        const latNum = Number(latVal);
        const lngNum = Number(lngVal);
        if (!Number.isNaN(latNum) && !Number.isNaN(lngNum)) {
          payload.latitude = latNum;
          payload.longitude = lngNum;
        }
      }

      const res = await api.post<Lead>('/leads', payload);
      setCreateModalVisible(false);
      setNewLead({
        customerName: '',
        mobileNumber: '',
        whatsappNumber: '',
        address: '',
        area: '',
        latitude: '',
        longitude: '',
        mapLink: '',
        serviceType: 'Water Tank',
        tankSizeLtr: '',
        numberOfTanks: '',
        quotedPrice: '',
        finalPrice: '',
        bookingDate: '',
        timeSlot: '',
        paymentStatus: 'pending',
        paymentMode: 'pending',
        notes: '',
        source: 'Direct Call',
      });
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
      setDetailJobStatus((res.data.jobStatus as any) || 'New Lead');
      setDetailPaymentStatus((res.data.paymentStatus as any) || 'Pending');
      setSelectedJobStaffIds([]);
      setDetailModalVisible(true);
    } catch (err: any) {
      console.error('Load lead detail error', err.response?.data || err.message);
      Alert.alert('Error', 'Failed to load lead details');
    }
  };

  const handleUpdateLeadStatus = async () => {
    if (!selectedLead) return;
    try {
      await api.put<Lead>(`/leads/${selectedLead._id}`, {
        jobStatus: detailJobStatus,
        paymentStatus: detailPaymentStatus,
      });
      Alert.alert('Updated', 'Lead status updated');
      loadLeads();
    } catch (err: any) {
      console.error('Update lead status error', err.response?.data || err.message);
      Alert.alert('Error', err.response?.data?.message || 'Failed to update lead status');
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

  const handleCreateJobFromLead = async () => {
    if (!selectedLead) return;
    if (selectedJobStaffIds.length === 0) {
      Alert.alert(
        'Assign staff first',
        'Please select at least one staff member for this job before converting the lead.'
      );
      return;
    }
    setCreatingJobFromLead(true);
    try {
      // Default fallback location (same as Jobs screen)
      const DEFAULT_LAT = 26.1775;
      const DEFAULT_LNG = 85.8714;

      const addressFromLead =
        (selectedLead.address && selectedLead.address.trim()) ||
        (selectedLead.area && selectedLead.area.trim()) ||
        'Address from lead';

      // Lead me agar latitude/longitude hai to use karenge, warna default center
      let latFromLead = (selectedLead as any).latitude as number | null | undefined;
      let lngFromLead = (selectedLead as any).longitude as number | null | undefined;

      const payload: any = {
        customerName: selectedLead.customerName,
        mobileNumber: selectedLead.mobileNumber,
        address: addressFromLead,
        tankSize: '500L',
        serviceType: 'Water Tank',
        leadSource: selectedLead.source || 'Lead',
        serviceCharge: 0,
        paymentMode: 'pending',
        assignedStaff: selectedJobStaffIds,
        notes: `Job created from lead ${selectedLead._id}`,
      };
      const lat = latFromLead ?? DEFAULT_LAT;
      const lng = lngFromLead ?? DEFAULT_LNG;
      payload.latitude = lat;
      payload.longitude = lng;
      payload.targetLatitude = lat;
      payload.targetLongitude = lng;
      await api.post('/jobs', payload);
      Alert.alert('Done', 'Job created from this lead. Go to Jobs tab to assign staff & schedule.');
    } catch (err: any) {
      console.error('Create job from lead error', err.response?.data || err.message);
      Alert.alert('Error', err.response?.data?.message || 'Failed to create job from lead');
    } finally {
      setCreatingJobFromLead(false);
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
        <View style={{ flex: 1 }}>
          <Text style={styles.leadMeta}>
            Source: <Text style={styles.leadMetaBold}>{item.source || 'Direct Call'}</Text>
          </Text>
          {item.jobStatus && (
            <Text style={styles.leadMeta}>
              Job: <Text style={styles.leadMetaBold}>{item.jobStatus}</Text>
            </Text>
          )}
          {item.paymentStatus && (
            <Text style={styles.leadMeta}>
              Payment: <Text style={styles.leadMetaBold}>{item.paymentStatus}</Text>
            </Text>
          )}
        </View>
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
            <ScrollView
              style={{ maxHeight: 480 }}
              showsVerticalScrollIndicator={false}
            >
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

              <Text style={styles.label}>WhatsApp (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="10 digit WhatsApp number"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                maxLength={10}
                value={newLead.whatsappNumber}
                onChangeText={(t) =>
                  setNewLead({
                    ...newLead,
                    whatsappNumber: t.replace(/\D/g, '').slice(0, 10),
                  })
                }
              />

              <Text style={styles.label}>Area / Locality</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Labagh / Mithanpura"
                placeholderTextColor="#9CA3AF"
                value={newLead.area}
                onChangeText={(t) => setNewLead({ ...newLead, area: t })}
              />

              <Text style={styles.label}>Latitude (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 26.1775"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={newLead.latitude}
                onChangeText={(t) => setNewLead({ ...newLead, latitude: t })}
              />

              <Text style={styles.label}>Longitude (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 85.8714"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={newLead.longitude}
                onChangeText={(t) => setNewLead({ ...newLead, longitude: t })}
              />

              <Text style={styles.label}>Map Link (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Google Maps URL"
                placeholderTextColor="#9CA3AF"
                value={newLead.mapLink}
                onChangeText={(t) => setNewLead({ ...newLead, mapLink: t })}
              />

              <View style={styles.row2}>
                <View style={styles.col2}>
                  <Text style={styles.label}>Service Type</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Water Tank"
                    placeholderTextColor="#9CA3AF"
                    value={newLead.serviceType}
                    onChangeText={(t) => setNewLead({ ...newLead, serviceType: t })}
                  />
                </View>
                <View style={styles.spacer2} />
                <View style={styles.col2}>
                  <Text style={styles.label}>Tank Size (Ltr)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 1000"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={newLead.tankSizeLtr}
                    onChangeText={(t) => setNewLead({ ...newLead, tankSizeLtr: t })}
                  />
                </View>
              </View>

              <View style={styles.row2}>
                <View style={styles.col2}>
                  <Text style={styles.label}>No of Tank</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 2"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={newLead.numberOfTanks}
                    onChangeText={(t) => setNewLead({ ...newLead, numberOfTanks: t })}
                  />
                </View>
                <View style={styles.spacer2} />
                <View style={styles.col2}>
                  <Text style={styles.label}>Quoted Price (₹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 800"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={newLead.quotedPrice}
                    onChangeText={(t) => setNewLead({ ...newLead, quotedPrice: t })}
                  />
                </View>
              </View>

              <View style={styles.row2}>
                <View style={styles.col2}>
                  <Text style={styles.label}>Final Price (₹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 700"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={newLead.finalPrice}
                    onChangeText={(t) => setNewLead({ ...newLead, finalPrice: t })}
                  />
                </View>
                <View style={styles.spacer2} />
                <View style={styles.col2}>
                  <Text style={styles.label}>Booking Date (optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 2026-02-20"
                    placeholderTextColor="#9CA3AF"
                    value={newLead.bookingDate}
                    onChangeText={(t) => setNewLead({ ...newLead, bookingDate: t })}
                  />
                </View>
              </View>

              <Text style={styles.label}>Time Slot (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 10:00 AM – 12:00 PM"
                placeholderTextColor="#9CA3AF"
                value={newLead.timeSlot}
                onChangeText={(t) => setNewLead({ ...newLead, timeSlot: t })}
              />

              <View style={styles.row2}>
                <View style={styles.col2}>
                  <Text style={styles.label}>Payment Status</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="pending / paid"
                    placeholderTextColor="#9CA3AF"
                    value={newLead.paymentStatus}
                    onChangeText={(t) => setNewLead({ ...newLead, paymentStatus: t })}
                  />
                </View>
                <View style={styles.spacer2} />
                <View style={styles.col2}>
                  <Text style={styles.label}>Payment Mode</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="cash / upi / online"
                    placeholderTextColor="#9CA3AF"
                    value={newLead.paymentMode}
                    onChangeText={(t) => setNewLead({ ...newLead, paymentMode: t })}
                  />
                </View>
              </View>

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Short note for this enquiry"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={2}
                value={newLead.notes}
                onChangeText={(t) => setNewLead({ ...newLead, notes: t })}
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
            </ScrollView>
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
              <ScrollView
                style={{ maxHeight: 520 }}
                showsVerticalScrollIndicator={false}
              >
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
                <Text style={styles.detailLine}>
                  Job status:{' '}
                  <Text style={styles.leadMetaBold}>{detailJobStatus}</Text>
                </Text>
                <Text style={styles.detailLine}>
                  Payment status:{' '}
                  <Text style={styles.leadMetaBold}>{detailPaymentStatus}</Text>
                </Text>
                {selectedLead.nextFollowUpAt && (
                  <Text style={styles.detailLine}>
                    Next follow‑up:{' '}
                    {new Date(selectedLead.nextFollowUpAt).toLocaleString()}
                  </Text>
                )}

                <View style={styles.statusPillsRow}>
                  {JOB_STATUS_OPTIONS.map((st) => {
                    const active = detailJobStatus === st;
                    return (
                      <TouchableOpacity
                        key={st}
                        style={[
                          styles.statusPill,
                          active && styles.statusPillActive,
                        ]}
                        onPress={() => setDetailJobStatus(st)}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            active && styles.statusPillTextActive,
                          ]}
                        >
                          {st}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.statusPillsRow}>
                  {PAYMENT_STATUS_OPTIONS.map((st) => {
                    const active = detailPaymentStatus === st;
                    return (
                      <TouchableOpacity
                        key={st}
                        style={[
                          styles.statusPill,
                          active && styles.statusPillActive,
                        ]}
                        onPress={() => setDetailPaymentStatus(st)}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            active && styles.statusPillTextActive,
                          ]}
                        >
                          {st}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnPrimary, { marginTop: 4 }]}
                  onPress={handleUpdateLeadStatus}
                >
                  <Text style={styles.modalBtnPrimaryText}>Update status</Text>
                </TouchableOpacity>

                {/* Assign staff for job created from this lead */}
                <View style={styles.addLogSection}>
                  <Text style={styles.labelSmall}>Assign staff for this job</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 6 }}
                  >
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {(staff.filter((s) => s.isActive !== false) || []).map((s) => {
                        const id = s._id;
                        const active = selectedJobStaffIds.includes(id);
                        return (
                          <TouchableOpacity
                            key={id}
                            style={[
                              styles.statusPill,
                              active && styles.statusPillActive,
                            ]}
                            onPress={() => {
                              if (active) {
                                setSelectedJobStaffIds(
                                  selectedJobStaffIds.filter((x) => x !== id)
                                );
                              } else {
                                setSelectedJobStaffIds([...selectedJobStaffIds, id]);
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.statusPillText,
                                active && styles.statusPillTextActive,
                              ]}
                            >
                              {s.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>

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
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.convertBtn]}
                    onPress={handleCreateJobFromLead}
                    disabled={creatingJobFromLead}
                  >
                    {creatingJobFromLead ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.convertBtnText}>✅ Convert to job</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
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
  row2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  col2: {
    flex: 1,
  },
  spacer2: {
    width: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 4,
  },
  modalBtnCancel: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalBtnCancelText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  modalBtnPrimary: {
    backgroundColor: '#0284c7',
  },
  modalBtnPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  convertBtn: {
    backgroundColor: '#16a34a',
    borderWidth: 0,
    borderColor: 'transparent',
    marginTop: 10,
  },
  convertBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
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
  statusPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f9fafb',
  },
  statusPillActive: {
    borderColor: '#0ea5e9',
    backgroundColor: '#e0f2fe',
  },
  statusPillText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  statusPillTextActive: {
    color: '#0369a1',
    fontWeight: '600',
  },
});

