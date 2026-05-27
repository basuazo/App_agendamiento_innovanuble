import api from './api';
import { Training, TrainingEnrollment } from '../types';

export interface CreateTrainingDto {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  capacity?: number;
  exemptResourceIds?: string[];
}

export interface UpdateTrainingDto {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  capacity?: number;
}

export const trainingService = {
  getAll: () => api.get<Training[]>('/trainings').then((r) => r.data),

  create: (data: CreateTrainingDto) =>
    api.post<Training>('/admin/trainings', data).then((r) => r.data),

  update: (id: string, data: UpdateTrainingDto) =>
    api.patch<Training>(`/admin/trainings/${id}`, data).then((r) => r.data),

  remove: (id: string) => api.delete(`/admin/trainings/${id}`),

  updateExemptions: (id: string, exemptResourceIds: string[]) =>
    api.patch<Training>(`/admin/trainings/${id}/exemptions`, { exemptResourceIds }).then((r) => r.data),

  enroll: (id: string, targetUserId?: string) =>
    api.post<TrainingEnrollment>(`/trainings/${id}/enroll`, targetUserId ? { targetUserId } : {}).then((r) => r.data),

  unenroll: (id: string, targetUserId?: string) =>
    api.delete(`/trainings/${id}/enroll`, { data: targetUserId ? { targetUserId } : undefined }),

  exportAll: () =>
    api.get('/admin/trainings/export', { responseType: 'blob' }).then((r) => r.data as Blob),
};
