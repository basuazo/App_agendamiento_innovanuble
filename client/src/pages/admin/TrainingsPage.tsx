import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Training, User } from '../../types';
import { trainingService } from '../../services/training.service';
import { userService } from '../../services/user.service';
import TrainingModal from '../../components/admin/TrainingModal';
import ConfirmModal from '../../components/shared/ConfirmModal';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

// Combobox de búsqueda de usuarias
function UserCombobox({
  users,
  value,
  onSelect,
}: {
  users: User[];
  value: string;        // userId seleccionado
  onSelect: (userId: string, label: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sincroniza el texto del input cuando el valor externo se limpia
  const selectedUser = users.find((u) => u.id === value);
  const inputValue = open ? query : (selectedUser ? `${selectedUser.name} (${selectedUser.email})` : query);

  const filtered = users.filter((u) => {
    const q = query.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const handleSelect = (u: User) => {
    onSelect(u.id, `${u.name} (${u.email})`);
    setQuery('');
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (!open) setOpen(true);
    if (!e.target.value) onSelect('', '');
  };

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative flex-1">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => { setQuery(''); setOpen(true); }}
        placeholder="Buscar por nombre o email..."
        className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
      {open && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-gray-400">Sin resultados</li>
          ) : (
            filtered.map((u) => (
              <li
                key={u.id}
                onMouseDown={() => handleSelect(u)}
                className="px-3 py-2 cursor-pointer hover:bg-amber-50 text-sm"
              >
                <span className="font-medium text-gray-800">{u.name}</span>
                <span className="text-gray-400 text-xs ml-1">({u.email})</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function TrainingsPage() {
  const { currentSpaceId } = useAuthStore();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Training | null>(null);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  // Inscribir por otra usuaria: { [trainingId]: userId seleccionado }
  const [enrollTarget, setEnrollTarget] = useState<Record<string, string>>({});
  const [enrollLoading, setEnrollLoading] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    try {
      setIsLoading(true);
      const [data, usersData] = await Promise.all([
        trainingService.getAll(),
        userService.getAll(),
      ]);
      setTrainings(data);
      setUsers(usersData);
    } catch {
      toast.error('Error al cargar capacitaciones');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentSpaceId]);

  const handleEnrollFor = async (trainingId: string) => {
    const targetUserId = enrollTarget[trainingId];
    if (!targetUserId) return;
    setEnrollLoading(trainingId);
    try {
      await trainingService.enroll(trainingId, targetUserId);
      toast.success('Usuaria inscrita correctamente');
      setEnrollTarget((prev) => ({ ...prev, [trainingId]: '' }));
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Error al inscribir la usuaria');
    } finally {
      setEnrollLoading(null);
    }
  };

  const handleUnenrollFor = async (trainingId: string, userId: string) => {
    setEnrollLoading(`${trainingId}-${userId}`);
    try {
      await trainingService.unenroll(trainingId, userId);
      toast.success('Inscripción cancelada');
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Error al cancelar la inscripción');
    } finally {
      setEnrollLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await trainingService.remove(confirmDelete.id);
      toast.success('Capacitación eliminada');
      setConfirmDelete(null);
      setExpanded(null);
      load();
    } catch {
      toast.error('Error al eliminar la capacitación');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await trainingService.exportAll();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'capacitaciones.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al exportar capacitaciones');
    } finally {
      setExporting(false);
    }
  };

  const now = new Date();
  const filtered = trainings.filter((t) => {
    const end = new Date(t.endTime);
    if (filter === 'upcoming') return end >= now;
    if (filter === 'past') return end < now;
    return true;
  });

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Capacitaciones</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Gestión de sesiones y listado de inscritas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 border border-gray-200 bg-white text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Exportando...' : 'Exportar Excel'}
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Capacitación
          </button>
        </div>
      </div>

      {/* Filtro */}
      <div className="flex gap-2 mb-5">
        {(['upcoming', 'past', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-amber-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f === 'upcoming' ? 'Próximas' : f === 'past' ? 'Pasadas' : 'Todas'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-sm">No hay capacitaciones {filter === 'upcoming' ? 'próximas' : filter === 'past' ? 'pasadas' : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const confirmedCount = t.enrollments.filter((e) => e.status === 'CONFIRMED').length;
            const waitlistCount = t.enrollments.filter((e) => e.status === 'WAITLIST').length;
            const isPast = new Date(t.endTime) < now;
            const isExpanded = expanded === t.id;
            // Usuarias no inscritas aún en esta capacitación
            const availableUsers = users.filter((u) => !t.enrollments.some((e) => e.userId === u.id));

            return (
              <div key={t.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Cabecera */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-gray-900 text-sm">{t.title}</h3>
                        {isPast && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Pasada</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 capitalize">{fmtDate(t.startTime)}</p>
                      <p className="text-xs text-gray-500">
                        {fmtTime(t.startTime)} – {fmtTime(t.endTime)}
                      </p>
                      {t.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{t.description}</p>
                      )}
                    </div>

                    {/* Cupos */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {confirmedCount}/{t.capacity}
                      </p>
                      <p className="text-xs text-gray-400">cupos</p>
                      {waitlistCount > 0 && (
                        <p className="text-xs text-amber-600 mt-0.5">{waitlistCount} en espera</p>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : t.id)}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                    >
                      {isExpanded ? 'Ocultar inscritas' : `Ver inscritas (${t.enrollments.length})`}
                    </button>
                    <span className="text-gray-200">|</span>
                    <button
                      onClick={() => setConfirmDelete(t)}
                      className="text-xs text-red-400 hover:text-red-600 font-medium"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                {/* Lista de inscritas expandible */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
                    {/* Inscribir por otra usuaria */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Inscribir usuaria
                      </p>
                      <div className="flex gap-2">
                        <UserCombobox
                          users={availableUsers}
                          value={enrollTarget[t.id] ?? ''}
                          onSelect={(userId) => setEnrollTarget((prev) => ({ ...prev, [t.id]: userId }))}
                        />
                        <button
                          onClick={() => handleEnrollFor(t.id)}
                          disabled={!enrollTarget[t.id] || enrollLoading === t.id}
                          className="px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {enrollLoading === t.id ? '...' : 'Inscribir'}
                        </button>
                      </div>
                    </div>

                    {/* Lista */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Inscritas ({t.enrollments.length})
                      </p>
                      {t.enrollments.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">Sin inscritas aún</p>
                      ) : (
                        <div className="space-y-1">
                          {t.enrollments.map((e, idx) => {
                            const unenrollKey = `${t.id}-${e.userId}`;
                            return (
                              <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-400 w-5">{idx + 1}.</span>
                                  <div>
                                    <p className="text-sm text-gray-800">{e.user.name}</p>
                                    <p className="text-xs text-gray-400">{e.user.email}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                      e.status === 'CONFIRMED'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}>
                                      {e.status === 'CONFIRMED' ? 'Confirmada' : 'En espera'}
                                    </span>
                                    <span className="text-xs text-gray-400">{fmt(e.createdAt)}</span>
                                  </div>
                                  <button
                                    onClick={() => handleUnenrollFor(t.id, e.userId)}
                                    disabled={enrollLoading === unenrollKey}
                                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors ml-1"
                                    title="Desinscribir"
                                  >
                                    {enrollLoading === unenrollKey ? '...' : '✕'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <TrainingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />

      {confirmDelete && (
        <ConfirmModal
          title="Eliminar capacitación"
          message={`¿Eliminar "${confirmDelete.title}"? Se perderán todas las inscripciones. Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
