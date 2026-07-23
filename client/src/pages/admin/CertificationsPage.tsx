import { useEffect, useRef, useState } from 'react';
import { Certification, Category, User } from '../../types';
import { certificationService } from '../../services/certification.service';
import { categoryService } from '../../services/category.service';
import { userService } from '../../services/user.service';
import { useAuthStore } from '../../store/authStore';
import { formatDateTime } from '../../utils/dateHelpers';
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
  const inputVal = open ? query : selected ? `${selected.name} (${selected.username})` : query;
  const filtered = users.filter((u) => {
    const q = query.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
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
        placeholder="Buscar usuaria por nombre o RUT..."
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
                <span className="ml-2 text-xs text-gray-400">{u.username}</span>
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

  // Toggle en curso por categoría (evita doble clic en esa fila especifica)
  const [rowSaving, setRowSaving] = useState<Record<string, boolean>>({});
  const [bulkSaving, setBulkSaving] = useState(false);

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
      toast.error('Error al cargar permisos de uso');
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
    loadUserCerts(userId);
  };

  const getErrorMsg = (err: unknown, fallback: string) =>
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;

  // Otorga el permiso de una categoria de inmediato (optimista, sin notas ni modal)
  const handleGrant = async (cat: Category) => {
    if (!selectedUserId || rowSaving[cat.id]) return;
    setRowSaving((prev) => ({ ...prev, [cat.id]: true }));

    const tempId = `temp-${cat.id}`;
    const tempCert: Certification = {
      id: tempId,
      userId: selectedUserId,
      categoryId: cat.id,
      category: cat,
      certifiedAt: new Date().toISOString(),
      certifiedById: '',
      certifier: undefined,
    };
    setUserCerts((prev) => [...prev, tempCert]);

    try {
      const realCert = await certificationService.certifyUser(selectedUserId, cat.id);
      setUserCerts((prev) => prev.map((c) => (c.id === tempId ? realCert : c)));
      toast.success('Permiso otorgado');
    } catch (err: unknown) {
      setUserCerts((prev) => prev.filter((c) => c.id !== tempId));
      toast.error(getErrorMsg(err, 'Error al otorgar permiso'));
    } finally {
      setRowSaving((prev) => ({ ...prev, [cat.id]: false }));
    }
  };

  // Revoca el permiso de una categoria de inmediato (optimista, sin modal)
  const handleRevoke = async (cat: Category) => {
    const cert = userCerts.find((c) => c.categoryId === cat.id);
    if (!cert || rowSaving[cat.id]) return;
    setRowSaving((prev) => ({ ...prev, [cat.id]: true }));

    setUserCerts((prev) => prev.filter((c) => c.categoryId !== cat.id));

    try {
      await certificationService.revokeCertification(cert.id);
      toast.success('Permiso quitado');
    } catch (err: unknown) {
      setUserCerts((prev) => [...prev, cert]);
      toast.error(getErrorMsg(err, 'Error al revocar permiso'));
    } finally {
      setRowSaving((prev) => ({ ...prev, [cat.id]: false }));
    }
  };

  const handleToggle = (cat: Category, checked: boolean) => {
    if (checked) handleGrant(cat);
    else handleRevoke(cat);
  };

  const handleGrantAll = async () => {
    if (!selectedUserId) return;
    const missing = categories.filter((cat) => !userCerts.some((c) => c.categoryId === cat.id));
    if (missing.length === 0) return;
    setBulkSaving(true);
    try {
      const results = await Promise.allSettled(missing.map((cat) => certificationService.certifyUser(selectedUserId, cat.id)));
      const granted = results
        .filter((r): r is PromiseFulfilledResult<Certification> => r.status === 'fulfilled')
        .map((r) => r.value);
      const failedCount = results.filter((r) => r.status === 'rejected').length;
      if (granted.length > 0) setUserCerts((prev) => [...prev, ...granted]);
      if (failedCount > 0) toast.error(`${granted.length} permisos otorgados, ${failedCount} fallaron`);
      else toast.success('Todos los permisos otorgados');
    } finally {
      setBulkSaving(false);
    }
  };

  const handleRevokeAll = async () => {
    if (!selectedUserId || userCerts.length === 0) return;
    setBulkSaving(true);
    const certsToRevoke = userCerts;
    setUserCerts([]);
    try {
      const results = await Promise.allSettled(certsToRevoke.map((c) => certificationService.revokeCertification(c.id)));
      const failed = certsToRevoke.filter((_, i) => results[i].status === 'rejected');
      if (failed.length > 0) {
        setUserCerts(failed);
        toast.error(`${certsToRevoke.length - failed.length} permisos quitados, ${failed.length} fallaron`);
      } else {
        toast.success('Todos los permisos quitados');
      }
    } finally {
      setBulkSaving(false);
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
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Permisos de Uso</h1>
        <p className="text-sm text-gray-500 mt-1">
          Busca una usuaria para revisar y gestionar sus permisos de uso por categoría.
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
            onClick={() => { setSelectedUserId(null); setUserCerts([]); }}
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
              <p className="text-sm text-gray-400">{selectedUser.username}</p>
            </div>
            <span className="ml-auto flex-shrink-0 text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {ROLE_LABELS[selectedUser.role] ?? selectedUser.role}
            </span>
          </div>

          {/* Acciones masivas */}
          {!certsLoading && categories.length > 0 && (
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={handleGrantAll}
                disabled={bulkSaving || categories.every((cat) => userCerts.some((c) => c.categoryId === cat.id))}
                className="px-3 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {bulkSaving ? 'Guardando…' : 'Otorgar todas'}
              </button>
              <button
                onClick={handleRevokeAll}
                disabled={bulkSaving || userCerts.length === 0}
                className="px-3 py-2 text-sm font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {bulkSaving ? 'Guardando…' : 'Quitar todas'}
              </button>
            </div>
          )}

          {/* Checklist de categorías */}
          {certsLoading ? (
            <LoadingSpinner />
          ) : categories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No hay categorías en este espacio.</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              {categories.map((cat) => {
                const cert = userCerts.find((c) => c.categoryId === cat.id);
                const isRowSaving = !!rowSaving[cat.id];
                const disabled = isRowSaving || bulkSaving;

                return (
                  <label
                    key={cat.id}
                    className={`flex items-center gap-3 px-4 py-3 min-h-[44px] ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      checked={!!cert}
                      disabled={disabled}
                      onChange={(e) => handleToggle(cat, e.target.checked)}
                      className="w-6 h-6 rounded border-gray-300 text-brand-600 focus:ring-brand-500 flex-shrink-0"
                    />
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{cat.name}</p>
                      {cert && (
                        <p className="text-xs text-gray-400 truncate">
                          {formatDateTime(cert.certifiedAt)}
                          {cert.certifier?.name ? ` · ${cert.certifier.name}` : ''}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Estado vacío */}
      {!selectedUser && !isLoading && (
        <div className="text-center py-16 text-gray-400 text-sm">
          Selecciona una usuaria para ver y gestionar sus permisos de uso.
        </div>
      )}
    </div>
  );
}
