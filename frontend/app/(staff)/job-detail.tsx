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
import api, { getUploadsBaseUrl, getApiBaseUrl } from '../../utils/api';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';

export default function JobDetailScreen() {
  const { jobId } = useLocalSearchParams();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [remark, setRemark] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'online' | 'pending'>('cash');
  const [paymentUpdating, setPaymentUpdating] = useState(false);

  // ... (pickImage function to be added next via full implementation if needed, checking existing imports)


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

  const pickImage = async () => {
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.3,
    });

    if (!result.canceled) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    setUploading(true);
    try {
      const timestamp = new Date().toISOString();
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

      const resized = await manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.5, format: SaveFormat.JPEG }
      );

      const formData = new FormData();
      // @ts-ignore - RN FormData accepts { uri, name, type }
      formData.append('photo', {
        uri: resized.uri,
        name: 'completion.jpg',
        type: 'image/jpeg',
      });
      formData.append('timestamp', timestamp);
      if (latitude != null) formData.append('latitude', String(latitude));
      if (longitude != null) formData.append('longitude', String(longitude));

      const token = await AsyncStorage.getItem('token');
      const uploadUrl = `${getApiBaseUrl()}/jobs/${jobId}/upload`;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      // Do NOT set Content-Type - fetch sets multipart/form-data with boundary

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Upload failed: ${res.status}`);
      }

      Alert.alert('Success', 'Photo uploaded with time & location!');
      loadJob();
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload photo');
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
        <Text>Job not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job details</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(job.status) },
            ]}
          >
            <Text style={styles.statusText}>{job.status.replace('_', ' ')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.infoCard}>
            <Text style={styles.customerName}>{job.customerName}</Text>
            <Text style={styles.address}>{job.address}</Text>

            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee' }}>
              <Text style={{ fontSize: 14, color: '#555', marginBottom: 4 }}>📱 {job.mobileNumber || 'N/A'}</Text>
              <Text style={{ fontSize: 14, color: '#555' }}>🛢 {job.tankSize || 'Unknown Size'} • {job.serviceType || 'N/A'}</Text>
              <Text style={{ fontSize: 14, color: '#555', marginTop: 4 }}>
                💰 {job.paymentStatus === 'paid' ? 'Paid' : 'Payment pending'} • ₹{job.serviceCharge || 0}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Job Location (Jahan jana hai)</Text>
          <View style={styles.infoCard}>
            <Text style={styles.address}>{job.address}</Text>
            {job.latitude != null && job.longitude != null && (
              <Text style={{ fontSize: 13, color: '#666', marginTop: 6 }}>
                Coords: {Number(job.latitude).toFixed(5)}, {Number(job.longitude).toFixed(5)}
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
                Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`));
              }}
            >
              <Text style={styles.openMapsButtonText}>🗺️ Open in Maps</Text>
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

        {/* Staff remark + payment update */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment & customer remark</Text>
          <View style={styles.infoCard}>
            <Text style={styles.fieldLabel}>Payment mode</Text>
            <View style={styles.paymentModesRow}>
              {['cash', 'upi', 'online', 'pending'].map((mode) => {
                const active = paymentMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.paymentChip,
                      active && styles.paymentChipActive,
                    ]}
                    onPress={() => setPaymentMode(mode as any)}
                  >
                    <View style={styles.paymentChipInner}>
                      {active && (
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color="#16a34a"
                          style={{ marginRight: 4 }}
                        />
                      )}
                      <Text
                        style={[
                          styles.paymentChipText,
                          active && styles.paymentChipTextActive,
                        ]}
                      >
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
              placeholder="Jo bhi important baat ho (tank condition, extra work, etc.)"
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

        {job.completionPhoto && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completion Photo</Text>
            <View style={styles.infoCard}>
              <Image
                source={{ uri: `${getUploadsBaseUrl()}/uploads/${job.completionPhoto}` }}
                style={styles.completionImage}
                resizeMode="cover"
              />
              <View style={styles.completionMeta}>
                {job.completionPhotoAt && (
                  <Text style={styles.completionMetaText}>
                    📅 {new Date(job.completionPhotoAt).toLocaleDateString()} • {new Date(job.completionPhotoAt).toLocaleTimeString()}
                  </Text>
                )}
                {(job.completionLatitude != null && job.completionLongitude != null) && (
                  <Text style={styles.completionMetaText}>
                    📍 {Number(job.completionLatitude).toFixed(6)}, {Number(job.completionLongitude).toFixed(6)}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Action Area */}
      {job.status === 'in_progress' && (
        <View style={styles.bottomActions}>
          {!job.completionPhoto ? (
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: '#FF9500' }]}
              onPress={pickImage}
            >
              <Text style={styles.startButtonText}>
                {uploading ? 'Uploading...' : '📷 Upload Completion Photo'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.completeButton}
              onPress={() => updateJobStatus('completed')}
            >
              <Text style={styles.completeButtonText}>✅ Mark as Complete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {job.status === 'pending' && (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => updateJobStatus('in_progress')}
          >
            <Text style={styles.startButtonText}>Start Job</Text>
          </TouchableOpacity>
        </View>
      )}
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
  backButton: {
    width: 56,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  paymentModesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  paymentChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  },
  paymentChipTextActive: {
    color: '#166534',
  },
  remarkInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    minHeight: 70,
    textAlignVertical: 'top',
    marginTop: 4,
  },
  paymentButton: {
    marginTop: 12,
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  paymentButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  customerName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  address: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  notesText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  completionImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  completionMeta: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  completionMetaText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 2,
  },
  openMapsButton: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#0EA5E9',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  openMapsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  startButton: {
    backgroundColor: '#34C759',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  completeButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
