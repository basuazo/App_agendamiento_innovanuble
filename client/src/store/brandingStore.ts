import { create } from 'zustand';

interface BrandingState {
  logoUrl: string | null;
  primaryColor: string | null;
  set: (data: { logoUrl: string | null; primaryColor: string | null }) => void;
  reset: () => void;
}

export const useBrandingStore = create<BrandingState>((set) => ({
  logoUrl: null,
  primaryColor: null,
  set: (data) => set(data),
  reset: () => set({ logoUrl: null, primaryColor: null }),
}));
