import api from './api';
import { AuthResponse, User } from '../types';

export const authService = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data),

  register: (name: string, email: string, password: string, spaceId: string, organization: string) =>
    api.post<{ message: string }>('/auth/register', { name, email, password, spaceId, organization }).then((r) => r.data),

  getMe: () => api.get<User>('/auth/me').then((r) => r.data),

  updateProfile: (data: { name?: string; email?: string; organization?: string; phone?: string }) =>
    api.patch<User>('/auth/me', data).then((r) => r.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch('/auth/me/password', { currentPassword, newPassword }).then((r) => r.data),
};
