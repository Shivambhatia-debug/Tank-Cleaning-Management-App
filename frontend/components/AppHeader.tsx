import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppLogo from './AppLogo';
import BrandText from './BrandText';

type AppHeaderProps = {
  title?: string;
  subtitle?: string;
  onLogout?: () => void;
  showLogo?: boolean;
  compact?: boolean;
};

export default function AppHeader({
  title,
  subtitle,
  onLogout,
  showLogo = false,
  compact = false,
}: AppHeaderProps) {
  return (
    <View style={[styles.header, compact && styles.headerCompact]}>
      {showLogo && (
        <View style={styles.logoWrap}>
          <AppLogo size={compact ? 'small' : 'medium'} />
        </View>
      )}
      <View style={styles.content}>
        {title ? <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={1}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={styles.brandWrap}>
        <BrandText faded />
      </View>
      {onLogout ? (
        <TouchableOpacity onPress={onLogout} style={styles.logoutBtn} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={22} color="#FF3B30" />
        </TouchableOpacity>
      ) : <View style={styles.logoutBtn} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  headerCompact: {
    paddingVertical: 8,
  },
  logoWrap: {
    marginRight: 12,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  titleCompact: {
    fontSize: 15,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  brandWrap: {
    marginRight: 8,
  },
  logoutBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
