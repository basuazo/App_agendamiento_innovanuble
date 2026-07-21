import { create } from 'zustand';
import { User } from '../types';
import { authService } from '../services/auth.service';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  currentSpaceId: string | null; // SUPER_ADMIN: espacio seleccionado actualmente
  login: (username: string, password: string) => Promise<void>;
  register: (name: string, username: string, password: string, spaceId: string, organization: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  updateProfile: (data: { name?: string; organization?: string; phone?: string }) => Promise<void>;
  setCurrentSpace: (spaceId: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: !!localStorage.getItem('token'), // true si hay token pendiente de verificar
  currentSpaceId: localStorage.getItem('currentSpaceId'),

  login: async (username, password) => {
    const { user, token } = await authService.login(username, password);
    localStorage.setItem('token', token);
    set({ user, token });
  },

  register: async (name, username, password, spaceId, organization) => {
    await authService.register(name, username, password, spaceId, organization);
    // No token returned — account requires admin verification before login
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentSpaceId');
    set({ user: null, token: null, currentSpaceId: null });
  },

  loadUser: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    set({ isLoading: true });
    try {
      const user = await authService.getMe();
      set({ user, isLoading: false });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, isLoading: false });
    }
  },

  updateProfile: async (data) => {
    const user = await authService.updateProfile(data);
    set({ user });
  },

  setCurrentSpace: (spaceId) => {
    if (spaceId) {
      localStorage.setItem('currentSpaceId', spaceId);
    } else {
      localStorage.removeItem('currentSpaceId');
    }
    set({ currentSpaceId: spaceId });
  },
}));
