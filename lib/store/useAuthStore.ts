import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  subscriptionType: 'free' | 'premium';
}

interface AuthState {
  // Authentication state
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;

  // Data mode: 'local' or 'cloud'
  dataMode: 'local' | 'cloud';

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  setDataMode: (mode: 'local' | 'cloud') => void;

  // Check if user can use cloud features
  canUseCloudFeatures: () => boolean;

  // Fetch user session from server
  fetchSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      token: null,
      dataMode: 'local',

      // Actions
      setUser: (user) => {
        set({
          user,
          isAuthenticated: !!user,
        });
      },

      setToken: (token) => {
        set({ token });
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          // 先调用后端 API 清除 Supabase session
          await fetch('/api/auth/signout', { method: 'POST' });
        } catch (error) {
          console.error('Failed to sign out from server:', error);
        } finally {
          // 无论 API 调用成功与否，都清除本地状态
          set({
            user: null,
            isAuthenticated: false,
            token: null,
            dataMode: 'local',
            isLoading: false,
          });
        }
      },

      setDataMode: (mode) => {
        set({ dataMode: mode });
      },

      canUseCloudFeatures: () => {
        const { user, dataMode } = get();
        return dataMode === 'cloud' && !!user;
      },

      fetchSession: async () => {
        set({ isLoading: true });
        try {
          const res = await fetch('/api/auth/session');
          const data = await res.json();

          if (data.authenticated && data.user) {
            set({
              user: {
                id: data.user.id,
                email: data.user.email,
                fullName: data.user.fullName,
                avatarUrl: data.user.avatarUrl,
                subscriptionType: 'free', // Will be updated by /api/auth/user
              },
              isAuthenticated: true,
              token: data.accessToken || null,
              dataMode: 'cloud',
            });
          } else {
            // Not authenticated, keep local mode
            set({
              user: null,
              isAuthenticated: false,
              token: null,
              dataMode: 'local',
            });
          }
        } catch (error) {
          console.error('Failed to fetch session:', error);
          // On error, assume not authenticated
          set({
            user: null,
            isAuthenticated: false,
            token: null,
            dataMode: 'local',
          });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      // Only persist essential data
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        dataMode: state.dataMode,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
