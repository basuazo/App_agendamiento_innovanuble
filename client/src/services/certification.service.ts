import api from './api';
import { Certification } from '../types';

export const certificationService = {
  // Usuario
  getMyCertifications: () =>
    api.get<Certification[]>('/certifications/mine').then((r) => r.data),

  // Admin / roles elevados
  getAllCertifications: (userId?: string) =>
    api
      .get<Certification[]>('/admin/certifications', { params: userId ? { userId } : undefined })
      .then((r) => r.data),

  certifyUser: (userId: string, categoryId: string, notes?: string) =>
    api
      .post<Certification>('/admin/certifications', { userId, categoryId, notes })
      .then((r) => r.data),

  revokeCertification: (id: string) =>
    api.delete(`/admin/certifications/${id}`).then((r) => r.data),
};
