import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserSummary, Booking } from '../../types';
import { userService } from '../../services/user.service';
import { bookingService } from '../../services/booking.service';
import { certificationService } from '../../services/certification.service';
import { formatDateTime, PURPOSE_LABELS } from '../../utils/dateHelpers';
import { useAuthStore } from '../../store/authStore';
import { getApiError } from '../../utils/apiError';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import ConfirmModal from '../../components/shared/ConfirmModal';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  CONFIRMED: { label: 'Confirmada',  className: 'bg-green-100 text-green-700' },
  PENDING:   { label: 'Pendiente',   className: 'bg-amber-100 text-amber-700' },
  CANCELLED: { label: 'Cancelada',   className: 'bg-red-100 text-red-500' },
  REJECTED:  { label: 'Rechazada',   className: 'bg-red-100 text-red-700' },
};

const ENROLLMENT_BADGE: Record<string, { label: string; className: string }> = {
  CONFIRMED: { label: 'Inscrita',        className: 'bg-green-100 text-green-700' },
  WAITLIST:  { label: 'Lista de espera', className: 'bg-amber-100 text-amber-700' },
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Administrador',
  LIDER_COMUNITARIA: 'Líder Comunitaria', USER: 'Usuaria',
};

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: 'bg-indigo-100 text-indigo-700',
  ADMIN: 'bg-purple-100 text-purple-700',
  LIDER_COMUNITARIA: 'bg-teal-100 text-teal-700',
  USER: 'bg-gray-100 text-gray-600',
};

type BookingFilterType = 'ALL' | 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REJECTED';
type ActiveTab = 'bookings' | 'trainings' | 'certifications';
type PendingAction = { kind: 'approve'; booking: Booking } | { kind: 'reject'; booking: Booking } | { kind: 'revoke'; certId: string; catName: string };

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: me } = useAuthStore();

  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('bookings');
  const [bookingFilter, setBookingFilter] = useState<BookingFilterType>('ALL');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [exporting, setExporting] = useState(false);

  const canManageBookings = me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN' || me?.role === 'LIDER_COMUNITARIA';
  const canManageCerts = me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN' || me?.role === 'LIDER_COMUNITARIA';

  const handleExport = async () => {
    if (!summary) return;
    setExporting(true);
    try {
      await userService.exportSummary(summary.user.id, summary.user.name);
    } catch {
      toast.error('Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  const load = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const data = await userService.getSummary(id);
      setSummary(data);
    } catch {
      toast.error('Error al cargar datos del usuario');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    try {
      if (pendingAction.kind === 'approve') {
        await bookingService.approve(pendingAction.booking.id);
        toast.success('Reserva aprobada');
      } else if (pendingAction.kind === 'reject') {
        await bookingService.reject(pendingAction.booking.id);
        toast.success('Reserva rechazada');
      } else if (pendingAction.kind === 'revoke') {
        await certificationService.revokeCertification(pendingAction.certId);
        toast.success('Certificación revocada');
      }
      await load();
    } catch (err) {
      toast.error(getApiError(err, 'Error al procesar la acción'));
    } finally {
      setPendingAction(null);
    }
  };

  if (isLoading) return <div className="min-h-[60vh] flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  if (!summary) return null;

  const { user, bookings, bookingStats, enrollments, certifications } = summary;

  const filteredBookings = bookingFilter === 'ALL'
    ? bookings
    : bookings.filter((b) => b.status === bookingFilter);

  const upcomingEnrollments = enrollments.filter((e) => new Date(e.training.startTime) >= new Date());
  const pastEnrollments = enrollments.filter((e) => new Date(e.training.startTime) < new Date());

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/users')}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Perfil de Usuaria</h1>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {exporting ? 'Exportando...' : 'Exportar Excel'}
        </button>
      </div>

      {/* Ficha de usuario */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-2xl font-bold">{user.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${ROLE_BADGE[user.role]}`}>
                {ROLE_LABELS[user.role]}
              </span>
              {user.isVerified ? (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Verificada</span>
              ) : (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Pendiente</span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 mt-3 text-sm text-gray-600">
              <p><span className="font-medium text-gray-700">Email:</span> {user.email}</p>
              {user.phone && <p><span className="font-medium text-gray-700">Teléfono:</span> {user.phone}</p>}
              {user.organization && <p><span className="font-medium text-gray-700">Agrupación:</span> {user.organization}</p>}
              <p><span className="font-medium text-gray-700">Miembro desde:</span> {new Date(user.createdAt).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total reservas', value: bookingStats.total, color: 'text-gray-900' },
          { label: 'Pendientes',     value: bookingStats.pending,   color: 'text-amber-600' },
          { label: 'Confirmadas',    value: bookingStats.confirmed, color: 'text-green-600' },
          { label: 'Certificaciones', value: certifications.length, color: 'text-brand-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {([
            ['bookings',        `Reservas (${bookings.length})`],
            ['trainings',       `Capacitaciones (${enrollments.length})`],
            ['certifications',  `Certificaciones (${certifications.length})`],
          ] as [ActiveTab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab: Reservas ─────────────────────────────── */}
        {activeTab === 'bookings' && (
          <div className="p-4">
            {/* Filtro de estado */}
            <div className="flex flex-wrap gap-2 mb-4">
              {(['ALL', 'PENDING', 'CONFIRMED', 'CANCELLED', 'REJECTED'] as BookingFilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setBookingFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    bookingFilter === f
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f === 'ALL' ? 'Todas' : STATUS_BADGE[f]?.label ?? f}
                  {f === 'PENDING' && bookingStats.pending > 0 && (
                    <span className="ml-1 bg-white/30 px-1 rounded-full">{bookingStats.pending}</span>
                  )}
                </button>
              ))}
            </div>

            {filteredBookings.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">No hay reservas</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Fecha</th>
                      <th className="px-3 py-2 text-left font-medium">Recurso</th>
                      <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">Propósito</th>
                      <th className="px-3 py-2 text-center font-medium">Estado</th>
                      {canManageBookings && <th className="px-3 py-2 text-right font-medium">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredBookings.map((b) => {
                      const badge = STATUS_BADGE[b.status];
                      return (
                        <tr key={b.id} className="hover:bg-gray-50/60">
                          <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                            {formatDateTime(b.startTime)}
                          </td>
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-gray-900">{b.resource.name}</p>
                            <p className="text-xs text-gray-400">{b.resource.category?.name}</p>
                          </td>
                          <td className="px-3 py-2.5 text-gray-500 hidden sm:table-cell">
                            {PURPOSE_LABELS[b.purpose]}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge?.className}`}>
                              {badge?.label}
                            </span>
                          </td>
                          {canManageBookings && (
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                {b.status === 'PENDING' && (
                                  <>
                                    <button
                                      onClick={() => setPendingAction({ kind: 'approve', booking: b })}
                                      className="text-xs text-green-600 hover:text-green-800 font-medium"
                                    >
                                      Aprobar
                                    </button>
                                    <button
                                      onClick={() => setPendingAction({ kind: 'reject', booking: b })}
                                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                                    >
                                      Rechazar
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Capacitaciones ───────────────────────── */}
        {activeTab === 'trainings' && (
          <div className="p-4 space-y-4">
            {enrollments.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">Sin inscripciones</p>
            ) : (
              <>
                {upcomingEnrollments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Próximas</h3>
                    <div className="space-y-2">
                      {upcomingEnrollments.map((e) => {
                        const badge = ENROLLMENT_BADGE[e.status];
                        return (
                          <div key={e.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 bg-gray-50/50">
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{e.training.title}</p>
                              <p className="text-xs text-gray-500">{formatDateTime(e.training.startTime)}</p>
                            </div>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${badge?.className}`}>
                              {badge?.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {pastEnrollments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">Pasadas</h3>
                    <div className="space-y-2">
                      {pastEnrollments.map((e) => {
                        const badge = ENROLLMENT_BADGE[e.status];
                        return (
                          <div key={e.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 opacity-70">
                            <div>
                              <p className="font-medium text-gray-800 text-sm">{e.training.title}</p>
                              <p className="text-xs text-gray-400">{formatDateTime(e.training.startTime)}</p>
                            </div>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${badge?.className}`}>
                              {badge?.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Tab: Certificaciones ─────────────────────── */}
        {activeTab === 'certifications' && (
          <div className="p-4">
            {certifications.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">Sin certificaciones</p>
            ) : (
              <div className="space-y-2">
                {certifications.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: c.category?.color ?? '#6b7280' }}
                      />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{c.category?.name}</p>
                        <p className="text-xs text-gray-400">
                          Certificada el {new Date(c.certifiedAt).toLocaleDateString('es-CL')}
                          {c.certifier && ` · por ${c.certifier.name}`}
                        </p>
                      </div>
                    </div>
                    {canManageCerts && (
                      <button
                        onClick={() => setPendingAction({ kind: 'revoke', certId: c.id, catName: c.category?.name ?? '' })}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Revocar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modales de confirmación */}
      {pendingAction?.kind === 'approve' && (
        <ConfirmModal
          title="Aprobar reserva"
          message={`¿Confirmar la reserva de "${pendingAction.booking.resource.name}" el ${formatDateTime(pendingAction.booking.startTime)}?`}
          confirmLabel="Aprobar"
          variant="success"
          onConfirm={handleConfirmAction}
          onCancel={() => setPendingAction(null)}
        />
      )}
      {pendingAction?.kind === 'reject' && (
        <ConfirmModal
          title="Rechazar reserva"
          message={`¿Rechazar la reserva de "${pendingAction.booking.resource.name}" el ${formatDateTime(pendingAction.booking.startTime)}?`}
          confirmLabel="Rechazar"
          variant="danger"
          onConfirm={handleConfirmAction}
          onCancel={() => setPendingAction(null)}
        />
      )}
      {pendingAction?.kind === 'revoke' && (
        <ConfirmModal
          title="Revocar certificación"
          message={`¿Revocar la certificación de "${pendingAction.catName}"? La usuaria quedará como solicitud pendiente.`}
          confirmLabel="Revocar"
          variant="danger"
          onConfirm={handleConfirmAction}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
