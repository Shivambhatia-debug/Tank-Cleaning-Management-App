import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api, { resolvePhotoUrl } from '../../utils/api';

const FONT_REGULAR = Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'System' });
const FONT_MEDIUM = Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: 'System' });

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getStatusColor(status: string) {
  switch (status) {
    case 'pending':
      return '#FF9500';
    case 'on_the_way':
      return '#f59e0b';
    case 'in_progress':
      return '#34C759';
    case 'completed':
      return '#007AFF';
    default:
      return '#8E8E93';
  }
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{icon ? `${icon} ` : ''}{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

/* ------------------------------------------------------------------ */
/*  Photo thumbnail with error handling                                */
/* ------------------------------------------------------------------ */

function PhotoThumb({ uri }: { uri: string | null }) {
  const [error, setError] = useState(false);
  if (!uri || error) {
    return (
      <View style={[styles.photoThumb, styles.photoPlaceholder]}>
        <Ionicons name="image-outline" size={22} color="#cbd5e1" />
        <Text style={styles.photoPlaceholderText}>N/A</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={styles.photoThumb}
      resizeMode="cover"
      onError={() => setError(true)}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Main screen                                                        */
/* ------------------------------------------------------------------ */

export default function AdminJobDetailScreen() {
  const { jobId } = useLocalSearchParams();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadJob();
  }, []);

  const loadJob = async () => {
    try {
      if (!jobId) return;
      const res = await api.get(`/jobs/${jobId}`);
      setJob(res.data);
    } catch (err) {
      console.error('Error loading job:', err);
      Alert.alert('Error', 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Job',
      'Are you sure you want to delete this job? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await api.delete(`/jobs/${jobId}`);
              Alert.alert('Done', 'Job deleted successfully');
              router.back();
            } catch (err: any) {
              const msg =
                err.response?.data?.message ||
                err.response?.data?.detail ||
                err.message ||
                'Failed to delete job';
              Alert.alert('Error', msg);
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  /* ---- Not found ---- */
  if (!job) {
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
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#8E8E93" />
          <Text style={{ fontSize: 16, color: '#8E8E93', marginTop: 12, fontFamily: FONT_REGULAR }}>
            Job not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ---- Derived values ---- */
  const staffList: any[] = Array.isArray(job.assignedStaff) ? job.assignedStaff : [];
  const hasBefore = job.photos?.before?.length > 0;
  const hasAfter =
    job.photos?.after?.length > 0 || !!job.completionPhoto || !!job.completion_photo;
  const beforeCount = job.photos?.before?.length || 0;
  const afterCount = job.photos?.after?.length || 0;
  const charge = Number(job.serviceCharge ?? job.service_charge ?? 0);
  const incentive = Number(job.incentivePerJob ?? job.incentive_per_job ?? 0);
  const totalExpense = Number(job.jobExpenses?.totalExpense ?? 0);
  const profit = charge - totalExpense - incentive;
  const paymentStatus = job.paymentStatus === 'paid' ? 'Paid' : 'Pending';
  const paymentMode = (job.paymentMode || job.payment_mode || '—').toUpperCase();
  const tankCount = Number(job.tankCount ?? 1);
  const firstStaff = staffList && staffList.length > 0 ? staffList[0] : null;
  const perTank = Number(firstStaff?.perTankIncentive ?? firstStaff?.per_tank_incentive ?? 0);
  const perJob = Number(firstStaff?.defaultPerJobIncentive ?? firstStaff?.default_per_job_incentive ?? 0);
  const staffFuel = Number(firstStaff?.defaultFuelExpense ?? firstStaff?.default_fuel_expense ?? 0);
  const tankPart = tankCount * perTank;
  const incentiveBreakdown = tankPart + perJob;
  const totalIncentiveWithFuel = incentiveBreakdown + staffFuel;

  // Progress tracking
  let progressStep = 'Pending';
  let progressColor = '#94a3b8';
  if (job.status === 'pending') {
    progressStep = 'Waiting for staff to start';
    progressColor = '#94a3b8';
  } else if (job.status === 'on_the_way') {
    progressStep = 'Staff is on the way to location';
    progressColor = '#f59e0b';
  } else if (job.status === 'in_progress') {
    if (!hasAfter) {
      progressStep = `Work in progress (${beforeCount} before photo${beforeCount !== 1 ? 's' : ''})`;
      progressColor = '#0EA5E9';
    } else {
      progressStep = `Work done — ${afterCount} after photo${afterCount !== 1 ? 's' : ''} uploaded`;
      progressColor = '#16a34a';
    }
  } else if (job.status === 'completed') {
    progressStep = 'Completed';
    progressColor = '#16a34a';
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#007AFF" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Details</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status badge */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) }]}>
            <Ionicons
              name={
                job.status === 'completed'
                  ? 'checkmark-circle'
                  : job.status === 'in_progress'
                  ? 'time'
                  : 'hourglass'
              }
              size={16}
              color="#fff"
            />
            <Text style={styles.statusText}>
              {(job.status || '').replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* -------- Progress Tracker -------- */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 4, fontSize: 11, letterSpacing: 0.5 }]}>STAFF PROGRESS</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: progressColor, fontFamily: FONT_MEDIUM }}>
                {progressStep}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ alignItems: 'center', backgroundColor: '#fffbeb', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#fde68a' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#f59e0b', fontFamily: FONT_MEDIUM }}>{beforeCount}</Text>
                <Text style={{ fontSize: 9, color: '#92400e', fontWeight: '600' }}>BEFORE</Text>
              </View>
              <View style={{ alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#bbf7d0' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#16a34a', fontFamily: FONT_MEDIUM }}>{afterCount}</Text>
                <Text style={{ fontSize: 9, color: '#166534', fontWeight: '600' }}>AFTER</Text>
              </View>
            </View>
          </View>
          {job.timeline?.startedAt && (
            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 8, fontFamily: FONT_REGULAR }}>
              On the Way: {new Date(job.timeline.startedAt).toLocaleString()}
            </Text>
          )}
          {job.timeline?.arrivedAt && (
            <Text style={{ fontSize: 11, color: '#0EA5E9', marginTop: 2, fontFamily: FONT_REGULAR }}>
              Arrived (Before Photo): {new Date(job.timeline.arrivedAt).toLocaleString()}
            </Text>
          )}
          {job.timeline?.completedAt && (
            <Text style={{ fontSize: 11, color: '#16a34a', marginTop: 2, fontFamily: FONT_REGULAR }}>
              Completed: {new Date(job.timeline.completedAt).toLocaleString()}
            </Text>
          )}
        </View>

        {/* -------- Customer Info -------- */}
        <SectionTitle title="Customer Information" />
        <View style={styles.card}>
          <InfoRow label="Name" value={job.customerName || '—'} icon="👤" />
          <InfoRow label="Mobile" value={job.mobileNumber || 'N/A'} icon="📱" />
          <InfoRow label="Address" value={job.address || '—'} icon="📍" />
        </View>

        {/* -------- Service Details -------- */}
        <SectionTitle title="Service Details" />
        <View style={styles.card}>
          <InfoRow label="Tank Size" value={job.tankSize || '—'} icon="🛢" />
          <InfoRow label="Service Type" value={job.serviceType || '—'} icon="🔧" />
          <InfoRow label="Lead Source" value={job.leadSource || '—'} icon="📢" />
          <InfoRow
            label="Scheduled Date"
            value={job.scheduledAt ? new Date(job.scheduledAt).toLocaleString('en-IN') : 'Not scheduled'}
            icon="🗓"
          />
        </View>

        {/* -------- Payment -------- */}
        <SectionTitle title="Payment" />
        <View style={styles.card}>
          <InfoRow label="Payment Status" value={paymentStatus} icon="💳" />
          <InfoRow
            label="Service Charge"
            value={charge > 0 ? `₹${charge.toLocaleString('en-IN')}` : 'On request'}
            icon="💰"
          />
          <InfoRow label="Payment Mode" value={paymentMode} icon="🏦" />
          <InfoRow label="Scheduled Date" value={job.scheduledAt ? new Date(job.scheduledAt).toLocaleString('en-IN') : 'Not scheduled'} icon="🗓" />
          <InfoRow label="No. of Tanks" value={String(tankCount)} icon="🛢" />
          <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
            <Text style={[styles.sectionTitle, { fontSize: 11, marginBottom: 6 }]}>INCENTIVE BREAKDOWN</Text>
            <InfoRow label="Per tank incentive" value={perTank >= 0 ? `₹${perTank.toLocaleString('en-IN')}` : '—'} icon="🛢" />
            <InfoRow label="Per job incentive" value={perJob >= 0 ? `₹${perJob.toLocaleString('en-IN')}` : '—'} icon="🎁" />
            <InfoRow label="Fuel (per job)" value={staffFuel >= 0 ? `₹${staffFuel.toLocaleString('en-IN')}` : '—'} icon="⛽" />
            {tankCount > 0 && (perTank > 0 || perJob > 0 || staffFuel > 0) && (
              <InfoRow
                label="Calculation"
                value={`${tankCount} × ₹${perTank} + ₹${perJob} + ₹${staffFuel} = ₹${totalIncentiveWithFuel.toLocaleString('en-IN')}`}
                icon="🧮"
              />
            )}
            <InfoRow
              label="Total Incentive / Job"
              value={totalIncentiveWithFuel >= 0 ? `₹${totalIncentiveWithFuel.toLocaleString('en-IN')}` : '—'}
              icon="🎁"
            />
          </View>
        </View>

        {/* -------- Job Expenses & Profit -------- */}
        {(job.status === 'completed' || totalExpense > 0) && (
          <>
            <SectionTitle title="Expenses & Profit" />
            <View style={styles.card}>
              {job.jobExpenses?.fuelCost > 0 && (
                <InfoRow label="Fuel Cost" value={`₹${job.jobExpenses.fuelCost.toLocaleString('en-IN')}`} icon="⛽" />
              )}
              {job.jobExpenses?.chemicalCost > 0 && (
                <InfoRow label="Chemical Cost" value={`₹${job.jobExpenses.chemicalCost.toLocaleString('en-IN')}`} icon="🧪" />
              )}
              {job.jobExpenses?.otherCost > 0 && (
                <InfoRow label={job.jobExpenses.otherCostNote || 'Other'} value={`₹${job.jobExpenses.otherCost.toLocaleString('en-IN')}`} icon="📦" />
              )}
              <InfoRow label="Total Expense" value={totalExpense > 0 ? `₹${totalExpense.toLocaleString('en-IN')}` : '₹0'} icon="🧾" />
              <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
                <InfoRow
                  label="Net Profit"
                  value={`₹${profit.toLocaleString('en-IN')}`}
                  icon={profit >= 0 ? '📈' : '📉'}
                />
              </View>
            </View>
          </>
        )}

        {/* -------- Before Photos -------- */}
        <SectionTitle title={`Before Photos (${beforeCount})`} />
        <View style={styles.card}>
          {hasBefore ? (
            <View style={styles.photoGridWrap}>
              {(job.photos.before as string[]).map((p: string, i: number) => (
                <PhotoThumb key={`b-${i}`} uri={resolvePhotoUrl(p)} />
              ))}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Ionicons name="camera-outline" size={32} color="#e2e8f0" />
              <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontFamily: FONT_REGULAR }}>No before photos yet</Text>
            </View>
          )}
          {job.beforePhotoAt && (
            <Text style={styles.photoMetaText}>
              First photo: {new Date(job.beforePhotoAt).toLocaleString('en-IN')}
            </Text>
          )}
        </View>

        {/* -------- After Photos -------- */}
        <SectionTitle title={`After Photos (${afterCount})`} />
        <View style={styles.card}>
          {hasAfter ? (
            <View style={styles.photoGridWrap}>
              {(job.photos?.after || []).map((p: string, i: number) => (
                <PhotoThumb key={`a-${i}`} uri={resolvePhotoUrl(p)} />
              ))}
              {!job.photos?.after?.length && (job.completionPhoto || job.completion_photo) && (
                <PhotoThumb uri={resolvePhotoUrl(job.completionPhoto || job.completion_photo)} />
              )}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Ionicons name="camera-reverse-outline" size={32} color="#e2e8f0" />
              <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontFamily: FONT_REGULAR }}>No after photos yet</Text>
            </View>
          )}
          {job.completionPhotoAt && (
            <Text style={styles.photoMetaText}>
              Last photo: {new Date(job.completionPhotoAt).toLocaleString('en-IN')}
            </Text>
          )}
        </View>

        {/* -------- Assigned Staff -------- */}
        <SectionTitle title="Assigned Staff" />
        <View style={styles.card}>
          {staffList.length > 0 ? (
            <View style={styles.chipsRow}>
              {staffList.map((s: any) => {
                const id = s._id || s;
                const name =
                  typeof s === 'object' && s.name
                    ? s.name
                    : `Staff ${String(id).slice(-4)}`;
                return (
                  <View key={id} style={styles.staffChip}>
                    <Ionicons name="person-outline" size={14} color="#007AFF" />
                    <Text style={styles.staffChipText}>{name}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>No staff assigned</Text>
          )}
        </View>

        {/* -------- Notes -------- */}
        {!!job.notes && (
          <>
            <SectionTitle title="Notes" />
            <View style={styles.card}>
              <Text style={styles.notesText}>{job.notes}</Text>
            </View>
          </>
        )}

        {/* -------- Staff Remark -------- */}
        {!!job.staffRemark && (
          <>
            <SectionTitle title="Staff Remark" />
            <View style={styles.card}>
              <Text style={styles.notesText}>{job.staffRemark}</Text>
            </View>
          </>
        )}

        {/* -------- Delete Button -------- */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={deleting}
          activeOpacity={0.8}
        >
          {deleting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.deleteButtonText}>Delete Job</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Header */
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
    shadowRadius: 3,
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

  /* Scroll */
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  /* Status */
  statusRow: {
    marginBottom: 8,
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

  /* Section titles */
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 10,
    fontFamily: FONT_MEDIUM,
  },

  /* Cards */
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },

  /* Info rows */
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    fontFamily: FONT_REGULAR,
    flexShrink: 0,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    fontFamily: FONT_MEDIUM,
    textAlign: 'right',
    flexShrink: 1,
    marginLeft: 12,
  },

  /* Photos */
  photosRow: {
    flexDirection: 'row',
  },
  photoColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  photoDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 12,
  },
  photoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  photoLabelText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT_MEDIUM,
  },
  photoThumb: {
    width: '100%',
    maxWidth: 260,
    height: 130,
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
  photoMeta: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f1f5f9',
    gap: 4,
  },
  photoMetaText: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: FONT_REGULAR,
  },

  /* Staff chips */
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  staffChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#E8F4FD',
    borderRadius: 10,
  },
  staffChipText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
    fontFamily: FONT_MEDIUM,
  },

  /* Notes */
  notesText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 21,
    fontFamily: FONT_REGULAR,
  },

  /* Empty */
  emptyText: {
    fontSize: 13,
    color: '#8E8E93',
    fontFamily: FONT_REGULAR,
  },

  /* Photo grid (new) */
  photoGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },

  /* Delete button */
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
    backgroundColor: '#FF3B30',
    paddingVertical: 15,
    borderRadius: 14,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONT_MEDIUM,
  },
});
