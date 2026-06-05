import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  status: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  loadAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  
  setAuth: async (user, accessToken, refreshToken) => {
    set({ user, accessToken, refreshToken });
    await AsyncStorage.setItem('auth', JSON.stringify({ user, accessToken, refreshToken }));
  },
  
  clearAuth: async () => {
    set({ user: null, accessToken: null, refreshToken: null });
    await AsyncStorage.removeItem('auth');
  },
  
  loadAuth: async () => {
    try {
      const authData = await AsyncStorage.getItem('auth');
      if (authData) {
        const { user, accessToken, refreshToken } = JSON.parse(authData);
        set({ user, accessToken, refreshToken });
      }
    } catch (error) {
      console.error('Failed to load auth data:', error);
    }
  },
}));
