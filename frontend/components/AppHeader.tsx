import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppLogo from './AppLogo';
import BrandText from './BrandText';

const FONT_MEDIUM = Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: 'System' });
const FONT_REGULAR = Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'System' });

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
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
        </TouchableOpacity>
      ) : <View style={styles.logoutBtn} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
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
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: FONT_MEDIUM,
  },
  titleCompact: {
    fontSize: 15,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
    fontFamily: FONT_REGULAR,
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
