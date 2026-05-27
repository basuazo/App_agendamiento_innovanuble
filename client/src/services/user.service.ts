import api from './api';
import { User, Role, UserSummary } from '../types';

export const userService = {
  getAll: () => api.get<{ data: User[] }>('/users').then((r) => r.data.data),

  create: (data: { name: string; email: string; organization?: string; phone?: string; password: string; role?: Role; spaceId?: string }) =>
    api.post<User>('/users', data).then((r) => r.data),

  update: (id: string, data: { name?: string; email?: string; organization?: string; phone?: string; password?: string; spaceId?: string }) =>
    api.patch<User>(`/users/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/users/${id}`).then((r) => r.data),

  changeRole: (id: string, role: Role) =>
    api.patch<User>(`/users/${id}/role`, { role }).then((r) => r.data),

  verify: (id: string) =>
    api.patch<User>(`/users/${id}/verify`).then((r) => r.data),

  getSummary: (id: string) =>
    api.get<UserSummary>(`/users/${id}/summary`).then((r) => r.data),

  exportAll: () =>
    api.get('/users/export', { responseType: 'blob' }).then((r) => {
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'usuarias.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    }),

  exportSummary: (id: string, name: string) =>
    api.get(`/users/${id}/export`, { responseType: 'blob' }).then((r) => {
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      const safeName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
      a.download = `usuaria_${safeName}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    }),
};
