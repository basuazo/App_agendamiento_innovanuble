import api from './api';
import { Space } from '../types';

export const spaceService = {
  getAll: () => api.get<Space[]>('/spaces').then((r) => r.data),

  create: (data: { name: string }) =>
    api.post<Space>('/spaces', data).then((r) => r.data),

  update: (id: string, data: { name?: string; isActive?: boolean }) =>
    api.put<Space>(`/spaces/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/spaces/${id}`).then((r) => r.data),
};
