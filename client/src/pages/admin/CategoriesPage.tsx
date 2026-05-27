import { useEffect, useMemo, useState } from 'react';
import { Category } from '../../types';
import { categoryService } from '../../services/category.service';
import { useAuthStore } from '../../store/authStore';
import ConfirmModal from '../../components/shared/ConfirmModal';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import SortableHeader, { SortState, toggleSort, compareVals } from '../../components/shared/SortableHeader';
import toast from 'react-hot-toast';

// Naranja/ámbar reservado para Capacitaciones — no disponible para categorías
const PRESET_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#10b981',
  '#ef4444', '#6b7280', '#06b6d4', '#84cc16', '#0ea5e9',
  '#a855f7', '#14b8a6', '#e11d48',
];

// Devuelve true si el color cae en el rango naranja/ámbar (hue 20–55°)
function isOrangeHue(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return false;
  let h = 0;
  if (max === r) h = ((g - b) / (max - min) + 6) % 6 * 60;
  else if (max === g) h = ((b - r) / (max - min) + 2) * 60;
  else h = ((r - g) / (max - min) + 4) * 60;
  return h >= 20 && h <= 55;
}

interface FormState {
  name: string;
  color: string;
}

const EMPTY_FORM: FormState = { name: '', color: '#6b7280' };

export default function CategoriesPage() {
  const { currentSpaceId } = useAuthStore();
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState | null>(null);
  const handleSort = (key: string) => setSort(toggleSort(sort, key));

  const categories = useMemo(
    () => showInactive ? allCategories : allCategories.filter((c) => c.isActive),
    [allCategories, showInactive]
  );
  const inactiveCount = useMemo(() => allCategories.filter((c) => !c.isActive).length, [allCategories]);

  const displayCategories = useMemo(() => {
    const q = search.toLowerCase();
    const list = q
      ? categories.filter((c) =>
          c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
        )
      : categories;
    if (!sort) return list;
    return [...list].sort((a, b) => {
      const val = (x: Category) =>
        sort.key === 'name' ? x.name :
        sort.key === 'slug' ? x.slug : '';
      return compareVals(val(a), val(b), sort.dir);
    });
  }, [categories, search, sort]);

  const load = async () => {
    try {
      setIsLoading(true);
      setAllCategories(await categoryService.getAll(true));
    } catch {
      toast.error('Error al cargar categorías');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [currentSpaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({ name: cat.name, color: cat.color });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return; }
    if (isOrangeHue(form.color)) { toast.error('El naranja/ámbar está reservado para Capacitaciones'); return; }
    setSaving(true);
    try {
      if (editing) {
        await categoryService.update(editing.id, form);
        toast.success('Categoría actualizada');
      } else {
        await categoryService.create(form);
        toast.success('Categoría creada');
      }
      setShowForm(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Error al guardar categoría');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await categoryService.delete(deleteTarget.id);
      toast.success('Categoría eliminada');
      setDeleteTarget(null);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Error al eliminar categoría');
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorías de Recursos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona las categorías de máquinas y espacios del cowork.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar categoría..."
            className="w-52 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
            Nueva Categoría
          </button>
        </div>
      </div>

      {inactiveCount > 0 && (
        <div className="mb-4 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm">
          <span className="text-amber-800">
            Hay {inactiveCount} categoría{inactiveCount > 1 ? 's' : ''} inactiva{inactiveCount > 1 ? 's' : ''} oculta{inactiveCount > 1 ? 's' : ''}.
          </span>
          <button
            onClick={() => setShowInactive((v) => !v)}
            className="text-amber-700 underline font-medium hover:text-amber-900 ml-4"
          >
            {showInactive ? 'Ocultar inactivas' : 'Ver y eliminar inactivas'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {displayCategories.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No hay categorías creadas aún.
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <SortableHeader label="Categoría" sortKey="name" sort={sort} onSort={handleSort} className="text-left" />
                <SortableHeader label="Slug" sortKey="slug" sort={sort} onSort={handleSort} className="text-left hidden md:table-cell" />
                <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayCategories.map((cat) => (
                <tr key={cat.id} className={cat.isActive ? '' : 'bg-gray-50 opacity-70'}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0 border border-white shadow-sm"
                        style={{ backgroundColor: cat.color }}
                      />
                      <div>
                        <span className="font-medium text-gray-900">{cat.name}</span>
                        {!cat.isActive && (
                          <span className="ml-2 text-xs text-gray-400">(inactiva)</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <code className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {cat.slug}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {cat.isActive && (
                        <button
                          onClick={() => openEdit(cat)}
                          className="text-xs text-brand-600 hover:text-brand-800 font-medium transition-colors"
                        >
                          Editar
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(cat)}
                        className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Modal de formulario */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-5">
              {editing ? 'Editar Categoría' : 'Nueva Categoría'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="Ej: Recta Casera"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, color: c }))}
                      className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: form.color === c ? '#1e40af' : 'transparent',
                      }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                  />
                  <span className="text-xs text-gray-500 font-mono">{form.color}</span>
                </div>
                {isOrangeHue(form.color) && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <span>⚠️</span> El naranja/ámbar está reservado para Capacitaciones
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {deleteTarget && (
        <ConfirmModal
          title="Eliminar categoría"
          message={`¿Estás segura que quieres eliminar la categoría "${deleteTarget.name}"? Se eliminarán también sus recursos (si no tienen reservas activas) y las certificaciones asociadas.`}
          variant="danger"
          confirmLabel="Eliminar"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
