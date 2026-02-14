import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  TextInput,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { getApiBaseUrl, resolvePhotoUrl } from '../../utils/api';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';

const FONT_REGULAR = Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'System' });
const FONT_MEDIUM = Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: 'System' });
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MAX_PHOTOS = 10;

function formatPhotoMeta(meta: { at?: string | Date; latitude?: number; longitude?: number } | null) {
  if (!meta) return { dateTime: '', location: '' };
  const at = meta.at ? new Date(meta.at) : null;
  const dateTime = at ? at.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '';
  const lat = meta.latitude;
  const lng = meta.longitude;
  const location = lat != null && lng != null ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : '';
  return { dateTime, location };
}

function PhotoWithMeta({ uri, meta, placeholder }: { uri: string | null; meta?: { at?: string | Date; latitude?: number; longitude?: number } | null; placeholder?: boolean }) {
  const { dateTime, location } = formatPhotoMeta(meta || null);
  const hasOverlay = !!(dateTime || location);
  return (
    <View style={styles.photoWithMetaWrap}>
      {uri && !placeholder ? (
        <View style={styles.photoThumb}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <Text style={styles.photoOverlayBrand}>CLEANING HERO</Text>
          {hasOverlay && (
            <View style={styles.photoOverlayBottom}>
              {dateTime ? <Text style={styles.photoOverlayText} numberOfLines={1}>{dateTime}</Text> : null}
              {location ? <Text style={styles.photoOverlayText} numberOfLines={1}>📍 {location}</Text> : null}
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.photoThumb, styles.photoPlaceholder]}>
          <Ionicons name="image-outline" size={20} color="#cbd5e1" />
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Step Progress Indicator                                            */
/* ------------------------------------------------------------------ */
function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { label: 'Start', icon: 'play-circle' as const },
    { label: 'On the\nWay', icon: 'car' as const },
    { label: 'Before\nPhoto', icon: 'camera' as const },
    { label: 'After\nPhoto', icon: 'camera-reverse' as const },
    { label: 'Complete', icon: 'checkmark-circle' as const },
  ];

  return (
    <View style={stepStyles.container}>
      {steps.map((step, idx) => {
        const isDone = idx < currentStep;
        const isActive = idx === currentStep;
        const isLast = idx === steps.length - 1;
        return (
          <React.Fragment key={idx}>
            <View style={stepStyles.stepItem}>
              <View style={[
                stepStyles.circle,
                isDone && stepStyles.circleDone,
                isActive && stepStyles.circleActive,
              ]}>
                {isDone ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Ionicons name={step.icon} size={14} color={isActive ? '#fff' : '#94a3b8'} />
                )}
              </View>
              <Text style={[
                stepStyles.label,
                isDone && stepStyles.labelDone,
                isActive && stepStyles.labelActive,
              ]} numberOfLines={2}>
                {step.label}
              </Text>
            </View>
            {!isLast && (
              <View style={[stepStyles.line, isDone && stepStyles.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  stepItem: { alignItems: 'center', width: 52 },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleDone: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  circleActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  label: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
    fontFamily: FONT_REGULAR,
  },
  labelDone: { color: '#16a34a', fontWeight: '600' },
  labelActive: { color: '#0EA5E9', fontWeight: '700' },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginTop: 14,
    marginHorizontal: 2,
  },
  lineDone: { backgroundColor: '#16a34a' },
});

/* ------------------------------------------------------------------ */
/*  Main Screen                                                        */
/* ------------------------------------------------------------------ */
export default function JobDetailScreen() {
  const { jobId } = useLocalSearchParams();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [remark, setRemark] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'online' | 'pending'>('cash');
  const [paymentUpdating, setPaymentUpdating] = useState(false);
  const [fullscreenPhotoUri, setFullscreenPhotoUri] = useState<string | null>(null);

  // Expense state

  useEffect(() => { loadJob(); }, []);

  const loadJob = async () => {
    try {
      if (!jobId) return;
      const response = await api.get(`/jobs/${jobId}`);
      setJob(response.data);
      if (response.data?.staffRemark) setRemark(response.data.staffRemark);
      if (response.data?.paymentMode) setPaymentMode(response.data.paymentMode);
    } catch (error) {
      console.error('Error loading job:', error);
      Alert.alert('Error', 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const getLocationData = async () => {
    let latitude: number | null = null;
    let longitude: number | null = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
      }
    } catch (e) { console.warn('Location not available:', e); }
    return { latitude, longitude };
  };

  const pickAndUploadPhoto = async (type: 'before' | 'after') => {
    // Check photo limit
    const existing = type === 'before'
      ? (job?.photos?.before?.length || 0)
      : (job?.photos?.after?.length || 0);
    if (existing >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `Maximum ${MAX_PHOTOS} ${type} photos allowed`);
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.4,
    });

    if (result.canceled) return;
    setUploading(true);
    try {
      const timestamp = new Date().toISOString();
      const { latitude, longitude } = await getLocationData();

      const resized = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.5, format: SaveFormat.JPEG }
      );

      const formData = new FormData();
      // @ts-ignore
      formData.append('photo', {
        uri: resized.uri,
        name: `${type}-photo-${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
      formData.append('timestamp', timestamp);
      if (latitude != null) formData.append('latitude', String(latitude));
      if (longitude != null) formData.append('longitude', String(longitude));

      const token = await AsyncStorage.getItem('token');
      const endpoint = type === 'before' ? 'upload-before' : 'upload';
      const uploadUrl = `${getApiBaseUrl()}/jobs/${jobId}/${endpoint}`;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(uploadUrl, { method: 'POST', headers, body: formData });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || `Upload failed: ${res.status}`);
      }

      const remaining = MAX_PHOTOS - existing - 1;
      const msg = type === 'before'
        ? `Before photo uploaded! ${remaining > 0 ? `${remaining} more allowed.` : 'Limit reached.'}`
        : `After photo uploaded! ${remaining > 0 ? `${remaining} more allowed.` : 'Limit reached.'}`;
      Alert.alert('Done', msg);
      loadJob();
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', error.message || `Failed to upload ${type} photo`);
    } finally {
      setUploading(false);
    }
  };

  const handleStartJob = async () => {
    Alert.alert(
      'Start Job',
      'Are you ready to head to the job location? Your location will be tracked by admin.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: "I'm on my way!",
          onPress: async () => {
            try {
              await api.put(`/jobs/${jobId}`, { status: 'on_the_way' });
              Alert.alert('Job Started!', 'Navigate to the location. Take a before photo when you arrive.');
              loadJob();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to start job');
            }
          },
        },
      ]
    );
  };

  const updateJobStatus = async (status: string) => {
    try {
      await api.put(`/jobs/${jobId}`, { status });
      Alert.alert('Success', `Job marked as ${status}!`);
      loadJob();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to update job';
      Alert.alert('Error', msg);
    }
  };

  const updatePaymentAndRemark = async () => {
    if (!jobId) return;
    setPaymentUpdating(true);
    try {
      await api.put(`/jobs/${jobId}`, {
        paymentStatus: 'paid',
        paymentMode,
        staffRemark: remark.trim(),
      });
      Alert.alert('Done', 'Payment marked as PAID and remark saved');
      await loadJob();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update payment');
    } finally {
      setPaymentUpdating(false);
    }
  };

  const handleComplete = () => {
    const afterCount = (job?.photos?.after?.length || 0);
    if (afterCount === 0) {
      Alert.alert('Photos required', 'Please upload at least 1 after photo before completing the job.');
      return;
    }
    Alert.alert(
      'Complete Job',
      'Are you sure the job is done and ready to mark as complete?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Complete', onPress: () => updateJobStatus('completed') },
      ]
    );
  };

  // Derived state
  const hasBefore = (job?.photos?.before?.length || 0) > 0;
  const hasAfter = (job?.photos?.after?.length || 0) > 0;
  const beforeCount = job?.photos?.before?.length || 0;
  const afterCount = job?.photos?.after?.length || 0;
  const isPaid = job?.paymentStatus === 'paid';

  // Incentive breakdown from assigned staff
  const staffList: any[] = Array.isArray(job?.assignedStaff) ? job.assignedStaff : [];
  const firstStaff = staffList.length > 0 ? staffList[0] : null;
  const tankCount = Number(job?.tankCount ?? job?.tank_count ?? 1);
  const perTank = Number(firstStaff?.perTankIncentive ?? firstStaff?.per_tank_incentive ?? 0);
  const perJob = Number(firstStaff?.defaultPerJobIncentive ?? firstStaff?.default_per_job_incentive ?? 0);
  const staffFuel = Number(firstStaff?.defaultFuelExpense ?? firstStaff?.default_fuel_expense ?? 0);
  const incentiveBase = tankCount * perTank + perJob;
  const totalIncentiveWithFuel = incentiveBase + staffFuel;
  const hasBreakdown = firstStaff && (perTank > 0 || perJob > 0 || staffFuel > 0);
  const displayIncentive = hasBreakdown ? totalIncentiveWithFuel : Number(job?.incentivePerJob ?? job?.incentive_per_job ?? 0);

  // Calculate current step: 0=Start, 1=On the Way, 2=Before Photo, 3=After Photo, 4=Complete
  let currentStep = 0;
  if (job) {
    if (job.status === 'pending') {
      currentStep = 0;
    } else if (job.status === 'on_the_way') {
      currentStep = 1;
    } else if (job.status === 'in_progress') {
      if (!hasAfter) {
        currentStep = 2; // Working, waiting for after photos
      } else {
        currentStep = 3; // After photos uploaded
      }
    } else if (job.status === 'completed') {
      currentStep = 4;
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={{ color: '#1a1a1a', fontSize: 16, padding: 20 }}>Job not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Details</Text>
        <View style={[styles.statusPill, { backgroundColor: job.status === 'completed' ? '#16a34a' : job.status === 'in_progress' ? '#0EA5E9' : job.status === 'on_the_way' ? '#f59e0b' : '#94a3b8' }]}>
          <Text style={styles.statusPillText}>{job.status === 'on_the_way' ? 'ON THE WAY' : job.status.replace('_', ' ').toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Step Progress */}
        <StepIndicator currentStep={currentStep} />

        {/* Customer Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>CUSTOMER DETAILS</Text>
          <Text style={styles.customerName}>{job.customerName}</Text>
          <Text style={styles.address}>{job.address}</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Ionicons name="call-outline" size={14} color="#64748b" />
              <Text style={styles.infoText}>{job.mobileNumber || 'N/A'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="water-outline" size={14} color="#64748b" />
              <Text style={styles.infoText}>{job.tankSize || '?'} • {job.serviceType || 'N/A'}</Text>
            </View>
            {job.scheduledAt && (
              <View style={styles.infoItem}>
                <Ionicons name="calendar-outline" size={14} color="#64748b" />
                <Text style={styles.infoText}>Scheduled: {new Date(job.scheduledAt).toLocaleDateString()}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Earnings Card */}
        <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600', letterSpacing: 0.5, fontFamily: FONT_MEDIUM }}>SERVICE CHARGE</Text>
              <Text style={{ fontSize: 18, color: '#0f172a', fontWeight: '700', fontFamily: FONT_MEDIUM }}>
                ₹{Number(job.serviceCharge || 0).toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600', letterSpacing: 0.5, fontFamily: FONT_MEDIUM }}>YOUR INCENTIVE</Text>
              <Text style={{ fontSize: 18, color: '#16a34a', fontWeight: '700', fontFamily: FONT_MEDIUM }}>
                ₹{displayIncentive.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={[styles.paymentBadge, { backgroundColor: isPaid ? '#dcfce7' : '#fef3c7' }]}>
              <Ionicons name={isPaid ? 'checkmark-circle' : 'time'} size={14} color={isPaid ? '#16a34a' : '#f59e0b'} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: isPaid ? '#16a34a' : '#f59e0b', fontFamily: FONT_MEDIUM }}>
                {isPaid ? 'PAID' : 'PENDING'}
              </Text>
            </View>
          </View>
          {hasBreakdown && (
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#bbf7d0' }}>
              <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, fontFamily: FONT_MEDIUM }}>INCENTIVE BREAKDOWN</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                <Text style={{ fontSize: 12, color: '#475569', fontFamily: FONT_REGULAR }}>No. of Tanks</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#0f172a', fontFamily: FONT_MEDIUM }}>{tankCount}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                <Text style={{ fontSize: 12, color: '#475569', fontFamily: FONT_REGULAR }}>Per tank incentive</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#0f172a', fontFamily: FONT_MEDIUM }}>₹{perTank.toLocaleString('en-IN')}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                <Text style={{ fontSize: 12, color: '#475569', fontFamily: FONT_REGULAR }}>Per job incentive</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#0f172a', fontFamily: FONT_MEDIUM }}>₹{perJob.toLocaleString('en-IN')}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                <Text style={{ fontSize: 12, color: '#475569', fontFamily: FONT_REGULAR }}>Fuel (per job)</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#0f172a', fontFamily: FONT_MEDIUM }}>₹{staffFuel.toLocaleString('en-IN')}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, marginTop: 4, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
                <Text style={{ fontSize: 11, color: '#64748b', fontFamily: FONT_REGULAR }}>Calculation</Text>
                <Text style={{ fontSize: 11, color: '#64748b', fontFamily: FONT_REGULAR }} numberOfLines={1}>
                  {tankCount}×₹{perTank} + ₹{perJob} + ₹{staffFuel} = ₹{totalIncentiveWithFuel.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Location Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>JOB LOCATION</Text>
          {job.latitude != null && job.longitude != null && (
            <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontFamily: FONT_REGULAR }}>
              📍 {Number(job.latitude).toFixed(5)}, {Number(job.longitude).toFixed(5)}
            </Text>
          )}
          <TouchableOpacity
            style={styles.mapsBtn}
            onPress={() => {
              const lat = job.latitude ?? 0;
              const lng = job.longitude ?? 0;
              const url = Platform.select({
                ios: `maps://app?daddr=${lat},${lng}`,
                android: `geo:${lat},${lng}?q=${lat},${lng}`,
                default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
              });
              Linking.openURL(url!).catch(() => Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`));
            }}
          >
            <Ionicons name="navigate" size={16} color="#fff" />
            <Text style={styles.mapsBtnText}>Navigate to Location</Text>
          </TouchableOpacity>
        </View>

        {job.notes ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SPECIAL INSTRUCTIONS</Text>
            <Text style={{ fontSize: 14, color: '#475569', lineHeight: 20, fontFamily: FONT_REGULAR }}>{job.notes}</Text>
          </View>
        ) : null}

        {/* ============================================================ */}
        {/* STEP 1: START JOB (pending state) */}
        {/* ============================================================ */}
        {job.status === 'pending' && (
          <View style={styles.actionCard}>
            <View style={styles.actionCardHeader}>
              <Ionicons name="play-circle" size={24} color="#0EA5E9" />
              <Text style={styles.actionCardTitle}>Ready to Start?</Text>
            </View>
            <Text style={styles.actionCardDesc}>
              Tap below to start heading to the job location. Admin will track your location as you travel.
            </Text>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#0EA5E9' }]}
              onPress={handleStartJob}
            >
              <Ionicons name="car" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Start Job — I'm on my way!</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ============================================================ */}
        {/* STEP 2: ON THE WAY → Take Before Photo when arrived */}
        {/* ============================================================ */}
        {job.status === 'on_the_way' && (
          <>
            {/* On the way status card */}
            <View style={[styles.actionCard, { borderColor: '#fde68a', backgroundColor: '#fffbeb' }]}>
              <View style={styles.actionCardHeader}>
                <Ionicons name="car" size={24} color="#f59e0b" />
                <Text style={[styles.actionCardTitle, { color: '#f59e0b' }]}>On the Way</Text>
              </View>
              <Text style={styles.actionCardDesc}>
                Admin is tracking your location. When you arrive at the job site, take a before photo of the tank to start the work.
              </Text>
              {job.timeline?.startedAt && (
                <Text style={{ fontSize: 11, color: '#92400e', marginBottom: 10, fontFamily: FONT_REGULAR }}>
                  Started at: {new Date(job.timeline.startedAt).toLocaleString()}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]}
                onPress={() => pickAndUploadPhoto('before')}
                disabled={uploading}
              >
                {uploading ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="camera" size={20} color="#fff" />
                    <Text style={styles.actionBtnText}>Arrived! Take Before Photo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Navigate to location */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>NAVIGATE TO LOCATION</Text>
              <TouchableOpacity
                style={styles.mapsBtn}
                onPress={() => {
                  const lat = job.latitude ?? 0;
                  const lng = job.longitude ?? 0;
                  const url = Platform.select({
                    ios: `maps://app?daddr=${lat},${lng}`,
                    android: `geo:${lat},${lng}?q=${lat},${lng}`,
                    default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
                  });
                  Linking.openURL(url!).catch(() => Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`));
                }}
              >
                <Ionicons name="navigate" size={16} color="#fff" />
                <Text style={styles.mapsBtnText}>Open in Maps</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ============================================================ */}
        {/* STEP 3: BEFORE PHOTOS (in_progress, add more before photos) */}
        {/* ============================================================ */}
        {job.status === 'in_progress' && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.cardTitle}>BEFORE PHOTOS</Text>
              <View style={styles.photoBadge}>
                <Text style={styles.photoBadgeText}>{beforeCount}/{MAX_PHOTOS}</Text>
              </View>
            </View>

            {/* Photo Grid */}
            {hasBefore && (
              <View style={styles.photoGrid}>
                {(job.photos.before || []).map((p: string, idx: number) => {
                  const uri = resolvePhotoUrl(p);
                  const meta = (job as any).photosBeforeMeta?.[idx];
                  return (
                    <TouchableOpacity key={idx} onPress={() => uri && setFullscreenPhotoUri(uri)} activeOpacity={0.9}>
                      <PhotoWithMeta uri={uri} meta={meta} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {beforeCount < MAX_PHOTOS && (
              <TouchableOpacity
                style={[styles.addPhotoBtn, { borderColor: '#f59e0b', backgroundColor: '#fffbeb' }]}
                onPress={() => pickAndUploadPhoto('before')}
                disabled={uploading}
              >
                {uploading ? <ActivityIndicator color="#f59e0b" /> : (
                  <>
                    <Ionicons name="camera-outline" size={18} color="#f59e0b" />
                    <Text style={[styles.addPhotoBtnText, { color: '#f59e0b' }]}>Add Before Photo ({MAX_PHOTOS - beforeCount} remaining)</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {job.beforePhotoAt && (
              <Text style={styles.metaText}>Started: {new Date(job.beforePhotoAt).toLocaleString()}</Text>
            )}
          </View>
        )}

        {/* ============================================================ */}
        {/* STEP 4: AFTER PHOTOS (in_progress, work done, upload after) */}
        {/* ============================================================ */}
        {job.status === 'in_progress' && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.cardTitle}>AFTER PHOTOS</Text>
              <View style={[styles.photoBadge, { backgroundColor: '#dcfce7' }]}>
                <Text style={[styles.photoBadgeText, { color: '#16a34a' }]}>{afterCount}/{MAX_PHOTOS}</Text>
              </View>
            </View>

            {hasAfter && (
              <View style={styles.photoGrid}>
                {(job.photos?.after || []).map((p: string, idx: number) => {
                  const uri = resolvePhotoUrl(p);
                  const meta = (job as any).photosAfterMeta?.[idx];
                  return uri ? (
                    <TouchableOpacity key={idx} onPress={() => setFullscreenPhotoUri(uri)} activeOpacity={0.9}>
                      <PhotoWithMeta uri={uri} meta={meta} />
                    </TouchableOpacity>
                  ) : null;
                })}
              </View>
            )}

            {!hasBefore ? (
              <View style={styles.lockedBox}>
                <Ionicons name="lock-closed" size={18} color="#94a3b8" />
                <Text style={styles.lockedText}>Upload at least 1 before photo first</Text>
              </View>
            ) : afterCount < MAX_PHOTOS ? (
              <TouchableOpacity
                style={[styles.addPhotoBtn, { borderColor: '#22c55e', backgroundColor: '#f0fdf4' }]}
                onPress={() => pickAndUploadPhoto('after')}
                disabled={uploading}
              >
                {uploading ? <ActivityIndicator color="#22c55e" /> : (
                  <>
                    <Ionicons name="camera-outline" size={18} color="#22c55e" />
                    <Text style={[styles.addPhotoBtnText, { color: '#22c55e' }]}>
                      {afterCount === 0 ? 'Take After Photo (work done?)' : `Add After Photo (${MAX_PHOTOS - afterCount} remaining)`}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}

            {job.completionPhotoAt && (
              <Text style={styles.metaText}>Last uploaded: {new Date(job.completionPhotoAt).toLocaleString()}</Text>
            )}
          </View>
        )}

        {/* ============================================================ */}
        {/* STEP 5: PAYMENT & REMARK (in_progress) */}
        {/* ============================================================ */}
        {job.status === 'in_progress' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>PAYMENT & REMARK</Text>

            <Text style={styles.fieldLabel}>Payment Mode</Text>
            <View style={styles.paymentModesRow}>
              {(['cash', 'upi', 'online', 'pending'] as const).map((mode) => {
                const active = paymentMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.paymentChip, active && styles.paymentChipActive]}
                    onPress={() => setPaymentMode(mode)}
                  >
                    {active && <Ionicons name="checkmark-circle" size={14} color="#16a34a" style={{ marginRight: 4 }} />}
                    <Text style={[styles.paymentChipText, active && styles.paymentChipTextActive]}>
                      {mode.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Customer Remark</Text>
            <TextInput
              style={styles.remarkInput}
              placeholder="Any notes about the job..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              value={remark}
              onChangeText={setRemark}
            />

            {!isPaid && (
              <TouchableOpacity
                style={styles.payBtn}
                onPress={updatePaymentAndRemark}
                disabled={paymentUpdating}
              >
                {paymentUpdating ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="cash" size={18} color="#fff" />
                    <Text style={styles.payBtnText}>Mark as PAID & Save Remark</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ============================================================ */}
        {/* COMPLETE JOB BUTTON (in_progress + has after photos) */}
        {/* ============================================================ */}
        {job.status === 'in_progress' && hasAfter && (
          <View style={styles.actionCard}>
            <View style={styles.actionCardHeader}>
              <Ionicons name="checkmark-done-circle" size={24} color="#16a34a" />
              <Text style={[styles.actionCardTitle, { color: '#16a34a' }]}>Ready to Complete?</Text>
            </View>
            <Text style={styles.actionCardDesc}>
              Before: {beforeCount} photo{beforeCount !== 1 ? 's' : ''} • After: {afterCount} photo{afterCount !== 1 ? 's' : ''} • Payment: {isPaid ? 'Received ✓' : 'Pending'}
            </Text>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#16a34a' }]}
              onPress={handleComplete}
            >
              <Ionicons name="checkmark-done" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Mark as Complete</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ============================================================ */}
        {/* COMPLETED STATE - Summary */}
        {/* ============================================================ */}
        {job.status === 'completed' && (
          <>
            <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#16a34a', fontFamily: FONT_MEDIUM }}>Job Completed</Text>
              </View>
              {job.timeline?.startedAt && (
                <Text style={styles.metaText}>On the Way: {new Date(job.timeline.startedAt).toLocaleString()}</Text>
              )}
              {job.timeline?.arrivedAt && (
                <Text style={styles.metaText}>Arrived: {new Date(job.timeline.arrivedAt).toLocaleString()}</Text>
              )}
              {job.timeline?.completedAt && (
                <Text style={styles.metaText}>Completed: {new Date(job.timeline.completedAt).toLocaleString()}</Text>
              )}
            </View>

            {/* Show all photos */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>BEFORE PHOTOS ({beforeCount})</Text>
              {hasBefore && (
                <View style={styles.photoGrid}>
                  {(job.photos.before || []).map((p: string, idx: number) => {
                    const uri = resolvePhotoUrl(p);
                    const meta = (job as any).photosBeforeMeta?.[idx];
                    return uri ? (
                      <TouchableOpacity key={idx} onPress={() => setFullscreenPhotoUri(uri)} activeOpacity={0.9}>
                        <PhotoWithMeta uri={uri} meta={meta} />
                      </TouchableOpacity>
                    ) : null;
                  })}
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>AFTER PHOTOS ({afterCount})</Text>
              {hasAfter && (
                <View style={styles.photoGrid}>
                  {(job.photos?.after || []).map((p: string, idx: number) => {
                    const uri = resolvePhotoUrl(p);
                    const meta = (job as any).photosAfterMeta?.[idx];
                    return uri ? (
                      <TouchableOpacity key={idx} onPress={() => setFullscreenPhotoUri(uri)} activeOpacity={0.9}>
                        <PhotoWithMeta uri={uri} meta={meta} />
                      </TouchableOpacity>
                    ) : null;
                  })}
                </View>
              )}
            </View>

            {/* Expense Summary after completion (set by admin from staff defaults) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>JOB EXPENSES</Text>
              <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 6, fontFamily: FONT_REGULAR }}>From admin-set defaults for your profile</Text>
              {(job.jobExpenses?.totalExpense || 0) > 0 ? (
                <>
                  {job.jobExpenses.fuelCost > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                      <Text style={{ fontSize: 13, color: '#64748b', fontFamily: FONT_REGULAR }}>Fuel</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#0f172a', fontFamily: FONT_MEDIUM }}>₹{job.jobExpenses.fuelCost.toLocaleString('en-IN')}</Text>
                    </View>
                  )}
                  {job.jobExpenses.chemicalCost > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                      <Text style={{ fontSize: 13, color: '#64748b', fontFamily: FONT_REGULAR }}>Chemical</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#0f172a', fontFamily: FONT_MEDIUM }}>₹{job.jobExpenses.chemicalCost.toLocaleString('en-IN')}</Text>
                    </View>
                  )}
                  {job.jobExpenses.otherCost > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                      <Text style={{ fontSize: 13, color: '#64748b', fontFamily: FONT_REGULAR }}>{job.jobExpenses.otherCostNote || 'Other'}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#0f172a', fontFamily: FONT_MEDIUM }}>₹{job.jobExpenses.otherCost.toLocaleString('en-IN')}</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#334155', fontFamily: FONT_MEDIUM }}>Total</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#dc2626', fontFamily: FONT_MEDIUM }}>₹{job.jobExpenses.totalExpense.toLocaleString('en-IN')}</Text>
                  </View>
                </>
              ) : (
                <Text style={{ fontSize: 13, color: '#94a3b8', fontFamily: FONT_REGULAR }}>No expenses recorded for this job</Text>
              )}
            </View>

            {/* Earnings summary */}
            <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
              <Text style={[styles.cardTitle, { color: '#16a34a' }]}>YOUR EARNINGS</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ fontSize: 13, color: '#64748b', fontFamily: FONT_REGULAR }}>Incentive</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#16a34a', fontFamily: FONT_MEDIUM }}>₹{displayIncentive.toLocaleString('en-IN')}</Text>
              </View>
              {hasBreakdown && (
                <View style={{ marginLeft: 8, marginTop: 4, paddingVertical: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#86efac' }}>
                  <Text style={{ fontSize: 11, color: '#64748b', fontFamily: FONT_MEDIUM }}>Breakdown: {tankCount} tanks × ₹{perTank} + ₹{perJob} + ₹{staffFuel} fuel</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ fontSize: 13, color: '#64748b', fontFamily: FONT_REGULAR }}>Service Charge</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#0f172a', fontFamily: FONT_MEDIUM }}>₹{Number(job.serviceCharge || 0).toLocaleString('en-IN')}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                <Text style={{ fontSize: 13, color: '#64748b', fontFamily: FONT_REGULAR }}>Payment</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: isPaid ? '#16a34a' : '#f59e0b', fontFamily: FONT_MEDIUM }}>{isPaid ? 'Received' : 'Pending'}</Text>
              </View>
            </View>
          </>
        )}

      </ScrollView>

      {/* Fullscreen photo modal + download */}
      <Modal visible={!!fullscreenPhotoUri} transparent animationType="fade">
        <View style={styles.fullscreenPhotoBackdrop}>
          <TouchableOpacity style={styles.fullscreenPhotoClose} onPress={() => setFullscreenPhotoUri(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {fullscreenPhotoUri ? (
            <Image source={{ uri: fullscreenPhotoUri }} style={styles.fullscreenPhotoImage} resizeMode="contain" />
          ) : null}
          <View style={styles.fullscreenPhotoActions}>
            <TouchableOpacity
              style={styles.fullscreenPhotoDownloadBtn}
              onPress={() => { if (fullscreenPhotoUri) Linking.openURL(fullscreenPhotoUri); }}
            >
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.fullscreenPhotoDownloadText}>Download / Open</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: FONT_MEDIUM,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
    fontFamily: FONT_MEDIUM,
  },

  // Cards
  card: {
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
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 10,
    fontFamily: FONT_MEDIUM,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
    fontFamily: FONT_MEDIUM,
  },
  address: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    fontFamily: FONT_REGULAR,
  },
  infoGrid: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 6,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#475569',
    fontFamily: FONT_REGULAR,
  },

  // Payment badge
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },

  // Maps button
  mapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  mapsBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FONT_MEDIUM,
  },

  // Photo section
  photoBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  photoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f59e0b',
    fontFamily: FONT_MEDIUM,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  photoThumb: {
    width: 90,
    height: 70,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  photoWithMetaWrap: {
    width: 90,
    marginBottom: 4,
  },
  photoOverlayBrand: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    fontSize: 7,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
    fontFamily: FONT_MEDIUM,
  },
  photoOverlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  photoOverlayText: {
    fontSize: 8,
    color: '#fff',
    fontFamily: FONT_REGULAR,
  },
  photoMeta: {
    marginTop: 4,
    paddingHorizontal: 2,
  },
  photoMetaText: {
    fontSize: 9,
    color: '#64748b',
    fontFamily: FONT_REGULAR,
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 8,
  },
  addPhotoBtnText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONT_MEDIUM,
  },
  lockedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 8,
  },
  lockedText: {
    fontSize: 13,
    color: '#94a3b8',
    fontFamily: FONT_REGULAR,
  },
  metaText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    fontFamily: FONT_REGULAR,
  },

  // Action Card
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  actionCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0EA5E9',
    fontFamily: FONT_MEDIUM,
  },
  actionCardDesc: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 14,
    fontFamily: FONT_REGULAR,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONT_MEDIUM,
  },

  // Payment section
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    fontFamily: FONT_MEDIUM,
  },
  paymentModesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f9fafb',
  },
  paymentChipActive: {
    borderColor: '#22c55e',
    backgroundColor: '#dcfce7',
  },
  paymentChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    fontFamily: FONT_MEDIUM,
  },
  paymentChipTextActive: {
    color: '#166534',
  },
  remarkInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#0f172a',
    minHeight: 70,
    textAlignVertical: 'top',
    fontFamily: FONT_REGULAR,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 14,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONT_MEDIUM,
  },

  /* Fullscreen photo modal */
  fullscreenPhotoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenPhotoClose: {
    position: 'absolute',
    top: 48,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  fullscreenPhotoImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  fullscreenPhotoActions: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fullscreenPhotoDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  fullscreenPhotoDownloadText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FONT_MEDIUM,
  },
});
