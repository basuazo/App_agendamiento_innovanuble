import api from './api';
import type { Notification } from '../types';

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

export const notificationService = {
  getAll: (): Promise<NotificationsResponse> =>
    api.get('/notifications').then((r) => r.data),

  markAsRead: (id: string): Promise<void> =>
    api.patch(`/notifications/${id}/read`).then(() => undefined),

  markAllAsRead: (): Promise<void> =>
    api.patch('/notifications/read-all').then(() => undefined),
};
