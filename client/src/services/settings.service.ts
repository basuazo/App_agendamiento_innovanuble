import api from './api';
import { BusinessHours, SpaceCustomization, SpaceSettings } from '../types';

export const settingsService = {
  getBusinessHours: async (): Promise<SpaceSettings> => {
    const res = await api.get<SpaceSettings>('/settings/business-hours');
    return res.data;
  },

  updateBusinessHours: async (
    days: Pick<BusinessHours, 'dayOfWeek' | 'isOpen' | 'openTime' | 'closeTime'>[],
    maxCapacity: number,
    maxCapacityReunion: number,
    maxBookingMinutes: number,
    lunchBreakEnabled: boolean,
    lunchBreakStart: string | null,
    lunchBreakEnd: string | null,
  ): Promise<SpaceSettings> => {
    const res = await api.put<SpaceSettings>('/settings/business-hours', { days, maxCapacity, maxCapacityReunion, maxBookingMinutes, lunchBreakEnabled, lunchBreakStart, lunchBreakEnd });
    return res.data;
  },

  getCustomization: async (): Promise<SpaceCustomization> => {
    const res = await api.get<SpaceCustomization>('/settings/customization');
    return res.data;
  },

  updateColors: async (primaryColor: string | null): Promise<SpaceCustomization> => {
    const res = await api.put<SpaceCustomization>('/settings/customization/colors', { primaryColor });
    return res.data;
  },

};
