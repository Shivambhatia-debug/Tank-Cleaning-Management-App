import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type CalendarPickerProps = {
  label?: string;
  placeholder?: string;
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  small?: boolean;
};

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export default function CalendarPicker({
  label,
  placeholder = 'Select date...',
  value,
  onChange,
  small = false,
}: CalendarPickerProps) {
  const [visible, setVisible] = useState(false);

  const today = new Date();
  const initialDate = value ? new Date(value + 'T00:00:00') : today;
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  const displayValue = useMemo(() => {
    if (!value) return '';
    const d = new Date(value + 'T00:00:00');
    return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
  }, [value]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [viewYear, viewMonth]);

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const selectDay = (day: number) => {
    const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
    onChange(dateStr);
    setVisible(false);
  };

  const selectedParsed = value
    ? { y: parseInt(value.slice(0, 4)), m: parseInt(value.slice(5, 7)) - 1, d: parseInt(value.slice(8, 10)) }
    : null;

  const isToday = (day: number) =>
    viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();

  const isSelected = (day: number) =>
    selectedParsed && viewYear === selectedParsed.y && viewMonth === selectedParsed.m && day === selectedParsed.d;

  return (
    <View>
      {label ? (
        <Text style={small ? styles.labelSmall : styles.label}>{label}</Text>
      ) : null}
      <TouchableOpacity
        style={styles.selector}
        onPress={() => {
          // Reset view to selected date or today when opening
          const d = value ? new Date(value + 'T00:00:00') : new Date();
          setViewYear(d.getFullYear());
          setViewMonth(d.getMonth());
          setVisible(true);
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={18} color="#6B7280" style={{ marginRight: 8 }} />
        <Text style={[styles.selectorText, !value && styles.placeholderText]} numberOfLines={1}>
          {displayValue || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#6B7280" />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.calendar} onStartShouldSetResponder={() => true}>
            {/* Month navigation */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={goPrevMonth} style={styles.navBtn}>
                <Ionicons name="chevron-back" size={22} color="#374151" />
              </TouchableOpacity>
              <Text style={styles.monthTitle}>
                {MONTHS[viewMonth]} {viewYear}
              </Text>
              <TouchableOpacity onPress={goNextMonth} style={styles.navBtn}>
                <Ionicons name="chevron-forward" size={22} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Day headers */}
            <View style={styles.dayHeaderRow}>
              {DAYS.map((d) => (
                <Text key={d} style={styles.dayHeader}>{d}</Text>
              ))}
            </View>

            {/* Day grid */}
            <View style={styles.dayGrid}>
              {calendarDays.map((day, idx) => (
                <View key={idx} style={styles.dayCell}>
                  {day ? (
                    <TouchableOpacity
                      style={[
                        styles.dayBtn,
                        isToday(day) && styles.dayToday,
                        isSelected(day) && styles.daySelected,
                      ]}
                      onPress={() => selectDay(day)}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isToday(day) && styles.dayTodayText,
                          isSelected(day) && styles.daySelectedText,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </View>

            {/* Today shortcut + Clear */}
            <View style={styles.bottomRow}>
              <TouchableOpacity
                style={styles.todayBtn}
                onPress={() => {
                  const t = new Date();
                  const ds = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
                  onChange(ds);
                  setVisible(false);
                }}
              >
                <Text style={styles.todayBtnText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => {
                  onChange('');
                  setVisible(false);
                }}
              >
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  selectorText: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendar: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  navBtn: {
    padding: 6,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  dayHeaderRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 14,
    color: '#374151',
  },
  dayToday: {
    borderWidth: 1.5,
    borderColor: '#0EA5E9',
  },
  dayTodayText: {
    color: '#0EA5E9',
    fontWeight: '600',
  },
  daySelected: {
    backgroundColor: '#0EA5E9',
  },
  daySelectedText: {
    color: '#fff',
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  todayBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
  },
  todayBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0369A1',
  },
  clearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B91C1C',
  },
});
