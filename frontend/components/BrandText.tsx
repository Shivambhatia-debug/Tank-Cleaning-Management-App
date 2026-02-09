import React from 'react';
import { Text, StyleSheet, View } from 'react-native';

type BrandTextProps = {
  faded?: boolean;
  style?: object;
};

export default function BrandText({ faded = false, style }: BrandTextProps) {
  if (faded) {
    return (
      <View style={[styles.fadedWrap, style]}>
        <Text style={styles.fadedLine1}>CLEANING HERO</Text>
        <Text style={styles.fadedLine2}>स्वच्छता ही सेवा</Text>
      </View>
    );
  }
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.line1}>CLEANING</Text>
      <Text style={styles.line2}>HERO</Text>
      <Text style={styles.tagline}>स्वच्छता ही सेवा</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  line1: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1e3a5f',
    letterSpacing: 1.2,
  },
  line2: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f97316',
    letterSpacing: 1.2,
    marginTop: -4,
  },
  tagline: {
    fontSize: 16,
    color: '#475569',
    marginTop: 6,
    fontWeight: '600',
  },
  fadedWrap: {
    alignItems: 'center',
    opacity: 0.5,
  },
  fadedLine1: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.3,
  },
  fadedLine2: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
});
