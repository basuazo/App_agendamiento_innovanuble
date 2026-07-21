import api from './api';
import { AuthResponse, User } from '../types';

export const authService = {
  login: (username: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { username, password }).then((r) => r.data),

  register: (name: string, username: string, password: string, spaceId: string, organization: string) =>
    api.post<{ message: string }>('/auth/register', { name, username, password, spaceId, organization }).then((r) => r.data),

  getMe: () => api.get<User>('/auth/me').then((r) => r.data),

  updateProfile: (data: { name?: string; organization?: string; phone?: string }) =>
    api.patch<User>('/auth/me', data).then((r) => r.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch('/auth/me/password', { currentPassword, newPassword }).then((r) => r.data),
};
