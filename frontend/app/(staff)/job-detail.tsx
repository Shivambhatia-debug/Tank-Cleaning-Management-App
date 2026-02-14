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

export default function JobDetailScreen() {
  const { jobId } = useLocalSearchParams();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [remark, setRemark] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'online' | 'pending'>('cash');
  const [paymentUpdating, setPaymentUpdating] = useState(false);

  useEffect(() => {
    loadJob();
  }, []);

  const loadJob = async () => {
    try {
      if (!jobId) return;
      const response = await api.get(`/jobs/${jobId}`);
      setJob(response.data);
      if (response.data?.staffRemark) {
        setRemark(response.data.staffRemark);
      }
      if (response.data?.paymentMode) {
        setPaymentMode(response.data.paymentMode);
      }
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
    } catch (e) {
      console.warn('Location not available:', e);
    }
    return { latitude, longitude };
  };

  const pickAndUploadPhoto = async (type: 'before' | 'after') => {
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.3,
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
      // @ts-ignore - RN FormData accepts { uri, name, type }
      formData.append('photo', {
        uri: resized.uri,
        name: `${type}-photo.jpg`,
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

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Upload failed: ${res.status}`);
      }

      const successMsg = type === 'before'
        ? 'Before photo uploaded! Job started.'
        : 'After photo uploaded!';
      Alert.alert('Success', successMsg);
      loadJob();
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', `Failed to upload ${type} photo`);
    } finally {
      setUploading(false);
    }
  };

  const updateJobStatus = async (status: string) => {
    try {
      await api.put(`/jobs/${jobId}`, { status });
      Alert.alert('Success', `Job marked as ${status}!`);
      loadJob();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to update job');
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
      console.error('Payment update error', error.response?.data || error.message);
      Alert.alert('Error', 'Failed to update payment');
    } finally {
      setPaymentUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FF9500';
      case 'in_progress': return '#34C759';
      case 'completed': return '#007AFF';
      default: return '#8E8E93';
    }
  };

  // Helpers
  const hasBefore = job?.photos?.before?.length > 0;
  const hasAfter = job?.photos?.after?.length > 0 || job?.completionPhoto || job?.completion_photo;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.container}>
        <Text style={{ color: '#1a1a1a', fontSize: 16 }}>Job not found</Text>
      </View>
    );
  }

  const rawAddress = String(job.address || '').trim();
  const isPlaceholderAddress = rawAddress.toLowerCase().startsWith('address from lead');
  const locationAddress = isPlaceholderAddress ? 'Location from coordinates / map pin' : rawAddress;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#007AFF" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Details</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status */}
        <View style={styles.section}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) }]}>
            <Ionicons name={job.status === 'completed' ? 'checkmark-circle' : job.status === 'in_progress' ? 'time' : 'hourglass'} size={16} color="#fff" />
            <Text style={styles.statusText}>{job.status.replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.infoCard}>
            <Text style={styles.customerName}>{job.customerName}</Text>
            <Text style={styles.address}>{job.address}</Text>

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Ionicons name="call-outline" size={14} color="#64748b" />
                <Text style={styles.infoText}>{job.mobileNumber || 'N/A'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="water-outline" size={14} color="#64748b" />
                <Text style={styles.infoText}>{job.tankSize || '?'} - {job.serviceType || 'N/A'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="cash-outline" size={14} color="#64748b" />
                <Text style={styles.infoText}>
                  {job.paymentStatus === 'paid' ? 'Paid' : 'Pending'} {(job.serviceCharge ?? 0) > 0 ? `- Rs.${Number(job.serviceCharge).toLocaleString('en-IN')}` : ''}
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="trophy-outline" size={14} color="#16a34a" />
                <Text style={[styles.infoText, { color: '#16a34a', fontWeight: '600' }]}>
                  {job.status === 'completed' ? 'Incentive earned' : 'Incentive on completion'}: Rs.{(Number(job.incentivePerJob ?? 0) || 0).toLocaleString('en-IN')}
                </Text>
              </View>
              {job.scheduledAt && (
                <View style={styles.infoItem}>
                  <Ionicons name="calendar-outline" size={14} color="#64748b" />
                  <Text style={styles.infoText}>Scheduled: {new Date(job.scheduledAt).toLocaleString('en-IN')}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Location</Text>
          <View style={styles.infoCard}>
            <Text style={styles.address}>{locationAddress}</Text>
            {job.latitude != null && job.longitude != null && (
              <Text style={{ fontSize: 13, color: '#666', marginTop: 6, fontFamily: FONT_REGULAR }}>
                {Number(job.latitude).toFixed(5)}, {Number(job.longitude).toFixed(5)}
              </Text>
            )}
            <TouchableOpacity
              style={styles.openMapsButton}
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
              <Ionicons name="navigate-outline" size={16} color="#fff" />
              <Text style={styles.openMapsButtonText}>Open in Maps</Text>
            </TouchableOpacity>
          </View>
        </View>

        {job.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Special Instructions</Text>
            <View style={styles.infoCard}>
              <Text style={styles.notesText}>{job.notes}</Text>
            </View>
          </View>
        )}

        {/* Before/After Photos Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Photos</Text>
          <View style={styles.photosCard}>
            {/* Before Photos */}
            <View style={styles.photoColumn}>
              <View style={styles.photoLabel}>
                <Ionicons name="camera-outline" size={16} color="#f59e0b" />
                <Text style={styles.photoLabelText}>BEFORE</Text>
              </View>
              {hasBefore ? (
                <View style={styles.photoGrid}>
                  {(job.photos?.before || []).map((p: string, idx: number) => {
                    const uri = resolvePhotoUrl(p);
                    return uri ? (
                      <Image key={idx} source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                    ) : (
                      <View key={idx} style={[styles.photoThumb, styles.photoPlaceholder]}>
                        <Text style={styles.photoPlaceholderText}>N/A</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={[styles.photoThumb, styles.photoPlaceholder]}>
                  <Ionicons name="image-outline" size={24} color="#cbd5e1" />
                  <Text style={styles.photoPlaceholderText}>No photo yet</Text>
                </View>
              )}
            </View>

            {/* Divider */}
            <View style={styles.photoDivider} />

            {/* After Photos */}
            <View style={styles.photoColumn}>
              <View style={styles.photoLabel}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#22c55e" />
                <Text style={[styles.photoLabelText, { color: '#22c55e' }]}>AFTER</Text>
              </View>
              {hasAfter ? (
                <View style={styles.photoGrid}>
                  {(job.photos?.after || []).map((p: string, idx: number) => {
                    const uri = resolvePhotoUrl(p);
                    return uri ? (
                      <Image key={idx} source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                    ) : null;
                  })}
                  {/* legacy completionPhoto */}
                  {!job.photos?.after?.length && (job.completionPhoto || job.completion_photo) && (
                    <Image
                      source={{ uri: resolvePhotoUrl(job.completionPhoto || job.completion_photo) || '' }}
                      style={styles.photoThumb}
                      resizeMode="cover"
                    />
                  )}
                </View>
              ) : (
                <View style={[styles.photoThumb, styles.photoPlaceholder]}>
                  <Ionicons name="image-outline" size={24} color="#cbd5e1" />
                  <Text style={styles.photoPlaceholderText}>No photo yet</Text>
                </View>
              )}
            </View>
          </View>

          {/* Completion metadata */}
          {(job.completionPhotoAt || job.beforePhotoAt) && (
            <View style={{ marginTop: 8 }}>
              {job.beforePhotoAt && (
                <Text style={styles.metaText}>
                  Before: {new Date(job.beforePhotoAt).toLocaleString('en-IN')}
                </Text>
              )}
              {job.completionPhotoAt && (
                <Text style={styles.metaText}>
                  After: {new Date(job.completionPhotoAt).toLocaleString('en-IN')}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Payment & Remark */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment & Remark</Text>
          <View style={styles.infoCard}>
            <Text style={styles.fieldLabel}>Payment mode</Text>
            <View style={styles.paymentModesRow}>
              {['cash', 'upi', 'online', 'pending'].map((mode) => {
                const active = paymentMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.paymentChip, active && styles.paymentChipActive]}
                    onPress={() => setPaymentMode(mode as any)}
                  >
                    <View style={styles.paymentChipInner}>
                      {active && <Ionicons name="checkmark-circle" size={16} color="#16a34a" style={{ marginRight: 4 }} />}
                      <Text style={[styles.paymentChipText, active && styles.paymentChipTextActive]}>
                        {mode.toUpperCase()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Customer remark</Text>
            <TextInput
              style={styles.remarkInput}
              placeholder="Any notes about the job..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              value={remark}
              onChangeText={setRemark}
            />

            {job.paymentStatus !== 'paid' && (
              <TouchableOpacity
                style={styles.paymentButton}
                onPress={updatePaymentAndRemark}
                disabled={paymentUpdating}
              >
                {paymentUpdating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.paymentButtonText}>Mark as PAID + Save remark</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Action Area */}
      {job.status === 'pending' && (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#f59e0b' }]}
            onPress={() => pickAndUploadPhoto('before')}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Take Before Photo & Start Job</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {job.status === 'in_progress' && !hasAfter && (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#22c55e' }]}
            onPress={() => pickAndUploadPhoto('after')}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Take After Photo</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {job.status === 'in_progress' && hasAfter && (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#007AFF' }]}
            onPress={() => updateJobStatus('completed')}
          >
            <Ionicons name="checkmark-done" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Mark as Complete</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 70,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '500',
    fontFamily: FONT_MEDIUM,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: FONT_MEDIUM,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: FONT_MEDIUM,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONT_MEDIUM,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
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
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
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
  notesText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    fontFamily: FONT_REGULAR,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
    fontFamily: FONT_MEDIUM,
  },
  paymentModesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  paymentChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f9fafb',
  },
  paymentChipActive: {
    borderColor: '#22c55e',
    backgroundColor: '#dcfce7',
  },
  paymentChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginTop: 4,
    fontFamily: FONT_REGULAR,
  },
  paymentButton: {
    marginTop: 14,
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  paymentButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONT_MEDIUM,
  },
  openMapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#0EA5E9',
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  openMapsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FONT_MEDIUM,
  },
  // Photos section
  photosCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  photoColumn: {
    flex: 1,
    alignItems: 'center',
  },
  photoDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 12,
  },
  photoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  photoLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f59e0b',
    fontFamily: FONT_MEDIUM,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  photoThumb: {
    width: 120,
    height: 90,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  photoPlaceholderText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    fontFamily: FONT_REGULAR,
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: FONT_REGULAR,
  },
  // Bottom actions
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONT_MEDIUM,
  },
});
