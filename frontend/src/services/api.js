// src/services/api.js - Cliente da API (NUNCA incluir credenciais Tuya aqui)
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  withCredentials: true, // Para enviar cookies httpOnly
});

// Interceptor: Adicionar token JWT nos headers
api.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: Tratar erros de autenticação
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      const code = error.response.data?.code;
      if (code === 'TOKEN_EXPIRED' || error.response.data?.error?.includes('Token')) {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// =====================================
// Auth
// =====================================
export const authAPI = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }),

  logout: () =>
    api.post('/auth/logout'),

  me: () =>
    api.get('/auth/me'),

  changePassword: (currentPassword, newPassword) =>
    api.put('/auth/change-password', { currentPassword, newPassword }),
};

// =====================================
// Dispositivos
// =====================================
export const devicesAPI = {
  getAll: () =>
    api.get('/devices'),

  getStatus: (id) =>
    api.get(`/devices/${id}/status`),

  testConnection: () =>
    api.get('/devices/test-connection'),

  toggle: (id, state, type = 'switch', switchNum = 1) =>
    api.post(`/devices/${id}/toggle`, { state, type, switchNum }),

  // Interruptor multi-botão — controla botão específico (1,2,3...)
  switchGang: (id, gangNum, state) =>
    api.post(`/devices/${id}/switch/${gangNum}`, { state }),

  // Desliga/liga todos os botões de uma vez
  switchAll: (id, state, gangCount) =>
    api.post(`/devices/${id}/switch-all`, { state, gangCount }),

  sendCommand: (id, commands) =>
    api.post(`/devices/${id}/command`, { commands: Array.isArray(commands) ? commands : [commands] }),

  setBrightness: (id, value) =>
    api.post(`/devices/${id}/brightness`, { value }),

  setColor: (id, h, s, v) =>
    api.post(`/devices/${id}/color`, { h, s, v }),

  setColorTemp: (id, value) =>
    api.post(`/devices/${id}/color-temp`, { value }),

  // ── Câmera ──
  cameraPtz: (id, direction) =>
    api.post(`/devices/${id}/camera/ptz`, { direction }),

  cameraFloodLight: (id, state) =>
    api.post(`/devices/${id}/camera/floodlight`, { state }),

  cameraSiren: (id, state) =>
    api.post(`/devices/${id}/camera/siren`, { state }),

  cameraMotion: (id, state) =>
    api.post(`/devices/${id}/camera/motion`, { state }),

  cameraPrivacy: (id, state) =>
    api.post(`/devices/${id}/camera/privacy`, { state }),

  cameraNightVision: (id, mode) =>
    api.post(`/devices/${id}/camera/nightvision`, { mode }),

  cameraSnapshot: (id) =>
    api.get(`/devices/${id}/camera/snapshot`),
};

// =====================================
// Automações
// =====================================
export const automationsAPI = {
  getAll: () =>
    api.get('/automations'),

  create: (data) =>
    api.post('/automations', data),

  update: (id, data) =>
    api.put(`/automations/${id}`, data),

  delete: (id) =>
    api.delete(`/automations/${id}`),

  run: (id) =>
    api.post(`/automations/${id}/run`),

  getLogs: (id) =>
    api.get(`/automations/${id}/logs`),
};

// =====================================
// Configurações
// =====================================
export const settingsAPI = {
  get: () =>
    api.get('/settings'),

  update: (data) =>
    api.put('/settings', data),
};

export default api;
