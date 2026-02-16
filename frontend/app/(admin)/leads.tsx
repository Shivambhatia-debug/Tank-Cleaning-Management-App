import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../../components/AppHeader';
import DropdownPicker from '../../components/DropdownPicker';
import CalendarPicker from '../../components/CalendarPicker';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';

const FONT_REGULAR = Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'System' });
const FONT_MEDIUM = Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: 'System' });
const { height: WINDOW_HEIGHT } = Dimensions.get('window');

const SOURCE_OPTIONS = ['Direct Call', 'WhatsApp', 'Facebook', 'Instagram', 'Google', 'Referral', 'Walk-in', 'JustDial', 'Other'];
const SERVICE_TYPE_OPTIONS = ['Water Tank', 'Sump Cleaning', 'Overhead Tank', 'Underground Tank', 'RO Tank', 'Aquarium Tank', 'Septic Tank', 'Swimming Pool', 'Other'];
const TANK_SIZE_OPTIONS = ['200', '500', '750', '1000', '1500', '2000', '3000', '5000', '10000'];
const TIME_SLOT_OPTIONS = ['8:00 AM – 10:00 AM', '10:00 AM – 12:00 PM', '12:00 PM – 2:00 PM', '2:00 PM – 4:00 PM', '4:00 PM – 6:00 PM', '6:00 PM – 8:00 PM'];
const PAYMENT_MODE_OPTIONS = ['Pending', 'Cash', 'UPI', 'Online', 'Card'];

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
  firstJobId?: string;
  discussionLogs?: {
    at: string;
    by: string;
    notes: string;
    nextFollowUpAt?: string;
  }[];
};

const STATUS_OPTIONS = ['All', 'New', 'Follow-up', 'Confirmed', 'Cancelled', 'Converted'] as const;
const LEAD_STATUS_EDIT_OPTIONS = ['New', 'Follow-up', 'Confirmed', 'Cancelled', 'Converted'];

export default function LeadsScreen() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [services, setServices] = useState<{ name: string; startingPrice: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<(typeof STATUS_OPTIONS)[number]>('All');

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [jobsForLeads, setJobsForLeads] = useState<any[]>([]);

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
  const [logQuotedPrice, setLogQuotedPrice] = useState('');
  const [logFinalPrice, setLogFinalPrice] = useState('');
  const [addingLog, setAddingLog] = useState(false);
  const [creatingJobFromLead, setCreatingJobFromLead] = useState(false);
  const [detailJobStatus, setDetailJobStatus] = useState<(typeof JOB_STATUS_OPTIONS)[number]>('New Lead');
  const [detailPaymentStatus, setDetailPaymentStatus] = useState<(typeof PAYMENT_STATUS_OPTIONS)[number]>('Pending');
  const [detailLat, setDetailLat] = useState('');
  const [detailLng, setDetailLng] = useState('');
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [selectedJobStaffIds, setSelectedJobStaffIds] = useState<string[]>([]);
  const [editLeadMode, setEditLeadMode] = useState(false);
  const [editLeadForm, setEditLeadForm] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterStatus !== 'All') params.status = filterStatus;
      const [leadsRes, staffRes, servicesRes, jobsRes] = await Promise.all([
        api.get<Lead[]>('/leads', { params }),
        api.get('/users?role=staff'),
        api.get('/services').catch(() => ({ data: [] })),
        api.get('/jobs').catch(() => ({ data: [] })),
      ]);
      setLeads(leadsRes.data);
      setStaff(Array.isArray(staffRes.data) ? staffRes.data : []);
      setServices(Array.isArray(servicesRes.data) ? servicesRes.data : []);
      setJobsForLeads(Array.isArray(jobsRes.data) ? jobsRes.data : []);
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
        jobStatus: 'New Lead',
        paymentStatus: 'Pending',
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
      const d = res.data;
      setSelectedLead(d);
      setDetailJobStatus((d.jobStatus as any) || 'New Lead');
      setDetailPaymentStatus((d.paymentStatus as any) || 'Pending');
      const lat = (d as any).latitude;
      const lng = (d as any).longitude;
      setDetailLat(lat != null && !Number.isNaN(lat) ? String(lat) : '');
      setDetailLng(lng != null && !Number.isNaN(lng) ? String(lng) : '');
      setSelectedJobStaffIds([]);
      setEditLeadMode(false);
      setEditLeadForm({
        customerName: d.customerName || '',
        mobileNumber: d.mobileNumber || '',
        address: (d as any).address || '',
        area: (d as any).area || '',
        source: (d as any).source || 'Direct Call',
        whatsappNumber: (d as any).whatsappNumber || '',
        serviceType: (d as any).serviceType || 'Water Tank',
        tankSizeLtr: (d as any).tankSizeLtr != null ? String((d as any).tankSizeLtr) : '',
        numberOfTanks: (d as any).numberOfTanks != null ? String((d as any).numberOfTanks) : '',
        quotedPrice: (d as any).quotedPrice != null ? String((d as any).quotedPrice) : '',
        finalPrice: (d as any).finalPrice != null ? String((d as any).finalPrice) : '',
        bookingDate: (d as any).bookingDate ? (typeof (d as any).bookingDate === 'string' ? (d as any).bookingDate.slice(0, 10) : new Date((d as any).bookingDate).toISOString().slice(0, 10)) : '',
        timeSlot: (d as any).timeSlot || '',
        status: (d as any).status || 'New',
        jobStatus: (d as any).jobStatus || 'New Lead',
        paymentStatus: (d as any).paymentStatus || 'Pending',
        paymentMode: (d as any).paymentMode || 'pending',
        notes: (d as any).notes || '',
      });
      setLogQuotedPrice('');
      setLogFinalPrice('');
      setDetailModalVisible(true);
    } catch (err: any) {
      console.error('Load lead detail error', err.response?.data || err.message);
      Alert.alert('Error', 'Failed to load lead details');
    }
  };

  const handleUpdateLeadLocation = async () => {
    if (!selectedLead) return;
    const latStr = detailLat.trim();
    const lngStr = detailLng.trim();
    if (!latStr || !lngStr) {
      Alert.alert('Missing', 'Latitude aur Longitude dono bharo');
      return;
    }
    const latNum = Number(latStr);
    const lngNum = Number(lngStr);
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      Alert.alert('Invalid', 'Sahi number daalo (e.g. 26.1775, 85.8714)');
      return;
    }
    setUpdatingLocation(true);
    try {
      const res = await api.put<Lead>(`/leads/${selectedLead._id}`, {
        latitude: latNum,
        longitude: lngNum,
      });
      setSelectedLead(res.data);
      Alert.alert('Saved', 'Location update ho gaya. Ab Convert to job pe ye coords use honge.');
    } catch (err: any) {
      console.error('Update lead location error', err.response?.data || err.message);
      Alert.alert('Error', err.response?.data?.message || 'Location update fail');
    } finally {
      setUpdatingLocation(false);
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

  const handleSaveEditLead = async () => {
    if (!selectedLead) return;
    const name = (editLeadForm.customerName || '').trim();
    const mobile = (editLeadForm.mobileNumber || '').replace(/\D/g, '').slice(0, 10);
    if (!name || !mobile) {
      Alert.alert('Missing info', 'Customer name and 10 digit mobile are required');
      return;
    }
    if (mobile.length !== 10) {
      Alert.alert('Invalid mobile', 'Enter exactly 10 digit mobile number');
      return;
    }
    setSavingEdit(true);
    try {
      const payload: any = {
        customerName: name,
        mobileNumber: mobile,
        address: (editLeadForm.address || '').trim(),
        source: editLeadForm.source || 'Direct Call',
        area: (editLeadForm.area || '').trim(),
        whatsappNumber: (editLeadForm.whatsappNumber || '').replace(/\D/g, '').slice(0, 10) || undefined,
        serviceType: (editLeadForm.serviceType || '').trim() || undefined,
        tankSizeLtr: editLeadForm.tankSizeLtr ? Number(editLeadForm.tankSizeLtr) || 0 : undefined,
        numberOfTanks: editLeadForm.numberOfTanks ? Number(editLeadForm.numberOfTanks) || 0 : undefined,
        quotedPrice: editLeadForm.quotedPrice ? Number(editLeadForm.quotedPrice) || 0 : undefined,
        finalPrice: editLeadForm.finalPrice ? Number(editLeadForm.finalPrice) || 0 : undefined,
        bookingDate: editLeadForm.bookingDate || undefined,
        timeSlot: (editLeadForm.timeSlot || '').trim() || undefined,
        status: (editLeadForm.status || 'New').trim(),
        jobStatus: (editLeadForm.jobStatus || 'New Lead').trim(),
        paymentStatus: (editLeadForm.paymentStatus || 'Pending').trim(),
        paymentMode: (editLeadForm.paymentMode || 'pending').trim(),
        notes: (editLeadForm.notes || '').trim() || undefined,
      };
      const res = await api.put<Lead>(`/leads/${selectedLead._id}`, payload);
      setSelectedLead(res.data);
      setDetailJobStatus((res.data.jobStatus as any) || 'New Lead');
      setDetailPaymentStatus((res.data.paymentStatus as any) || 'Pending');
      setEditLeadMode(false);
      loadLeads();
      Alert.alert('Saved', 'Lead details updated.');
    } catch (err: any) {
      console.error('Edit lead error', err.response?.data || err.message);
      Alert.alert('Error', err.response?.data?.message || 'Failed to update lead');
    } finally {
      setSavingEdit(false);
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
      const quotedNum = logQuotedPrice.trim() ? Number(logQuotedPrice) : null;
      const finalNum = logFinalPrice.trim() ? Number(logFinalPrice) : null;
      const priceUpdates: any = {};
      if (quotedNum != null && !Number.isNaN(quotedNum)) priceUpdates.quotedPrice = quotedNum;
      if (finalNum != null && !Number.isNaN(finalNum)) priceUpdates.finalPrice = finalNum;
      if (Object.keys(priceUpdates).length > 0) {
        await api.put(`/leads/${selectedLead._id}`, priceUpdates);
      }
      const payload: any = { notes };
      if (logNextDate) payload.nextFollowUpAt = logNextDate;
      const res = await api.post<Lead>(`/leads/${selectedLead._id}/logs`, payload);
      setSelectedLead(res.data);
      setLogText('');
      setLogNextDate('');
      setLogQuotedPrice('');
      setLogFinalPrice('');
      if (quotedNum != null || finalNum != null) loadLeads();
    } catch (err: any) {
      console.error('Add log error', err.response?.data || err.message);
      Alert.alert('Error', err.response?.data?.message || 'Failed to add log');
    } finally {
      setAddingLog(false);
    }
  };

  const handleDeleteLead = () => {
    if (!selectedLead) return;
    const name = selectedLead.customerName || 'this lead';
    Alert.alert(
      'Delete lead',
      `Delete "${name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/leads/${selectedLead._id}`);
              setDetailModalVisible(false);
              setSelectedLead(null);
              loadLeads();
              Alert.alert('Done', 'Lead deleted.');
            } catch (err: any) {
              const msg = err.response?.data?.message || err.message || 'Failed to delete lead';
              Alert.alert('Error', msg);
              if (err.response?.status === 404) {
                setDetailModalVisible(false);
                loadLeads();
              }
            }
          },
        },
      ]
    );
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

      const tankCount = selectedLead.numberOfTanks ?? 1;
      const firstStaffId = selectedJobStaffIds[0];
      if (!firstStaffId) return;
      const firstStaff = staff.find((s: any) => s._id === firstStaffId);
      const perTank = Number(firstStaff?.perTankIncentive) || 0;
      const perJob = Number(firstStaff?.defaultPerJobIncentive ?? firstStaff?.default_per_job_incentive) || 0;
      const incentivePerJob = Math.round(tankCount * perTank + perJob);

      const serviceCharge = selectedLead.finalPrice ?? selectedLead.quotedPrice ?? 0;
      const payload: any = {
        customerName: selectedLead.customerName,
        mobileNumber: selectedLead.mobileNumber,
        address: addressFromLead,
        tankSize: selectedLead.tankSizeLtr ? `${selectedLead.tankSizeLtr}L` : '500L',
        tankCount,
        serviceType: selectedLead.serviceType || 'Water Tank',
        leadSource: selectedLead.source || 'Lead',
        serviceCharge: Number(serviceCharge) || 0,
        incentivePerJob,
        paymentMode: 'pending',
        assignedStaff: [firstStaffId],
        notes: `Job created from lead ${selectedLead._id}`,
      };
      const lat = latFromLead ?? DEFAULT_LAT;
      const lng = lngFromLead ?? DEFAULT_LNG;
      payload.latitude = lat;
      payload.longitude = lng;
      payload.targetLatitude = lat;
      payload.targetLongitude = lng;
      const jobRes = await api.post('/jobs', payload);
      const createdJobId = jobRes.data?.jobId || jobRes.data?.job?._id;

      const sixMonthsLater = new Date();
      sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
      try {
        await api.put(`/leads/${selectedLead._id}`, {
          status: 'Follow-up',
          jobStatus: 'In Progress',
          nextFollowUpAt: sixMonthsLater.toISOString(),
          firstJobId: createdJobId,
        });
        // Also add a discussion log about the conversion
        await api.post(`/leads/${selectedLead._id}/logs`, {
          notes: `Lead converted to job. Staff assigned. Next service follow-up in 6 months.`,
          nextFollowUpAt: sixMonthsLater.toISOString(),
        });
      } catch (updateErr) {
        console.warn('Could not auto-update lead status after conversion', updateErr);
      }

      setDetailModalVisible(false);
      setSelectedLead(null);
      loadLeads();
      Alert.alert('Done', 'Job created! Lead moved to Follow-up with 6-month reminder.');
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredLeads.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No leads yet. Add your first lead.</Text>
          </View>
        ) : (
          filteredLeads.map((item) => (
            <View key={item._id}>{renderLead({ item })}</View>
          ))
        )}
      </ScrollView>

      {/* Create lead modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
        statusBarTranslucent
        style={{ margin: 0 }}
      >
        <SafeAreaView style={[styles.fullScreenModal, { minHeight: WINDOW_HEIGHT }]} edges={['top']}>
          <View style={styles.createModalBody}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={styles.modalBackBtn}>
                <Ionicons name="arrow-back" size={24} color="#0f172a" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>New Lead</Text>
              <View style={{ width: 40 }} />
            </View>
            <ScrollView
              style={styles.createScrollView}
              contentContainerStyle={styles.createScrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
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

              <DropdownPicker
                label="Source"
                placeholder="Select source"
                value={newLead.source}
                options={SOURCE_OPTIONS}
                onSelect={(v) => setNewLead({ ...newLead, source: v })}
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
                  <DropdownPicker
                    label="Service Type"
                    placeholder="Select type"
                    value={newLead.serviceType}
                    options={SERVICE_TYPE_OPTIONS}
                    onSelect={(v) => setNewLead({ ...newLead, serviceType: v })}
                  />
                </View>
                <View style={styles.spacer2} />
                <View style={styles.col2}>
                  <DropdownPicker
                    label="Tank Size (Ltr)"
                    placeholder="Select size"
                    value={newLead.tankSizeLtr}
                    options={TANK_SIZE_OPTIONS}
                    onSelect={(v) => setNewLead({ ...newLead, tankSizeLtr: v })}
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
                  <CalendarPicker
                    label="Booking Date"
                    placeholder="Select date"
                    value={newLead.bookingDate}
                    onChange={(d) => setNewLead({ ...newLead, bookingDate: d })}
                  />
                </View>
              </View>

              <DropdownPicker
                label="Time Slot (optional)"
                placeholder="Select time slot"
                value={newLead.timeSlot}
                options={TIME_SLOT_OPTIONS}
                onSelect={(v) => setNewLead({ ...newLead, timeSlot: v })}
              />

              <View style={styles.row2}>
                <View style={styles.col2}>
                  <DropdownPicker
                    label="Payment Status"
                    placeholder="Select"
                    value={newLead.paymentStatus as string}
                    options={[...PAYMENT_STATUS_OPTIONS]}
                    onSelect={(v) => setNewLead({ ...newLead, paymentStatus: v as any })}
                  />
                </View>
                <View style={styles.spacer2} />
                <View style={styles.col2}>
                  <DropdownPicker
                    label="Payment Mode"
                    placeholder="Select mode"
                    value={newLead.paymentMode}
                    options={PAYMENT_MODE_OPTIONS}
                    onSelect={(v) => setNewLead({ ...newLead, paymentMode: v })}
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
        </SafeAreaView>
      </Modal>

      {/* Lead detail + discussion log */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
        statusBarTranslucent
        style={{ margin: 0 }}
      >
        <SafeAreaView style={[styles.fullScreenModal, { minHeight: WINDOW_HEIGHT }]} edges={['top']}>
          <View style={styles.detailModalBody}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={styles.modalBackBtn}>
                <Ionicons name="arrow-back" size={24} color="#0f172a" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Lead Details</Text>
              <View style={{ width: 40 }} />
            </View>
            {selectedLead ? (
              <ScrollView
                style={styles.detailScrollView}
                contentContainerStyle={styles.detailScrollContent}
                showsVerticalScrollIndicator={true}
                bounces={true}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="always"
                overScrollMode="always"
                keyboardDismissMode="on-drag"
              >
                <View style={styles.detailHeaderRow}>
                  <Text style={styles.detailHeaderName} numberOfLines={1}>{selectedLead.customerName}</Text>
                  <TouchableOpacity
                    style={[styles.editLeadBtn, editLeadMode && styles.editLeadBtnActive]}
                    onPress={() => setEditLeadMode(!editLeadMode)}
                  >
                    <Ionicons name={editLeadMode ? 'close' : 'create-outline'} size={16} color={editLeadMode ? '#fff' : '#64748b'} />
                    <Text style={[styles.editLeadBtnText, editLeadMode && { color: '#fff' }]}>{editLeadMode ? 'Cancel' : 'Edit'}</Text>
                  </TouchableOpacity>
                </View>

                {editLeadMode ? (
                  <View style={styles.addLogSection}>
                    <Text style={styles.label}>Customer name *</Text>
                    <TextInput style={styles.input} placeholder="Full name" placeholderTextColor="#9CA3AF" value={editLeadForm.customerName} onChangeText={(t) => setEditLeadForm({ ...editLeadForm, customerName: t })} />
                    <Text style={styles.label}>Mobile *</Text>
                    <TextInput style={styles.input} placeholder="10 digit" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" maxLength={10} value={editLeadForm.mobileNumber} onChangeText={(t) => setEditLeadForm({ ...editLeadForm, mobileNumber: t.replace(/\D/g, '').slice(0, 10) })} />
                    <Text style={styles.label}>WhatsApp number</Text>
                    <TextInput style={styles.input} placeholder="10 digit" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" maxLength={10} value={editLeadForm.whatsappNumber} onChangeText={(t) => setEditLeadForm({ ...editLeadForm, whatsappNumber: t.replace(/\D/g, '').slice(0, 10) })} />
                    <Text style={styles.label}>Address</Text>
                    <TextInput style={[styles.input, styles.textArea]} placeholder="Address" placeholderTextColor="#9CA3AF" multiline numberOfLines={2} value={editLeadForm.address} onChangeText={(t) => setEditLeadForm({ ...editLeadForm, address: t })} />
                    <DropdownPicker label="Source" placeholder="Select" value={editLeadForm.source} options={SOURCE_OPTIONS} onSelect={(v) => setEditLeadForm({ ...editLeadForm, source: v })} />
                    <Text style={styles.label}>Area</Text>
                    <TextInput style={styles.input} placeholder="Area" placeholderTextColor="#9CA3AF" value={editLeadForm.area} onChangeText={(t) => setEditLeadForm({ ...editLeadForm, area: t })} />
                    <View style={styles.row2}>
                      <View style={styles.col2}>
                        <Text style={styles.label}>Quoted (₹)</Text>
                        <TextInput style={styles.input} placeholder="e.g. 800" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={editLeadForm.quotedPrice} onChangeText={(t) => setEditLeadForm({ ...editLeadForm, quotedPrice: t })} />
                      </View>
                      <View style={styles.spacer2} />
                      <View style={styles.col2}>
                        <Text style={styles.label}>Final (₹)</Text>
                        <TextInput style={styles.input} placeholder="e.g. 700" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={editLeadForm.finalPrice} onChangeText={(t) => setEditLeadForm({ ...editLeadForm, finalPrice: t })} />
                      </View>
                    </View>
                    <DropdownPicker label="Service type" placeholder="Select" value={editLeadForm.serviceType} options={SERVICE_TYPE_OPTIONS} onSelect={(v) => setEditLeadForm({ ...editLeadForm, serviceType: v })} />
                    <View style={styles.row2}>
                      <View style={styles.col2}>
                        <Text style={styles.label}>Tank (Ltr)</Text>
                        <TextInput style={styles.input} placeholder="e.g. 500" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={editLeadForm.tankSizeLtr} onChangeText={(t) => setEditLeadForm({ ...editLeadForm, tankSizeLtr: t })} />
                      </View>
                      <View style={styles.spacer2} />
                      <View style={styles.col2}>
                        <Text style={styles.label}>Number of tanks</Text>
                        <TextInput style={styles.input} placeholder="e.g. 2" placeholderTextColor="#9CA3AF" keyboardType="numeric" value={editLeadForm.numberOfTanks} onChangeText={(t) => setEditLeadForm({ ...editLeadForm, numberOfTanks: t })} />
                      </View>
                    </View>
                    <View style={styles.row2}>
                      <View style={styles.col2}>
                        <CalendarPicker label="Booking date" placeholder="Date" value={editLeadForm.bookingDate} onChange={(d) => setEditLeadForm({ ...editLeadForm, bookingDate: d })} small />
                      </View>
                      <View style={styles.spacer2} />
                      <View style={styles.col2}>
                        <DropdownPicker label="Time slot" placeholder="Select" value={editLeadForm.timeSlot} options={TIME_SLOT_OPTIONS} onSelect={(v) => setEditLeadForm({ ...editLeadForm, timeSlot: v })} />
                      </View>
                    </View>
                    <DropdownPicker label="Lead status" placeholder="Select" value={editLeadForm.status} options={LEAD_STATUS_EDIT_OPTIONS} onSelect={(v) => setEditLeadForm({ ...editLeadForm, status: v })} />
                    <DropdownPicker label="Job status" placeholder="Select" value={editLeadForm.jobStatus} options={[...JOB_STATUS_OPTIONS]} onSelect={(v) => setEditLeadForm({ ...editLeadForm, jobStatus: v })} />
                    <DropdownPicker label="Payment status" placeholder="Select" value={editLeadForm.paymentStatus} options={[...PAYMENT_STATUS_OPTIONS]} onSelect={(v) => setEditLeadForm({ ...editLeadForm, paymentStatus: v })} />
                    <DropdownPicker label="Payment mode" placeholder="Select" value={editLeadForm.paymentMode} options={PAYMENT_MODE_OPTIONS} onSelect={(v) => setEditLeadForm({ ...editLeadForm, paymentMode: v })} />
                    <Text style={styles.label}>Notes</Text>
                    <TextInput style={[styles.input, styles.textArea]} placeholder="Notes" placeholderTextColor="#9CA3AF" multiline numberOfLines={2} value={editLeadForm.notes} onChangeText={(t) => setEditLeadForm({ ...editLeadForm, notes: t })} />
                    <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleSaveEditLead} disabled={savingEdit}>
                      {savingEdit ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnPrimaryText}>Save changes</Text>}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                <View style={styles.detailCard}>
                  <Text style={styles.detailCardTitle}>CUSTOMER INFORMATION</Text>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoLabel}>Name</Text>
                    <Text style={styles.detailInfoValue}>{selectedLead.customerName}</Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoLabel}>Mobile</Text>
                    <Text style={styles.detailInfoValue}>{selectedLead.mobileNumber}</Text>
                  </View>
                  {selectedLead.address ? (
                    <View style={styles.detailInfoRow}>
                      <Text style={styles.detailInfoLabel}>Address</Text>
                      <Text style={[styles.detailInfoValue, { flex: 1, textAlign: 'right' }]}>{selectedLead.address}</Text>
                    </View>
                  ) : null}
                  {(selectedLead as any).area ? (
                    <View style={styles.detailInfoRow}>
                      <Text style={styles.detailInfoLabel}>Area</Text>
                      <Text style={styles.detailInfoValue}>{(selectedLead as any).area}</Text>
                    </View>
                  ) : null}
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoLabel}>Source</Text>
                    <Text style={styles.detailInfoValue}>{selectedLead.source || 'Direct Call'}</Text>
                  </View>
                </View>

                <View style={styles.detailCard}>
                  <Text style={styles.detailCardTitle}>STATUS & PRICING</Text>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoLabel}>Lead Status</Text>
                    <Text style={[styles.detailInfoValue, { color: '#0EA5E9' }]}>{selectedLead.status}</Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoLabel}>Job Status</Text>
                    <Text style={styles.detailInfoValue}>{detailJobStatus}</Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoLabel}>Payment</Text>
                    <Text style={[styles.detailInfoValue, { color: detailPaymentStatus === 'Received' ? '#16a34a' : '#f59e0b' }]}>{detailPaymentStatus}</Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoLabel}>Quoted Price</Text>
                    <Text style={styles.detailInfoValue}>
                      {(selectedLead as any).quotedPrice != null && (selectedLead as any).quotedPrice !== '' ? `₹${Number((selectedLead as any).quotedPrice).toLocaleString('en-IN')}` : '—'}
                    </Text>
                  </View>
                  <View style={styles.detailInfoRow}>
                    <Text style={styles.detailInfoLabel}>Final Price</Text>
                    <Text style={[styles.detailInfoValue, { fontWeight: '700', color: '#16a34a' }]}>
                      {(selectedLead as any).finalPrice != null && (selectedLead as any).finalPrice !== '' ? `₹${Number((selectedLead as any).finalPrice).toLocaleString('en-IN')}` : '—'}
                    </Text>
                  </View>
                  {selectedLead.nextFollowUpAt && (
                    <View style={styles.detailInfoRow}>
                      <Text style={styles.detailInfoLabel}>Next Follow-up</Text>
                      <Text style={[styles.detailInfoValue, { color: '#f59e0b' }]}>{new Date(selectedLead.nextFollowUpAt).toLocaleDateString()}</Text>
                    </View>
                  )}
                </View>

                {/* Update Status Card */}
                <View style={styles.detailCard}>
                  <Text style={styles.detailCardTitle}>UPDATE STATUS</Text>
                  <Text style={[styles.labelSmall, { marginBottom: 6 }]}>Job Status</Text>
                  <View style={styles.statusPillsRow}>
                    {JOB_STATUS_OPTIONS.map((st) => {
                      const active = detailJobStatus === st;
                      return (
                        <TouchableOpacity
                          key={st}
                          style={[styles.statusPill, active && styles.statusPillActive]}
                          onPress={() => setDetailJobStatus(st)}
                        >
                          <Text style={[styles.statusPillText, active && styles.statusPillTextActive]}>{st}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={[styles.labelSmall, { marginTop: 10, marginBottom: 6 }]}>Payment Status</Text>
                  <View style={styles.statusPillsRow}>
                    {PAYMENT_STATUS_OPTIONS.map((st) => {
                      const active = detailPaymentStatus === st;
                      return (
                        <TouchableOpacity
                          key={st}
                          style={[styles.statusPill, active && styles.statusPillActive]}
                          onPress={() => setDetailPaymentStatus(st)}
                        >
                          <Text style={[styles.statusPillText, active && styles.statusPillTextActive]}>{st}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnPrimary, { marginTop: 10 }]}
                    onPress={handleUpdateLeadStatus}
                  >
                    <Text style={styles.modalBtnPrimaryText}>Update status</Text>
                  </TouchableOpacity>
                </View>

                {/* Convert to Job Card */}
                <View style={styles.detailCard}>
                  <Text style={styles.detailCardTitle}>CONVERT TO JOB</Text>

                  <View style={styles.row2}>
                    <View style={styles.col2}>
                      <Text style={styles.labelSmall}>Latitude</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. 26.1775"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        value={detailLat}
                        onChangeText={setDetailLat}
                      />
                    </View>
                    <View style={styles.spacer2} />
                    <View style={styles.col2}>
                      <Text style={styles.labelSmall}>Longitude</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. 85.8714"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        value={detailLng}
                        onChangeText={setDetailLng}
                      />
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: '#e0f2fe', borderWidth: 1, borderColor: '#7dd3fc' }]}
                    onPress={handleUpdateLeadLocation}
                    disabled={updatingLocation}
                  >
                    {updatingLocation ? (
                      <ActivityIndicator color="#0284c7" />
                    ) : (
                      <Text style={[styles.modalBtnPrimaryText, { color: '#0284c7' }]}>Save location</Text>
                    )}
                  </TouchableOpacity>

                  <Text style={[styles.labelSmall, { marginTop: 12, marginBottom: 6 }]}>Assign Staff (one only) – free staff only</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {(() => {
                        const ACTIVE_JOB_STATUSES = ['pending', 'on_the_way', 'in_progress'];
                        const busyStaffIds = Array.from(
                          new Set(
                            (jobsForLeads || [])
                              .filter((j: any) => ACTIVE_JOB_STATUSES.includes(j.status))
                              .flatMap((j: any) => (j.assignedStaff || []).map((s: any) => (s && (s._id || s)) ? String(s._id || s) : ''))
                              .filter(Boolean)
                          )
                        );
                        const freeStaff = (staff.filter((s) => s.isActive !== false) || []).filter((s) => !busyStaffIds.includes(s._id));
                        if (freeStaff.length === 0) {
                          return (
                            <Text style={{ color: '#64748b', fontSize: 13 }}>No free staff – all are on another job</Text>
                          );
                        }
                        return freeStaff.map((s) => {
                          const id = s._id;
                          const active = selectedJobStaffIds.includes(id);
                          return (
                            <TouchableOpacity
                              key={id}
                              style={[styles.statusPill, active && styles.statusPillActive]}
                              onPress={() => {
                                setSelectedJobStaffIds(active ? [] : [id]);
                              }}
                            >
                              <Text style={[styles.statusPillText, active && styles.statusPillTextActive]}>{s.name}</Text>
                            </TouchableOpacity>
                          );
                        });
                      })()}
                    </View>
                  </ScrollView>

                  {(selectedLead as any).firstJobId ? (
                    <View style={[styles.modalBtn, { backgroundColor: '#e0f2fe', borderWidth: 1, borderColor: '#7dd3fc' }]}>
                      <Text style={[styles.convertBtnText, { color: '#0369a1' }]}>Job already created from this lead</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.convertBtn]}
                      onPress={handleCreateJobFromLead}
                      disabled={creatingJobFromLead}
                    >
                      {creatingJobFromLead ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.convertBtnText}>✅ Convert to Job</Text>
                      )}
                    </TouchableOpacity>
                  )}
                  {!(selectedLead as any).firstJobId && (
                    <Text style={{ fontSize: 11, color: '#64748b', marginTop: 6, textAlign: 'center' }}>Lead will move to Follow-up with 6-month reminder</Text>
                  )}
                </View>

                {/* Conversation Log Card */}
                <View style={styles.detailCard}>
                  <Text style={styles.detailCardTitle}>CONVERSATION LOG</Text>
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
                              Next follow-up: {new Date(log.nextFollowUpAt).toLocaleDateString()}
                            </Text>
                          )}
                        </View>
                      ))
                  ) : (
                    <Text style={styles.emptyLogText}>No discussions yet.</Text>
                  )}
                </View>

                {/* Add Discussion Card */}
                <View style={styles.detailCard}>
                  <Text style={styles.detailCardTitle}>ADD DISCUSSION</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Notes from call / visit – price negotiated, etc."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={2}
                    value={logText}
                    onChangeText={setLogText}
                  />
                  <View style={styles.row2}>
                    <View style={styles.col2}>
                      <Text style={styles.labelSmall}>Quoted price (₹)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. 800"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        value={logQuotedPrice}
                        onChangeText={setLogQuotedPrice}
                      />
                    </View>
                    <View style={styles.spacer2} />
                    <View style={styles.col2}>
                      <Text style={styles.labelSmall}>Final price (₹)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. 700"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        value={logFinalPrice}
                        onChangeText={setLogFinalPrice}
                      />
                    </View>
                  </View>
                  <CalendarPicker
                    label="Next follow-up date"
                    placeholder="Select follow-up date"
                    value={logNextDate}
                    onChange={setLogNextDate}
                    small
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
                )}
            <TouchableOpacity
              style={styles.deleteLeadBtn}
              onPress={handleDeleteLead}
            >
              <Ionicons name="trash-outline" size={18} color="#dc2626" />
              <Text style={styles.deleteLeadBtnText}>Delete lead</Text>
            </TouchableOpacity>
              </ScrollView>
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#007AFF" />
              </View>
            )}
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
    color: '#475569',
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
    color: '#374151',
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
    color: '#0f172a',
    backgroundColor: '#ffffff',
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
  serviceRefBox: {
    backgroundColor: '#f0f9ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
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
  fullScreenModal: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  createModalBody: {
    flex: 1,
    minHeight: 0,
  },
  createScrollView: {
    flex: 1,
    minHeight: 0,
  },
  createScrollContent: {
    padding: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  detailModalBody: {
    flex: 1,
    minHeight: 0,
  },
  detailScrollView: {
    flex: 1,
    minHeight: 0,
  },
  detailScrollContent: {
    padding: 16,
    paddingBottom: 40,
    flexGrow: 1,
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
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  detailCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  detailInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  detailInfoLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  detailInfoValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
  },
  deleteLeadBtn: {
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
  deleteLeadBtnText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  detailHeaderName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    fontFamily: FONT_MEDIUM,
  },
  editLeadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  editLeadBtnActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  editLeadBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    fontFamily: FONT_MEDIUM,
  },
});

