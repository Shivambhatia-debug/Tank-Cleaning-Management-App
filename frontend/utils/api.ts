import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const BACKEND_PORT = 8002;

const getBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL.replace(/\/$/, '');
  }

  // Same machine as Expo/Metro (works for device on same LAN and iOS simulator)
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest?.hostUri;
  const host = hostUri?.split(':')[0];

  if (host) {
    return `http://${host}:${BACKEND_PORT}`;
  }

  // Fallback: Android emulator uses 10.0.2.2 to reach host's localhost; iOS simulator uses localhost
  const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${fallbackHost}:${BACKEND_PORT}`;
};

const API_URL = getBaseUrl();

if (__DEV__) {
  console.log('[API] Backend URL:', API_URL);
}

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // FormData: do not set Content-Type so RN can set multipart/form-data with boundary
  if (config.data && typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(fn: () => void) {
  onUnauthorized = fn;
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;
    const message = (err.response?.data?.message || '').toLowerCase();
    const isAuthError = status === 401 || (status === 400 && message.includes('token'));
    if (isAuthError) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      onUnauthorized?.();
    }
    return Promise.reject(err);
  }
);

export default api;
export const getUploadsBaseUrl = (): string => getBaseUrl();
export const getApiBaseUrl = (): string => `${getBaseUrl()}/api`;

/**
 * Resolve a photo path to a full URL for loading in Image.
 * Uses this device's getBaseUrl() so admin/staff on any device load from the backend they can reach.
 */
export function resolvePhotoUrl(photo: string | null | undefined): string | null {
  if (!photo || typeof photo !== 'string') return null;
  const base = getBaseUrl();
  const clean = base.replace(/\/$/, '');
  // Already full URL (e.g. Vercel Blob): use as-is unless it's our /uploads/ (then rewrite to device base)
  if (photo.startsWith('http://') || photo.startsWith('https://')) {
    try {
      const url = new URL(photo);
      if (url.pathname.includes('/uploads/')) return `${clean}${url.pathname}`;
    } catch {
      // ignore
    }
    return photo;
  }
  // Normalize path (Windows backslash, duplicate uploads)
  let path = String(photo).trim().replace(/\\/g, '/');
  if (path.startsWith('uploads/')) path = path.slice(8);
  if (path.startsWith('/uploads/')) path = path.slice(9);
  return `${clean}/uploads/${path}`;
}
