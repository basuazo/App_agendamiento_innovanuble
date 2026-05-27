import { useState, useEffect } from 'react';
import { Resource, Category } from '../../types';
import { useResourceStore } from '../../store/resourceStore';
import { categoryService } from '../../services/category.service';
import toast from 'react-hot-toast';

interface Props {
  resource?: Resource;
  onClose: () => void;
}

export default function ResourceForm({ resource, onClose }: Props) {
  const { create, update } = useResourceStore();
  const [name, setName] = useState(resource?.name ?? '');
  const [description, setDescription] = useState(resource?.description ?? '');
  const [categoryId, setCategoryId] = useState(resource?.categoryId ?? '');
  const [requiresCertification, setRequiresCertification] = useState(resource?.requiresCertification ?? true);
  const [imageUrl, setImageUrl] = useState(resource?.imageUrl ?? '');
  const [capacity, setCapacity] = useState(resource?.capacity ?? 1);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    categoryService.getAll().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (resource) {
      setName(resource.name);
      setDescription(resource.description ?? '');
      setCategoryId(resource.categoryId);
      setRequiresCertification(resource.requiresCertification);
      setImageUrl(resource.imageUrl ?? '');
      setCapacity(resource.capacity ?? 1);
    }
  }, [resource]);

  useEffect(() => {
    if (!resource && categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [categories, resource, categoryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (resource) {
        await update(resource.id, { name, description, categoryId, requiresCertification, imageUrl, capacity });
        toast.success('Recurso actualizado');
      } else {
        await create({ name, description, categoryId, requiresCertification, imageUrl, capacity });
        toast.success('Recurso creado');
      }
      onClose();
    } catch {
      toast.error('Error al guardar el recurso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            {resource ? 'Editar Recurso' : 'Nuevo Recurso'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {categories.length === 0 && <option value="">Cargando categorías...</option>}
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad simultánea *</label>
              <input
                type="number"
                value={capacity}
                min={1}
                max={20}
                onChange={(e) => setCapacity(Number(e.target.value))}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-xs text-gray-400 mt-1">Cantidad máxima de reservas simultáneas (1 para uso exclusivo)</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="requiresCertification"
                checked={requiresCertification}
                onChange={(e) => setRequiresCertification(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded"
              />
              <label htmlFor="requiresCertification" className="text-sm text-gray-700">
                Requiere certificación para reservar directamente
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL de imagen (opcional)</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !categoryId}
                className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
              >
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
