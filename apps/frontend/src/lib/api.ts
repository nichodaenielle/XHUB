import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
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
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/auth/refresh`,
          { refreshToken },
        );

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
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
  
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  
  register: async (data: { email: string; username: string; password: string; displayName: string }) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },
  
  refresh: async (refreshToken: string) => {
    const response = await api.post('/auth/refresh', { refreshToken });
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

// Workspaces API functions
export const workspacesApi = {
  getWorkspaces: async () => {
    const response = await api.get('/workspaces');
    return response.data;
  },
  
  getWorkspace: async (id: string) => {
    const response = await api.get(`/workspaces/${id}`);
    return response.data;
  },
  
  getWorkspaceMembers: async (id: string) => {
    const response = await api.get(`/workspaces/${id}/members`);
    return response.data;
  },
};

// Channels API functions
export const channelsApi = {
  getWorkspaceChannels: async (workspaceId: string) => {
    const response = await api.get(`/channels/workspace/${workspaceId}`);
    return response.data;
  },
  
  getChannel: async (id: string) => {
    const response = await api.get(`/channels/${id}`);
    return response.data;
  },
  
  createDirectChannel: async (userId: string) => {
    const response = await api.post('/channels/direct', { userId });
    return response.data;
  },
};

// Messages API functions
export const messagesApi = {
  getChannelMessages: async (channelId: string, limit?: number, offset?: number) => {
    const params: any = {};
    if (limit) params.limit = limit;
    if (offset) params.offset = offset;
    const response = await api.get(`/messages/channel/${channelId}`, { params });
    return response.data;
  },
  
  createMessage: async (data: { channelId: string; content: string; replyToId?: string }) => {
    const response = await api.post('/messages', data);
    return response.data;
  },
  
  addReaction: async (messageId: string, emoji: string) => {
    const response = await api.post(`/messages/${messageId}/reactions`, { emoji });
    return response.data;
  },
  
  removeReaction: async (messageId: string, emoji: string) => {
    const response = await api.delete(`/messages/${messageId}/reactions`, { data: { emoji } });
    return response.data;
  },
};

export default api;
