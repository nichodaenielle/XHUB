import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(async (config) => {
  const { accessToken } = await import('../store/auth.store').then(m => m.useAuthStore.getState());
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { refreshToken, setAuth, clearAuth } = await import('../store/auth.store').then(m => m.useAuthStore.getState());
        
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        
        await setAuth(response.data.user, accessToken, newRefreshToken);
        
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        const { clearAuth } = await import('../store/auth.store').then(m => m.useAuthStore.getState());
        await clearAuth();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

// Auth API functions
export const authApi = {
  loginRecap: async (email: string, password: string) => {
    const response = await api.post('/auth/login-recap', { email, password });
    return response.data;
  },
  
  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
  
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

export default api;
