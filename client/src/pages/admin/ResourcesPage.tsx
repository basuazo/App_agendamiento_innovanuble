import { useEffect, useMemo, useState } from 'react';
import { Resource } from '../../types';
import { useResourceStore } from '../../store/resourceStore';
import { useAuthStore } from '../../store/authStore';
import ResourceForm from '../../components/admin/ResourceForm';
import ConfirmModal from '../../components/shared/ConfirmModal';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import SortableHeader, { SortState, toggleSort, compareVals } from '../../components/shared/SortableHeader';
import { resourceService } from '../../services/resource.service';
import toast from 'react-hot-toast';

export default function ResourcesPage() {
  const { resources, fetchAll, isLoading } = useResourceStore();
  const { currentSpaceId } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Resource | undefined>();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Resource | null>(null);
  const handleSort = (key: string) => setSort(toggleSort(sort, key));

  const displayResources = useMemo(() => {
    const q = search.toLowerCase();
    const list = q
      ? resources.filter((r) =>
          r.name.toLowerCase().includes(q) ||
          (r.category?.name ?? '').toLowerCase().includes(q)
        )
      : resources;
    if (!sort) return list;
    return [...list].sort((a, b) => {
      const val = (x: Resource) =>
        sort.key === 'name' ? x.name :
        sort.key === 'category' ? (x.category?.name ?? '') : '';
      return compareVals(val(a), val(b), sort.dir);
    });
  }, [resources, search, sort]);

  useEffect(() => {
    fetchAll(false);
  }, [fetchAll, currentSpaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await resourceService.remove(confirmDelete.id);
      toast.success('Recurso eliminado');
      setConfirmDelete(null);
      fetchAll(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Error al eliminar recurso');
      setConfirmDelete(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Recursos</h1>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar recurso..."
            className="w-56 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={() => { setEditing(undefined); setShowForm(true); }}
          className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
            Nuevo Recurso
          </button>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <SortableHeader label="Recurso" sortKey="name" sort={sort} onSort={handleSort} className="text-left" />
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">Descripción</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayResources.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: r.category?.color ?? '#6b7280' }}
                      />
                      <div>
                        <span className="font-medium text-gray-900">{r.name}</span>
                        <span className="block text-xs text-gray-400">{r.category?.name ?? '—'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell max-w-xs truncate">
                    {r.description ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => { setEditing(r); setShowForm(true); }}
                        className="text-brand-600 hover:text-brand-800 text-xs font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setConfirmDelete(r)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
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
        </div>
      )}

      {showForm && (
        <ResourceForm
          resource={editing}
          onClose={() => { setShowForm(false); setEditing(undefined); fetchAll(false); }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Eliminar recurso"
          message={`¿Eliminar "${confirmDelete.name}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
