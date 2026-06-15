import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Para emulador Android (desenvolvimento local): 'http://10.0.2.2:3000'
// Para device físico ou build de teste (passando pelo proxy reverso do Nginx na porta 80):
export const BASE_URL = 'http://163.176.47.4/api';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Lida com expiração de token (401) e tenta refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const res = await axios.post(`${BASE_URL}/auth/refresh`, {}, {
          headers: { Authorization: `Bearer ${await SecureStore.getItemAsync('jwt_token')}` }
        });
        const newToken = res.data.token;
        await SecureStore.setItemAsync('jwt_token', newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (e) {
        // Refresh falhou, usuário deve ser deslogado. Isso será tratado pela store.
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);
