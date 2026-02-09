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

export default api;
export const getUploadsBaseUrl = (): string => getBaseUrl();
export const getApiBaseUrl = (): string => `${getBaseUrl()}/api`;
