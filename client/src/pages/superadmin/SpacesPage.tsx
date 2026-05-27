import { useState, useEffect } from 'react';
import { spaceService } from '../../services/space.service';
import type { Space } from '../../types';
import toast from 'react-hot-toast';
import { getApiError } from '../../utils/apiError';
import ConfirmModal from '../../components/shared/ConfirmModal';

export default function SpacesPage() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);

  // Crear
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  // Editar
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  // Eliminar
  const [deleteTarget, setDeleteTarget] = useState<Space | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const data = await spaceService.getAll();
      setSpaces(data);
    } catch {
      toast.error('Error al cargar espacios');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const space = await spaceService.create({ name: createName.trim() });
      setSpaces((prev) => [...prev, space]);
      setCreateName('');
      setShowCreate(false);
      toast.success('Espacio creado');
    } catch (err) {
      toast.error(getApiError(err, 'Error al crear espacio'));
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit() {
    if (!editId || !editName.trim()) return;
    setSaving(true);
    try {
      const updated = await spaceService.update(editId, { name: editName.trim() });
      setSpaces((prev) => prev.map((s) => (s.id === editId ? updated : s)));
      setEditId(null);
      toast.success('Espacio actualizado');
    } catch (err) {
      toast.error(getApiError(err, 'Error al actualizar espacio'));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(space: Space) {
    try {
      const updated = await spaceService.update(space.id, { isActive: !space.isActive });
      setSpaces((prev) => prev.map((s) => (s.id === space.id ? updated : s)));
      toast.success(`Espacio ${updated.isActive ? 'activado' : 'desactivado'}`);
    } catch (err) {
      toast.error(getApiError(err, 'Error al actualizar espacio'));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await spaceService.delete(deleteTarget.id);
      setSpaces((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success('Espacio eliminado');
    } catch (err) {
      toast.error(getApiError(err, 'Error al eliminar espacio'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Espacios</h1>
          <p className="text-sm text-gray-500 mt-1">{spaces.length} espacio(s) registrado(s)</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreateName(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Espacio
        </button>
      </div>

      {/* Formulario de creación */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Nuevo espacio</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Nombre del espacio"
              required
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {creating ? 'Creando...' : 'Crear'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : (
        <div className="space-y-3">
          {spaces.map((space) => (
            <div key={space.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="flex-1 min-w-0">
                {editId === space.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
                    >
                      {saving ? '...' : 'Guardar'}
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">{space.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${space.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {space.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-0.5">ID: {space.id}</p>
              </div>

              {editId !== space.id && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => { setEditId(space.id); setEditName(space.name); }}
                    className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleToggleActive(space)}
                    className={`p-1.5 rounded-lg transition-colors ${space.isActive ? 'text-green-500 hover:text-green-700 hover:bg-green-50' : 'text-gray-400 hover:text-green-500 hover:bg-green-50'}`}
                    title={space.isActive ? 'Desactivar' : 'Activar'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteTarget(space)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!!deleteTarget && (
        <ConfirmModal
          title="Eliminar espacio"
          message={`¿Eliminar el espacio "${deleteTarget?.name}"? Esta acción no se puede deshacer. El espacio no se puede eliminar si tiene usuarios asignados.`}
          confirmLabel={deleting ? 'Eliminando...' : 'Eliminar'}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          variant="danger"
        />
      )}
    </div>
  );
}
