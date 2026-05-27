import { create } from 'zustand';
import { Booking } from '../types';
import { bookingService, CreateBookingDto } from '../services/booking.service';

interface BookingState {
  bookings: Booking[];
  myBookings: Booking[];
  isLoading: boolean;
  fetchAll: () => Promise<void>;
  fetchMine: () => Promise<void>;
  create: (data: CreateBookingDto) => Promise<Booking>;
  cancel: (id: string) => Promise<void>;
}

export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: [],
  myBookings: [],
  isLoading: false,

  fetchAll: async () => {
    set({ isLoading: true });
    const bookings = await bookingService.getAll();
    set({ bookings, isLoading: false });
  },

  fetchMine: async () => {
    set({ isLoading: true });
    const myBookings = await bookingService.getMine();
    set({ myBookings, isLoading: false });
  },

  create: async (data) => {
    const booking = await bookingService.create(data);
    set({ bookings: [...get().bookings, booking] });
    return booking;
  },

  cancel: async (id) => {
    await bookingService.cancel(id);
    set({
      bookings: get().bookings.filter((b) => b.id !== id),
      myBookings: get().myBookings.map((b) =>
        b.id === id ? { ...b, status: 'CANCELLED' as const } : b
      ),
    });
  },
}));
