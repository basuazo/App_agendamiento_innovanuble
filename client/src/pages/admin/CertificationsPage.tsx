import { Fragment, useEffect, useRef, useState } from 'react';
import { Certification, Category, User } from '../../types';
import { certificationService } from '../../services/certification.service';
import { categoryService } from '../../services/category.service';
import { userService } from '../../services/user.service';
import { useAuthStore } from '../../store/authStore';
import { formatDateTime } from '../../utils/dateHelpers';
import ConfirmModal from '../../components/shared/ConfirmModal';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

// ── UserCombobox ─────────────────────────────────────────────────────────────

function UserCombobox({
  users,
  selectedId,
  onSelect,
}: {
  users: User[];
  selectedId: string | null;
  onSelect: (userId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = users.find((u) => u.id === selectedId);
  const inputVal = open ? query : selected ? `${selected.name} (${selected.email})` : query;
  const filtered = users.filter((u) => {
    const q = query.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative w-full max-w-sm">
      <input
        type="text"
        value={inputVal}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar usuaria por nombre o email..."
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {filtered.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSelect(u.id); setQuery(''); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium text-gray-900">{u.name}</span>
                <span className="ml-2 text-xs text-gray-400">{u.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── CertificationsPage ───────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
  LIDER_COMUNITARIA: 'Líder Comunitaria',
  USER: 'Usuaria',
};

export default function CertificationsPage() {
  const { currentSpaceId } = useAuthStore();

  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userCerts, setUserCerts] = useState<Certification[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [certsLoading, setCertsLoading] = useState(false);

  // Certificar: qué fila está en modo "ingresar notas + confirmar"
  const [certifyingCatId, setCertifyingCatId] = useState<string | null>(null);
  const [certNotes, setCertNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Revocar
  const [revokeTarget, setRevokeTarget] = useState<Certification | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadBase = async () => {
    try {
      setIsLoading(true);
      const [usrs, cats] = await Promise.all([
        userService.getAll(),
        categoryService.getAll(),
      ]);
      setUsers(usrs);
      setCategories(cats);
    } catch {
      toast.error('Error al cargar datos');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserCerts = async (userId: string) => {
    try {
      setCertsLoading(true);
      const certs = await certificationService.getAllCertifications(userId);
      setUserCerts(certs);
    } catch {
      toast.error('Error al cargar certificaciones');
    } finally {
      setCertsLoading(false);
    }
  };

  useEffect(() => {
    loadBase();
    setSelectedUserId(null);
    setUserCerts([]);
  }, [currentSpaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setCertifyingCatId(null);
    setCertNotes('');
    loadUserCerts(userId);
  };

  const handleCertify = async (catId: string) => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      await certificationService.certifyUser(selectedUserId, catId, certNotes.trim() || undefined);
      toast.success('Certificación otorgada');
      setCertifyingCatId(null);
      setCertNotes('');
      loadUserCerts(selectedUserId);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Error al certificar');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget || !selectedUserId) return;
    setRevoking(true);
    try {
      await certificationService.revokeCertification(revokeTarget.id);
      toast.success('Certificación revocada');
      setRevokeTarget(null);
      loadUserCerts(selectedUserId);
    } catch {
      toast.error('Error al revocar');
    } finally {
      setRevoking(false);
    }
  };

  const selectedUser = users.find((u) => u.id === selectedUserId);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Certificaciones</h1>
        <p className="text-sm text-gray-500 mt-1">
          Busca una usuaria para revisar y gestionar sus certificaciones de categoría.
        </p>
      </div>

      {/* Buscador de usuaria */}
      <div className="flex items-center gap-3 mb-6">
        <UserCombobox
          users={users}
          selectedId={selectedUserId}
          onSelect={handleSelectUser}
        />
        {selectedUserId && (
          <button
            onClick={() => { setSelectedUserId(null); setUserCerts([]); setCertifyingCatId(null); }}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Panel de usuaria seleccionada */}
      {selectedUser && (
        <>
          {/* Tarjeta de usuaria */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
              <span className="text-brand-700 font-semibold text-sm">
                {selectedUser.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">{selectedUser.name}</p>
              <p className="text-sm text-gray-400">{selectedUser.email}</p>
            </div>
            <span className="ml-auto flex-shrink-0 text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {ROLE_LABELS[selectedUser.role] ?? selectedUser.role}
            </span>
          </div>

          {/* Tabla de categorías */}
          {certsLoading ? (
            <LoadingSpinner />
          ) : categories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No hay categorías en este espacio.</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Categoría</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Estado</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">Fecha</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">Certificada por</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {categories.map((cat) => {
                      const cert = userCerts.find((c) => c.categoryId === cat.id);
                      const isCertifying = certifyingCatId === cat.id;

                      return (
                        <Fragment key={cat.id}>
                          <tr>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: cat.color }}
                                />
                                <span className="font-medium text-gray-900">{cat.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {cert ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                  <span className="text-emerald-500">✓</span>
                                  Certificada
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">Sin certificación</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                              {cert ? formatDateTime(cert.certifiedAt) : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">
                              {cert?.certifier?.name ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {cert ? (
                                <button
                                  onClick={() => setRevokeTarget(cert)}
                                  className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
                                >
                                  Revocar
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setCertifyingCatId(isCertifying ? null : cat.id);
                                    setCertNotes('');
                                  }}
                                  className="text-xs text-brand-600 hover:text-brand-800 font-medium transition-colors"
                                >
                                  {isCertifying ? 'Cancelar' : 'Certificar'}
                                </button>
                              )}
                            </td>
                          </tr>

                          {/* Fila expandida: notas + confirmar */}
                          {isCertifying && (
                            <tr key={`${cat.id}-certify`} className="bg-brand-50">
                              <td colSpan={5} className="px-4 py-3">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                  <input
                                    type="text"
                                    value={certNotes}
                                    onChange={(e) => setCertNotes(e.target.value)}
                                    placeholder="Notas opcionales (ej: aprobó prueba el 03/04/2026)"
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                  />
                                  <button
                                    onClick={() => handleCertify(cat.id)}
                                    disabled={saving}
                                    className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors whitespace-nowrap"
                                  >
                                    {saving ? 'Guardando...' : 'Confirmar certificación'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Estado vacío */}
      {!selectedUser && !isLoading && (
        <div className="text-center py-16 text-gray-400 text-sm">
          Selecciona una usuaria para ver y gestionar sus certificaciones.
        </div>
      )}

      {/* Modal de confirmación de revocación */}
      {revokeTarget && (
        <ConfirmModal
          title="Revocar certificación"
          message={`¿Estás segura que deseas revocar la certificación en "${revokeTarget.category?.name}" de ${selectedUser?.name}? La usuaria necesitará ser certificada nuevamente para reservar directamente.`}
          variant="danger"
          confirmLabel={revoking ? 'Revocando...' : 'Revocar'}
          onConfirm={handleRevoke}
          onCancel={() => setRevokeTarget(null)}
        />
      )}
    </div>
  );
}
