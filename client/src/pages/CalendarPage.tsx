import { useEffect, useRef, useState } from 'react';
import { useBookingStore } from '../store/bookingStore';
import { useResourceStore } from '../store/resourceStore';
import { useAuthStore } from '../store/authStore';
import { Training, BusinessHours, User, Maintenance } from '../types';
import { trainingService } from '../services/training.service';
import { bookingService } from '../services/booking.service';
import { maintenanceService } from '../services/maintenance.service';
import { settingsService } from '../services/settings.service';
import { userService } from '../services/user.service';
import CalendarView from '../components/calendar/CalendarView';
import BookingWizard from '../components/booking/BookingWizard';
import ExceptionalBookingModal from '../components/booking/ExceptionalBookingModal';
import TrainingModal from '../components/admin/TrainingModal';
import MaintenanceModal from '../components/admin/MaintenanceModal';
import ConfirmModal from '../components/shared/ConfirmModal';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

// Combobox de búsqueda de usuarias (para inscripción por roles elevados)
function UserCombobox({
  users,
  value,
  onSelect,
}: {
  users: User[];
  value: string;
  onSelect: (userId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedUser = users.find((u) => u.id === value);
  const inputValue = open ? query : (selectedUser ? `${selectedUser.name} (${selectedUser.email})` : query);

  const filtered = users.filter((u) => {
    const q = query.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const handleSelect = (u: User) => {
    onSelect(u.id);
    setQuery('');
    setOpen(false);
  };

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
        onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); if (!e.target.value) onSelect(''); }}
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

export default function CalendarPage() {
  const { user, currentSpaceId } = useAuthStore();
  const { bookings, fetchAll, isLoading } = useBookingStore();
  const { resources, fetchAll: fetchResources } = useResourceStore();

  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [editBookings, setEditBookings] = useState<import('../types').Booking[] | undefined>(undefined);
  const [exceptionalModalOpen, setExceptionalModalOpen] = useState(false);
  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [editingMaintenance, setEditingMaintenance] = useState<Maintenance | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedHour, setSelectedHour] = useState<number | undefined>();
  const [actionChoice, setActionChoice] = useState<{ date: Date } | null>(null);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([]);
  const [maxBookingMinutes, setMaxBookingMinutes] = useState<number>(240);
  const [lunchBreak, setLunchBreak] = useState<{ enabled: boolean; start: string; end: string } | null>(null);
  const [hoursLoaded, setHoursLoaded] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [selectedMaintenance, setSelectedMaintenance] = useState<Maintenance | null>(null);
  const [confirmDeleteTraining, setConfirmDeleteTraining] = useState<Training | null>(null);
  const [confirmDeleteMaintenance, setConfirmDeleteMaintenance] = useState<Maintenance | null>(null);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [enrollTargetId, setEnrollTargetId] = useState('');

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'LIDER_COMUNITARIA';
  const canManageTrainings = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const canManageMaintenance = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const fetchTrainings = async () => {
    try {
      const data = await trainingService.getAll();
      setTrainings(data);
      // Mantiene el modal de detalle sincronizado con los datos frescos
      setSelectedTraining((prev) => prev ? (data.find((t) => t.id === prev.id) ?? null) : null);
    } catch {
      // silent
    }
  };

  const fetchMaintenances = async () => {
    try {
      const data = await maintenanceService.getAll();
      setMaintenances(data);
    } catch {
      // silent
    }
  };

  const fetchBusinessHours = async () => {
    try {
      const data = await settingsService.getBusinessHours();
      setBusinessHours(data.days);
      setMaxBookingMinutes(data.maxBookingMinutes ?? 240);
      if (data.lunchBreakEnabled && data.lunchBreakStart && data.lunchBreakEnd) {
        setLunchBreak({ enabled: true, start: data.lunchBreakStart, end: data.lunchBreakEnd });
      } else {
        setLunchBreak(null);
      }
    } catch {
      // silent — el calendario usará horarios por defecto
    } finally {
      setHoursLoaded(true);
    }
  };

  useEffect(() => {
    setHoursLoaded(false);
    fetchAll();
    fetchResources();
    fetchTrainings();
    fetchMaintenances();
    fetchBusinessHours();
    if (isAdmin) {
      userService.getAll().then(setUsers).catch(() => {});
    }
  }, [fetchAll, fetchResources, currentSpaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSlotClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedHour(date.getHours() >= 9 && date.getHours() <= 16 ? date.getHours() : 9);
    if (isAdmin) {
      setActionChoice({ date });
    } else {
      setBookingModalOpen(true);
    }
  };

  const handleChooseBooking = () => {
    setActionChoice(null);
    setBookingModalOpen(true);
  };

  const handleChooseTraining = () => {
    setActionChoice(null);
    setEditingTraining(null);
    setTrainingModalOpen(true);
  };

  const handleChooseExceptional = () => {
    setActionChoice(null);
    setExceptionalModalOpen(true);
  };

  const handleChooseMaintenance = () => {
    setActionChoice(null);
    setEditingMaintenance(null);
    setMaintenanceModalOpen(true);
  };

  const handleMaintenanceClick = (maintenance: Maintenance) => {
    setSelectedMaintenance(maintenance);
  };

  const handleDeleteMaintenance = async () => {
    if (!confirmDeleteMaintenance) return;
    try {
      await maintenanceService.remove(confirmDeleteMaintenance.id);
      toast.success('Mantención eliminada');
      setConfirmDeleteMaintenance(null);
      setSelectedMaintenance(null);
      fetchMaintenances();
    } catch {
      toast.error('Error al eliminar la mantención');
    }
  };

  const handleBookingModalClose = () => {
    setBookingModalOpen(false);
    setEditBookings(undefined);
    setSelectedDate(undefined);
    setSelectedHour(undefined);
    fetchAll();
  };

  const handleEditBooking = (bookings: import('../types').Booking[]) => {
    setEditBookings(bookings);
    setBookingModalOpen(true);
  };

  const handleTrainingModalClose = () => {
    setTrainingModalOpen(false);
    setEditingTraining(null);
    setSelectedDate(undefined);
    setSelectedHour(undefined);
  };

  const handleTrainingSaved = () => {
    fetchTrainings();
  };

  const handleTrainingClick = (training: Training) => {
    setEnrollTargetId('');
    setSelectedTraining(training);
  };

  const handleEnrollFor = async (training: Training, targetUserId: string) => {
    setEnrollLoading(true);
    try {
      await trainingService.enroll(training.id, targetUserId);
      const confirmedCount = training.enrollments.filter((e) => e.status === 'CONFIRMED').length;
      toast.success(confirmedCount >= training.capacity ? 'Agregada a lista de espera' : 'Inscripción confirmada');
      setEnrollTargetId('');
      fetchTrainings();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Error al inscribir');
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleUnenrollFor = async (training: Training, targetUserId: string) => {
    setEnrollLoading(true);
    try {
      await trainingService.unenroll(training.id, targetUserId);
      toast.success('Inscripción cancelada');
      fetchTrainings();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Error al cancelar inscripción');
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleDeleteTraining = async () => {
    if (!confirmDeleteTraining) return;
    try {
      await trainingService.remove(confirmDeleteTraining.id);
      toast.success('Capacitación eliminada');
      setConfirmDeleteTraining(null);
      setSelectedTraining(null);
      fetchTrainings();
    } catch {
      toast.error('Error al eliminar la capacitación');
    }
  };

  const handleEditTraining = (training: Training) => {
    setSelectedTraining(null);
    setEditingTraining(training);
    setTrainingModalOpen(true);
  };

  const handleEnroll = async (training: Training) => {
    const myEnrollment = training.enrollments.find((e) => e.userId === user?.id);
    setEnrollLoading(true);
    try {
      if (myEnrollment) {
        await trainingService.unenroll(training.id);
        toast.success('Inscripción cancelada');
      } else {
        await trainingService.enroll(training.id);
        const confirmedCount = training.enrollments.filter((e) => e.status === 'CONFIRMED').length;
        if (confirmedCount >= training.capacity) {
          toast.success('Agregada a lista de espera');
        } else {
          toast.success('Inscripción confirmada');
        }
      }
      setSelectedTraining(null);
      fetchTrainings();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Error al procesar inscripción');
    } finally {
      setEnrollLoading(false);
    }
  };

  // Callbacks para CalendarView
  const handleCancelBooking = async (id: string) => {
    await bookingService.cancel(id);
    toast.success('Reserva cancelada');
    fetchAll();
  };


  const calendarReady = !isLoading && hoursLoaded;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendario de Reservas</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {isAdmin
              ? 'Haz click en un horario para reservar o bloquear para capacitación'
              : 'Haz click en un horario libre para reservar'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setBookingModalOpen(true)}
            className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Reserva
          </button>
          {canManageTrainings && (
            <button
              onClick={() => { setEditingTraining(null); setTrainingModalOpen(true); }}
              className="inline-flex items-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Capacitación
            </button>
          )}
          {canManageMaintenance && (
            <button
              onClick={() => { setExceptionalModalOpen(true); setSelectedDate(undefined); }}
              className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Hora Excepcional
            </button>
          )}
          {canManageMaintenance && (
            <button
              onClick={() => { setEditingMaintenance(null); setMaintenanceModalOpen(true); setSelectedDate(undefined); }}
              className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Mantención
            </button>
          )}
        </div>
      </div>

      {/* Leyenda de colores por categoría */}
      {resources.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          {Array.from(
            new Map(resources.filter((r) => r.category).map((r) => [r.categoryId, r.category!])).values()
          ).map((cat) => (
            <div key={cat.id} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: cat.color ?? '#6b7280' }}
              />
              <span className="text-xs text-gray-600">{cat.name}</span>
            </div>
          ))}
          {trainings.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="text-xs text-gray-600">Capacitación</span>
            </div>
          )}
          {maintenances.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-600" />
              <span className="text-xs text-gray-600">Mantención / Cierre</span>
            </div>
          )}
        </div>
      )}

      {!calendarReady ? (
        <LoadingSpinner size="lg" />
      ) : (
        <CalendarView
          bookings={bookings}
          trainings={trainings}
          maintenances={maintenances}
          isAdmin={isAdmin}
          currentUserId={user?.id}
          businessHours={businessHours}
          lunchBreak={lunchBreak}
          onSlotClick={handleSlotClick}
          onTrainingClick={handleTrainingClick}
          onMaintenanceClick={handleMaintenanceClick}
          onCancelBooking={handleCancelBooking}
          onEditBooking={handleEditBooking}
        />
      )}

      {/* Mini-dialog de elección (solo admin) */}
      {actionChoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">¿Qué deseas crear?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Horario:{' '}
              <span className="font-medium text-gray-700">
                {actionChoice.date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
                {String(actionChoice.date.getHours()).padStart(2, '0')}:{String(actionChoice.date.getMinutes()).padStart(2, '0')}
              </span>
            </p>
            <div className="space-y-2">
              <button
                onClick={handleChooseBooking}
                className="w-full py-3 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Nueva Reserva
              </button>
              {canManageTrainings && (
                <button
                  onClick={handleChooseTraining}
                  className="w-full py-3 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors"
                >
                  Bloquear para Capacitación
                </button>
              )}
              {canManageMaintenance && (
                <button
                  onClick={handleChooseExceptional}
                  className="w-full py-3 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors"
                >
                  Hora Excepcional
                </button>
              )}
              {canManageMaintenance && (
                <button
                  onClick={handleChooseMaintenance}
                  className="w-full py-3 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Mantención / Cierre
                </button>
              )}
              <button
                onClick={() => setActionChoice(null)}
                className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <BookingWizard
        isOpen={bookingModalOpen}
        onClose={handleBookingModalClose}
        preselectedDate={editBookings ? undefined : selectedDate}
        businessHours={businessHours}
        maxBookingMinutes={maxBookingMinutes}
        lunchBreak={lunchBreak}
        editBookings={editBookings}
      />

      <TrainingModal
        isOpen={trainingModalOpen}
        onClose={handleTrainingModalClose}
        onSaved={handleTrainingSaved}
        preselectedDate={selectedDate}
        preselectedHour={selectedHour}
        initialTraining={editingTraining ?? undefined}
      />

      <ExceptionalBookingModal
        isOpen={exceptionalModalOpen}
        onClose={() => { setExceptionalModalOpen(false); setSelectedDate(undefined); fetchAll(); }}
        resources={resources}
        preselectedDate={selectedDate}
      />

      <MaintenanceModal
        isOpen={maintenanceModalOpen}
        onClose={() => { setMaintenanceModalOpen(false); setEditingMaintenance(null); setSelectedDate(undefined); }}
        onSaved={() => { fetchMaintenances(); }}
        preselectedDate={selectedDate}
        initialMaintenance={editingMaintenance ?? undefined}
      />

      {/* Modal detalle / inscripción de capacitación */}
      {selectedTraining && (() => {
        const t = selectedTraining;
        const myEnrollment = t.enrollments.find((e) => e.userId === user?.id);
        const confirmedCount = t.enrollments.filter((e) => e.status === 'CONFIRMED').length;
        const waitlistCount = t.enrollments.filter((e) => e.status === 'WAITLIST').length;
        const isFull = confirmedCount >= t.capacity;
        const start = new Date(t.startTime);
        const end = new Date(t.endTime);
        const fmt = (d: Date) =>
          d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full mb-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                      Capacitación
                    </span>
                    <h2 className="text-lg font-bold text-gray-900">{t.title}</h2>
                  </div>
                  <button onClick={() => setSelectedTraining(null)} className="text-gray-400 hover:text-gray-600 transition-colors ml-4 shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {t.description && (
                  <p className="text-sm text-gray-600 mb-4">{t.description}</p>
                )}

                <div className="space-y-2 text-sm text-gray-700 mb-4">
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-16 shrink-0">Inicio</span>
                    <span className="font-medium">{fmt(start)}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-16 shrink-0">Fin</span>
                    <span className="font-medium">{fmt(end)}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-gray-400 w-16 shrink-0">Cupos</span>
                    <span className="font-medium">
                      {confirmedCount}/{t.capacity} ocupados
                      {waitlistCount > 0 && <span className="text-amber-600 ml-2">({waitlistCount} en espera)</span>}
                    </span>
                  </div>
                  {t.exemptions.length > 0 && (
                    <div className="flex gap-2">
                      <span className="text-gray-400 w-16 shrink-0">Libres</span>
                      <span className="font-medium text-green-700">
                        {t.exemptions.map((e) => e.resource.name).join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Lista de inscriptas — visible para todos */}
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Inscritas {t.enrollments.length > 0 && `(${t.enrollments.length})`}
                  </p>
                  {t.enrollments.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Nadie inscrita aún</p>
                  ) : (
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto mb-3">
                      {t.enrollments.map((e) => (
                        <div key={e.id} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="text-gray-800 truncate mr-2">{e.user.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${e.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {e.status === 'CONFIRMED' ? 'Confirmada' : 'En espera'}
                            </span>
                            {/* Botón desinscribir: solo admins */}
                            {isAdmin && (
                              <button
                                onClick={() => handleUnenrollFor(t, e.userId)}
                                disabled={enrollLoading}
                                className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                                title="Cancelar inscripción"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Inscribir otra usuaria: solo admins */}
                  {isAdmin && (
                    <div className="flex gap-2 items-center">
                      <UserCombobox
                        users={users.filter((u) => !t.enrollments.some((e) => e.userId === u.id))}
                        value={enrollTargetId}
                        onSelect={setEnrollTargetId}
                      />
                      <button
                        onClick={() => handleEnrollFor(t, enrollTargetId)}
                        disabled={!enrollTargetId || enrollLoading}
                        className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-60 transition-colors shrink-0"
                      >
                        Inscribir
                      </button>
                    </div>
                  )}
                </div>

                {/* Botón inscripción propia */}
                {user?.role !== 'SUPER_ADMIN' && (
                  <button
                    onClick={() => handleEnroll(t)}
                    disabled={enrollLoading || (!myEnrollment && isFull && waitlistCount >= 20)}
                    className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 mb-2 ${
                      myEnrollment
                        ? 'border border-red-300 text-red-600 hover:bg-red-50'
                        : isFull
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'bg-brand-600 text-white hover:bg-brand-700'
                    }`}
                  >
                    {enrollLoading
                      ? '...'
                      : myEnrollment
                      ? myEnrollment.status === 'WAITLIST'
                        ? 'Salir de lista de espera'
                        : 'Cancelar inscripción'
                      : isFull
                      ? 'Unirse a lista de espera'
                      : 'Inscribirse'}
                  </button>
                )}

                {/* Botones admin */}
                {canManageTrainings && (
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => handleEditTraining(t)}
                      className="flex-1 py-2.5 border border-brand-300 text-brand-700 rounded-lg text-sm font-medium hover:bg-brand-50 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setConfirmDeleteTraining(t)}
                      className="flex-1 py-2.5 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setSelectedTraining(null)}
                  className="w-full py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors mb-2"
                >
                  Cerrar
                </button>

                {/* Agendar en simultaneo — separado visualmente del flujo de inscripción */}
                <div className="border-t border-gray-100 pt-3 mt-1">
                  <button
                    onClick={() => {
                      setSelectedTraining(null);
                      handleSlotClick(start);
                    }}
                    className="w-full py-2 bg-gray-50 border border-gray-200 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Agendar una máquina en este horario
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {confirmDeleteTraining && (
        <ConfirmModal
          title="Eliminar capacitación"
          message={`¿Eliminar la capacitación "${confirmDeleteTraining.title}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={handleDeleteTraining}
          onCancel={() => setConfirmDeleteTraining(null)}
        />
      )}

      {/* Modal detalle de mantención */}
      {selectedMaintenance && (() => {
        const m = selectedMaintenance;
        const start = new Date(m.startTime);
        const end = new Date(m.endTime);
        const fmt = (d: Date) =>
          d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full mb-2">
                    <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
                    Cierre del espacio
                  </span>
                  <h2 className="text-lg font-bold text-gray-900">{m.title}</h2>
                </div>
                <button onClick={() => setSelectedMaintenance(null)} className="text-gray-400 hover:text-gray-600 transition-colors ml-4 shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {m.description && (
                <p className="text-sm text-gray-600 mb-4">{m.description}</p>
              )}

              <div className="space-y-2 text-sm text-gray-700 mb-5">
                <div className="flex gap-2">
                  <span className="text-gray-400 w-12 shrink-0">Inicio</span>
                  <span className="font-medium">{fmt(start)}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-400 w-12 shrink-0">Fin</span>
                  <span className="font-medium">{fmt(end)}</span>
                </div>
              </div>

              <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700 mb-4">
                ⚠️ No se pueden crear reservas durante este período.
              </div>

              {canManageMaintenance && (
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => {
                      setSelectedMaintenance(null);
                      setEditingMaintenance(m);
                      setMaintenanceModalOpen(true);
                    }}
                    className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      setSelectedMaintenance(null);
                      setConfirmDeleteMaintenance(m);
                    }}
                    className="flex-1 py-2.5 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              )}

              <button
                onClick={() => setSelectedMaintenance(null)}
                className="w-full py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        );
      })()}

      {confirmDeleteMaintenance && (
        <ConfirmModal
          title="Eliminar mantención"
          message={`¿Eliminar la mantención "${confirmDeleteMaintenance.title}"? El espacio volverá a estar disponible para reservas en ese período.`}
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={handleDeleteMaintenance}
          onCancel={() => setConfirmDeleteMaintenance(null)}
        />
      )}
    </div>
  );
}
