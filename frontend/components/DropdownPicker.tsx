import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type DropdownPickerProps = {
  label?: string;
  placeholder?: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  /** Show small label style */
  small?: boolean;
};

export default function DropdownPicker({
  label,
  placeholder = 'Select...',
  value,
  options,
  onSelect,
  small = false,
}: DropdownPickerProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      {label ? (
        <Text style={small ? styles.labelSmall : styles.label}>{label}</Text>
      ) : null}
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.selectorText, !value && styles.placeholderText]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#6B7280" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={styles.dropdown}>
            <Text style={styles.dropdownTitle}>{label || 'Select option'}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const selected = item === value;
                return (
                  <TouchableOpacity
                    style={[styles.option, selected && styles.optionSelected]}
                    onPress={() => {
                      onSelect(item);
                      setVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selected && styles.optionTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={20} color="#0EA5E9" />
                    )}
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 320 }}
            />
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setVisible(false)}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
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
    justifyContent: 'space-between',
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
    padding: 30,
  },
  dropdown: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    maxHeight: '70%',
  },
  dropdownTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 2,
  },
  optionSelected: {
    backgroundColor: '#E0F2FE',
  },
  optionText: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
  },
  optionTextSelected: {
    color: '#0369A1',
    fontWeight: '600',
  },
  closeBtn: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
});
