import api from './api';
import { Booking, ResourceAvailability } from '../types';

export interface UpdateBookingDto {
  startTime?: string;
  endTime?: string;
  notes?: string;
  localDate?: string;
  localStartTime?: string;
  localEndTime?: string;
}

export interface CreateBookingDto {
  resourceId: string;
  startTime: string;
  endTime: string;
  purpose: 'LEARN' | 'PRODUCE' | 'DESIGN' | 'REUNION';
  produceItem?: string;
  produceQty?: number;
  quantity?: number;
  notes?: string;
  isPrivate?: boolean;
  attendees?: number;
  companionRelation?: 'CUIDADOS' | 'AMISTAD' | 'OTRO';
  targetUserId?: string;
  /** Fecha local YYYY-MM-DD y horas HH:MM — usadas en el servidor para validar horario de negocio sin ambigüedad de zona horaria */
  localDate?: string;
  localStartTime?: string;
  localEndTime?: string;
}

export const bookingService = {
  getAll: () => api.get<Booking[]>('/bookings').then((r) => r.data),

  getMine: () => api.get<Booking[]>('/bookings/mine').then((r) => r.data),

  getAdminAll: () => api.get<Booking[]>('/bookings/admin/all').then((r) => r.data),

  create: (data: CreateBookingDto) =>
    api.post<Booking>('/bookings', data).then((r) => r.data),

  update: (id: string, data: UpdateBookingDto) =>
    api.patch<Booking>(`/bookings/${id}`, data).then((r) => r.data),

  cancel: (id: string) =>
    api.patch<Booking>(`/bookings/${id}/cancel`).then((r) => r.data),

  approve: (id: string) =>
    api.patch<Booking>(`/bookings/${id}/approve`).then((r) => r.data),

  reject: (id: string) =>
    api.patch<Booking>(`/bookings/${id}/reject`).then((r) => r.data),

  getAvailability: (startTime: string, endTime: string) =>
    api
      .get<ResourceAvailability>('/bookings/availability', { params: { startTime, endTime } })
      .then((r) => r.data),

  exportExcel: () =>
    api.get('/bookings/export', { responseType: 'blob' }).then((r) => r.data as Blob),
};
