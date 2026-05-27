import { create } from 'zustand';
import { Resource } from '../types';
import { resourceService, ResourceDto } from '../services/resource.service';

interface ResourceState {
  resources: Resource[];
  isLoading: boolean;
  fetchAll: (includeInactive?: boolean) => Promise<void>;
  create: (data: ResourceDto) => Promise<void>;
  update: (id: string, data: ResourceDto) => Promise<void>;
  toggle: (id: string) => Promise<void>;
}

export const useResourceStore = create<ResourceState>((set, get) => ({
  resources: [],
  isLoading: false,

  fetchAll: async (includeInactive = false) => {
    set({ isLoading: true });
    const resources = await resourceService.getAll(includeInactive);
    set({ resources, isLoading: false });
  },

  create: async (data) => {
    const resource = await resourceService.create(data);
    set({ resources: [...get().resources, resource] });
  },

  update: async (id, data) => {
    const updated = await resourceService.update(id, data);
    set({ resources: get().resources.map((r) => (r.id === id ? updated : r)) });
  },

  toggle: async (id) => {
    const updated = await resourceService.toggle(id);
    set({ resources: get().resources.map((r) => (r.id === id ? updated : r)) });
  },
}));
