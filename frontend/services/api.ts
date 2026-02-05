// API service for FlickX
import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { getAuthToken } from './authStorage';

const getDevHost = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.hostUri ??
    Constants.manifest?.debuggerHost;
  if (!hostUri) return null;
  return hostUri.split(':')[0];
};

// Android Emulator: 10.0.2.2 points to the host machine.
const API_HOST =
  Platform.OS === 'android'
    ? (Constants.isDevice ? getDevHost() ?? 'localhost' : '10.0.2.2')
    : Platform.OS === 'web'
      ? 'localhost'
      : getDevHost() ?? 'localhost';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? `http://${API_HOST}:5000/api`; // Update with production URL as needed

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getAuthToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (__DEV__) {
      const baseURL = error?.config?.baseURL;
      const url = error?.config?.url;
      const method = error?.config?.method;
      console.log('API request failed:', { method, baseURL, url, message: error?.message });
    }
    return Promise.reject(error);
  }
);

// Example: Fetch trending movies
export const fetchTrendingMovies = async () => {
  const response = await api.get('/movies');
  return response.data;
};

// TMDB proxy endpoints
export const fetchTmdbTrendingMovies = async (
  timeWindow: 'day' | 'week' = 'week',
  page = 1
) => {
  const response = await api.get('/tmdb/trending', {
    params: { time_window: timeWindow, page },
  });
  return response.data;
};

export const fetchTmdbGenres = async () => {
  const response = await api.get('/tmdb/genres');
  return response.data;
};

export const fetchTmdbDiscover = async (params: {
  sort_by?: string;
  with_genres?: string;
  primary_release_year?: string;
  page?: number;
}) => {
  const response = await api.get('/tmdb/discover', { params });
  return response.data;
};

export const searchTmdbMovies = async (query: string, page = 1) => {
  const response = await api.get('/tmdb/search', { params: { query, page } });
  return response.data;
};

// Example: Fetch recommendations for a user
export const fetchRecommendations = async (userId: number) => {
  const response = await api.get(`/recommendations/user/${userId}`);
  return response.data;
};

// Example: Search movies
export const searchMovies = async (q: string, genre?: string) => {
  const params: any = { q };
  if (genre) params.genre = genre;
  const response = await api.get('/search', { params });
  return response.data;
};

// Example: Fetch notifications for a user
export const fetchNotifications = async (userId: number) => {
  const response = await api.get(`/notifications/${userId}`);
  return response.data;
};

// Add more API methods for movies, reviews, users, etc.
