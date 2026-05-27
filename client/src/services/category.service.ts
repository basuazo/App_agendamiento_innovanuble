import api from './api';
import { Category } from '../types';

export interface CategoryDto {
  name: string;
  color?: string;
  order?: number;
}

export const categoryService = {
  getAll: (includeInactive = false) =>
    api.get<Category[]>('/categories', { params: includeInactive ? { all: 'true' } : {} })
      .then((r) => r.data),

  create: (data: CategoryDto) =>
    api.post<Category>('/categories', data).then((r) => r.data),

  update: (id: string, data: Partial<CategoryDto & { isActive: boolean }>) =>
    api.put<Category>(`/categories/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/categories/${id}`).then((r) => r.data),

  reorder: (items: { id: string; order: number }[]) =>
    api.put('/categories/reorder', items).then((r) => r.data),
};
