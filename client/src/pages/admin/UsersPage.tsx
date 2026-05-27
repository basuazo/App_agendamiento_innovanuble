import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Role, Space } from '../../types';
import { userService } from '../../services/user.service';
import { spaceService } from '../../services/space.service';
import { useAuthStore } from '../../store/authStore';
import { formatDateTime } from '../../utils/dateHelpers';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import ConfirmModal from '../../components/shared/ConfirmModal';
import { getApiError } from '../../utils/apiError';
import SortableHeader, { SortState, toggleSort, compareVals } from '../../components/shared/SortableHeader';
import toast from 'react-hot-toast';

type PendingAction =
  | { kind: 'delete'; id: string; name: string }
  | { kind: 'verify'; id: string; name: string };

export default function UsersPage() {
  const { user: me, currentSpaceId } = useAuthStore();
  const canCreateEditUsers = me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN' || me?.role === 'LIDER_COMUNITARIA';
  const canDeleteUsers = me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN';
  const canChangePassword = me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN';
  const canChangeRole = me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN';
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState | null>(null);
  const [exporting, setExporting] = useState(false);
  const handleSort = (key: string) => setSort(toggleSort(sort, key));

  const load = async () => {
    try {
      setIsLoading(true);
      const data = await userService.getAll();
      setUsers(data);
    } catch {
      toast.error('Error al cargar usuarios');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [currentSpaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingCount = users.filter((u) => !u.isVerified).length;

  const displayUsers = useMemo(() => {
    const q = search.toLowerCase();
    const list = q
      ? users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.organization ?? '').toLowerCase().includes(q))
      : users;
    if (!sort) return list;
    return [...list].sort((a, b) => {
      const val = (u: User) =>
        sort.key === 'name' ? u.name :
        sort.key === 'organization' ? (u.organization ?? '') :
        sort.key === 'createdAt' ? u.createdAt :
        sort.key === 'isVerified' ? String(u.isVerified) :
        sort.key === 'role' ? u.role : '';
      return compareVals(val(a), val(b), sort.dir);
    });
  }, [users, search, sort]);

  const handleConfirm = async () => {
    if (!pending) return;
    try {
      if (pending.kind === 'delete') {
        await userService.delete(pending.id);
        toast.success('Usuario eliminado');
      } else if (pending.kind === 'verify') {
        await userService.verify(pending.id);
        toast.success('Usuario verificado');
      }
      load();
    } catch (err) {
      toast.error(getApiError(err, 'Error al procesar la acción'));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
          {pendingCount > 0 && (
            <span className="inline-flex items-center bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {canDeleteUsers && (
            <button
              onClick={async () => { setExporting(true); try { await userService.exportAll(); } catch { toast.error('Error al exportar'); } finally { setExporting(false); } }}
              disabled={exporting}
              className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exporting ? 'Exportando...' : 'Exportar Excel'}
            </button>
          )}
          {canCreateEditUsers && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nueva Usuaria
            </button>
          )}
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
                <SortableHeader label="Usuario" sortKey="name" sort={sort} onSort={handleSort} className="text-left" />
                <SortableHeader label="Organización" sortKey="organization" sort={sort} onSort={handleSort} className="text-left hidden lg:table-cell" />
                <SortableHeader label="Registrado" sortKey="createdAt" sort={sort} onSort={handleSort} className="text-left hidden md:table-cell" />
                <SortableHeader label="Estado" sortKey="isVerified" sort={sort} onSort={handleSort} className="text-center" />
                <SortableHeader label="Rol" sortKey="role" sort={sort} onSort={handleSort} className="text-center" />
                <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayUsers.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{u.name}</p>
                    <p className="text-gray-400 text-xs">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm hidden lg:table-cell">
                    {u.organization ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {formatDateTime(u.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.isVerified ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                        Verificada
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      u.role === 'SUPER_ADMIN' ? 'bg-indigo-100 text-indigo-700' :
                      u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                      u.role === 'LIDER_COMUNITARIA' ? 'bg-teal-100 text-teal-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {u.role === 'SUPER_ADMIN' ? 'Super Admin' :
                       u.role === 'ADMIN' ? 'Admin' :
                       u.role === 'LIDER_COMUNITARIA' ? 'Líder Comunitaria' : 'Usuario'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => navigate(`/admin/users/${u.id}`)}
                        className="text-xs text-brand-600 hover:text-brand-800 font-medium"
                      >
                        Ver
                      </button>
                      {u.id !== me?.id && u.role !== 'SUPER_ADMIN' && (
                        <>
                          {!u.isVerified && (
                            <button
                              onClick={() => setPending({ kind: 'verify', id: u.id, name: u.name })}
                              className="text-xs text-green-600 hover:text-green-800 font-medium"
                            >
                              Verificar
                            </button>
                          )}
                          {canCreateEditUsers && (
                            <button
                              onClick={() => setEditTarget(u)}
                              className="text-xs text-gray-600 hover:text-gray-900 font-medium"
                            >
                              Editar
                            </button>
                          )}
                          {canDeleteUsers && (
                            <button
                              onClick={() => setPending({ kind: 'delete', id: u.id, name: u.name })}
                              className="text-xs text-red-500 hover:text-red-700 font-medium"
                            >
                              Eliminar
                            </button>
                          )}
                        </>
                      )}
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
        <CreateUserModal
          isSuperAdmin={me?.role === 'SUPER_ADMIN'}
          canChangeRole={canChangeRole}
          onClose={() => { setShowForm(false); load(); }}
        />
      )}

      {editTarget && (
        <EditUserModal
          user={editTarget}
          isSuperAdmin={me?.role === 'SUPER_ADMIN'}
          canChangeRole={canChangeRole}
          canChangePassword={canChangePassword}
          onClose={() => { setEditTarget(null); load(); }}
        />
      )}

      {pending?.kind === 'verify' && (
        <ConfirmModal
          title="Verificar usuario"
          message={`¿Verificar a "${pending.name}"? Podrá iniciar sesión y usar la app.`}
          confirmLabel="Verificar"
          variant="success"
          onConfirm={handleConfirm}
          onCancel={() => setPending(null)}
        />
      )}

      {pending?.kind === 'delete' && (
        <ConfirmModal
          title="Eliminar usuario"
          message={`¿Eliminar a "${pending.name}"? Sus reservas activas también serán canceladas.`}
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={handleConfirm}
          onCancel={() => setPending(null)}
        />
      )}

    </div>
  );
}

function EditUserModal({ user, isSuperAdmin, canChangeRole, canChangePassword, onClose }: { user: User; isSuperAdmin: boolean; canChangeRole: boolean; canChangePassword: boolean; onClose: () => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [organization, setOrganization] = useState(user.organization ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(user.role);
  const [spaceId, setSpaceId] = useState(user.spaceId ?? '');
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      spaceService.getAll().then(setSpaces).catch(() => {});
    }
  }, [isSuperAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await userService.update(user.id, {
        name,
        email,
        organization,
        phone,
        ...(password ? { password } : {}),
        ...(isSuperAdmin ? { spaceId } : {}),
      });
      if (role !== user.role) {
        await userService.changeRole(user.id, role);
      }
      toast.success('Usuario actualizado');
      onClose();
    } catch (err: unknown) {
      toast.error(getApiError(err, 'Error al actualizar usuario'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Editar Usuario</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agrupación u Organización</label>
            <input type="text" value={organization} onChange={(e) => setOrganization(e.target.value)}
              placeholder="Ej: Taller Comunal Las Flores"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+56 9 1234 5678"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          {canChangePassword && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nueva contraseña <span className="text-gray-400 font-normal">(dejar vacío para no cambiar)</span>
              </label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6}
                placeholder="Mínimo 6 caracteres"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          )}
          {canChangeRole && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                <option value="USER">Usuario</option>
                <option value="LIDER_COMUNITARIA">Líder Comunitaria</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
          )}
          {isSuperAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Espacio</label>
              <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                <option value="">Sin espacio asignado</option>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, isSuperAdmin, canChangeRole }: { onClose: () => void; isSuperAdmin: boolean; canChangeRole: boolean }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('USER');
  const [spaceId, setSpaceId] = useState('');
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      spaceService.getAll().then(setSpaces).catch(() => {});
    }
  }, [isSuperAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSuperAdmin && !spaceId) {
      toast.error('Debes seleccionar un espacio');
      return;
    }
    setLoading(true);
    try {
      await userService.create({ name, email, organization, phone, password, role, ...(isSuperAdmin ? { spaceId } : {}) });
      toast.success('Usuario creado');
      onClose();
    } catch (err: unknown) {
      toast.error(getApiError(err, 'Error al crear usuario'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Nuevo Usuario</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agrupación u Organización</label>
            <input type="text" value={organization} onChange={(e) => setOrganization(e.target.value)}
              placeholder="Ej: Taller Comunal Las Flores"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+56 9 1234 5678"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          {canChangeRole && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="USER">Usuario</option>
                <option value="LIDER_COMUNITARIA">Líder Comunitaria</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
          )}
          {isSuperAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Espacio *</label>
              <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                <option value="">Selecciona un espacio...</option>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
              {loading ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
