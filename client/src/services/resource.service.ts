import api from './api';
import { Resource } from '../types';

export interface ResourceDto {
  name: string;
  description?: string;
  categoryId: string;
  requiresCertification?: boolean;
  capacity?: number;
  imageUrl?: string;
}

export const resourceService = {
  getAll: (includeInactive = false) =>
    api.get<Resource[]>(`/resources${includeInactive ? '?all=true' : ''}`).then((r) => r.data),

  getById: (id: string) => api.get<Resource>(`/resources/${id}`).then((r) => r.data),

  create: (data: ResourceDto) =>
    api.post<Resource>('/resources', data).then((r) => r.data),

  update: (id: string, data: ResourceDto) =>
    api.put<Resource>(`/resources/${id}`, data).then((r) => r.data),

  toggle: (id: string) =>
    api.patch<Resource>(`/resources/${id}/toggle`).then((r) => r.data),

  remove: (id: string) => api.delete(`/resources/${id}`),
};
