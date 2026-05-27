import api from './api';
import { Maintenance } from '../types';

export const maintenanceService = {
  getAll: () => api.get<Maintenance[]>('/maintenances').then((r) => r.data),

  create: (data: { title: string; description?: string; startTime: string; endTime: string }) =>
    api.post<Maintenance>('/admin/maintenances', data).then((r) => r.data),

  update: (id: string, data: { title?: string; description?: string; startTime?: string; endTime?: string }) =>
    api.patch<Maintenance>(`/admin/maintenances/${id}`, data).then((r) => r.data),

  remove: (id: string) => api.delete(`/admin/maintenances/${id}`).then((r) => r.data),
};
