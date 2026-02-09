import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

const logoSource = require('../assets/logo.jpeg');

type AppLogoProps = {
  size?: 'small' | 'medium' | 'large';
  style?: object;
};

const sizes = { small: 48, medium: 80, large: 120 };

export default function AppLogo({ size = 'medium', style }: AppLogoProps) {
  const s = sizes[size];
  return (
    <View style={[styles.wrap, { width: s * 1.6, height: s }, style]}>
      <Image
        source={logoSource}
        style={[styles.logo, { width: s * 1.6, height: s }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  logo: {},
});
