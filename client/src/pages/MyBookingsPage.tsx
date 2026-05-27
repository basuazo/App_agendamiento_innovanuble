import { useEffect, useState } from 'react';
import { useBookingStore } from '../store/bookingStore';
import { useAuthStore } from '../store/authStore';
import { Training } from '../types';
import { Booking } from '../types';
import { formatDateTime, PURPOSE_LABELS } from '../utils/dateHelpers';
import { trainingService } from '../services/training.service';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  CONFIRMED:  { label: 'Confirmada',  className: 'bg-green-100 text-green-700' },
  PENDING:    { label: 'Pend. aprobación', className: 'bg-amber-100 text-amber-700' },
  CANCELLED:  { label: 'Cancelada',   className: 'bg-red-100 text-red-600' },
  REJECTED:   { label: 'Rechazada',   className: 'bg-red-100 text-red-700' },
};

export default function MyBookingsPage() {
  const { myBookings, fetchMine, cancel, isLoading } = useBookingStore();
  const { user, currentSpaceId } = useAuthStore();

  // Tab principal
  const [mainTab, setMainTab] = useState<'machines' | 'trainings'>('machines');

  // Sub-tab de máquinas
  const [machineTab, setMachineTab] = useState<'upcoming' | 'history'>('upcoming');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Capacitaciones
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [trainingsLoading, setTrainingsLoading] = useState(true);
  const [trainingFilter, setTrainingFilter] = useState<'mine' | 'all'>('mine');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchMine();
  }, [fetchMine]);

  const loadTrainings = async () => {
    try {
      setTrainingsLoading(true);
      const data = await trainingService.getAll();
      setTrainings(data);
    } catch {
      toast.error('Error al cargar capacitaciones');
    } finally {
      setTrainingsLoading(false);
    }
  };

  useEffect(() => {
    loadTrainings();
  }, [currentSpaceId]);

  // --- Lógica reservas de máquina ---
  const now = new Date();

  function groupMyBookings(list: Booking[]) {
    const map = new Map<string, Booking[]>();
    for (const b of list) {
      const key = `${b.startTime}_${b.endTime}_${b.purpose}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return Array.from(map.values());
  }

  const upcomingRaw = myBookings.filter(
    (b) => (b.status === 'CONFIRMED' || b.status === 'PENDING') && new Date(b.startTime) > now
  );
  const historyRaw = myBookings.filter(
    (b) => b.status === 'CANCELLED' || b.status === 'REJECTED' || new Date(b.startTime) <= now
  );
  const upcomingGroups = groupMyBookings(upcomingRaw);
  const historyGroups = groupMyBookings(historyRaw);
  const machineGroups = machineTab === 'upcoming' ? upcomingGroups : historyGroups;

  const handleCancel = async (group: Booking[]) => {
    if (!confirm('¿Seguro que deseas cancelar esta reserva?')) return;
    setCancellingId(group[0].id);
    try {
      for (const b of group) await cancel(b.id);
      toast.success('Reserva cancelada');
      fetchMine();
    } catch {
      toast.error('Error al cancelar la reserva');
    } finally {
      setCancellingId(null);
    }
  };

  // --- Lógica capacitaciones ---
  const upcomingTrainings = trainings.filter((t) => new Date(t.endTime) >= now);
  const myTrainings = upcomingTrainings.filter((t) => t.enrollments.some((e) => e.userId === user?.id));
  const displayedTrainings = trainingFilter === 'mine' ? myTrainings : upcomingTrainings;

  const handleEnroll = async (t: Training) => {
    const myEnrollment = t.enrollments.find((e) => e.userId === user?.id);
    setActionLoading(t.id);
    try {
      if (myEnrollment) {
        await trainingService.unenroll(t.id);
        toast.success('Inscripción cancelada');
      } else {
        await trainingService.enroll(t.id);
        const confirmedCount = t.enrollments.filter((e) => e.status === 'CONFIRMED').length;
        toast.success(confirmedCount >= t.capacity ? 'Agregada a lista de espera' : 'Inscripción confirmada');
      }
      loadTrainings();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Error al procesar inscripción');
    } finally {
      setActionLoading(null);
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mis Reservas</h1>

      {/* Tabs principales */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        <button
          onClick={() => setMainTab('machines')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mainTab === 'machines' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Reservas de Máquina
        </button>
        <button
          onClick={() => setMainTab('trainings')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mainTab === 'trainings' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Capacitaciones
        </button>
      </div>

      {/* ---- RESERVAS DE MÁQUINA ---- */}
      {mainTab === 'machines' && (
        <>
          <div className="flex gap-1 bg-gray-50 border border-gray-200 p-1 rounded-lg w-fit mb-5">
            <button
              onClick={() => setMachineTab('upcoming')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                machineTab === 'upcoming' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Próximas ({upcomingGroups.length})
            </button>
            <button
              onClick={() => setMachineTab('history')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                machineTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Historial ({historyGroups.length})
            </button>
          </div>

          {isLoading ? (
            <LoadingSpinner />
          ) : machineGroups.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">No hay reservas en esta sección</p>
            </div>
          ) : (
            <div className="space-y-3">
              {machineGroups.map((group) => (
                <BookingGroupCard
                  key={`${group[0].startTime}_${group[0].endTime}_${group[0].purpose}`}
                  bookings={group}
                  onCancel={machineTab === 'upcoming' ? handleCancel : undefined}
                  isCancelling={cancellingId === group[0].id}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ---- CAPACITACIONES ---- */}
      {mainTab === 'trainings' && (
        <>
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => setTrainingFilter('mine')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                trainingFilter === 'mine'
                  ? 'bg-brand-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Mis inscripciones {myTrainings.length > 0 && `(${myTrainings.length})`}
            </button>
            <button
              onClick={() => setTrainingFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                trainingFilter === 'all'
                  ? 'bg-brand-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Todas las próximas {upcomingTrainings.length > 0 && `(${upcomingTrainings.length})`}
            </button>
          </div>

          {trainingsLoading ? (
            <LoadingSpinner />
          ) : displayedTrainings.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="text-sm">
                {trainingFilter === 'mine'
                  ? 'No estás inscrita en ninguna capacitación próxima'
                  : 'No hay capacitaciones próximas disponibles'}
              </p>
              {trainingFilter === 'mine' && upcomingTrainings.length > 0 && (
                <button
                  onClick={() => setTrainingFilter('all')}
                  className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium"
                >
                  Ver todas las capacitaciones disponibles →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedTrainings.map((t) => {
                const myEnrollment = t.enrollments.find((e) => e.userId === user?.id);
                const confirmedCount = t.enrollments.filter((e) => e.status === 'CONFIRMED').length;
                const waitlistCount = t.enrollments.filter((e) => e.status === 'WAITLIST').length;
                const isFull = confirmedCount >= t.capacity;
                const loading = actionLoading === t.id;

                return (
                  <div key={t.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-gray-900">{t.title}</h3>
                          {myEnrollment && (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              myEnrollment.status === 'CONFIRMED'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {myEnrollment.status === 'CONFIRMED' ? 'Inscrita' : 'En lista de espera'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 capitalize">{fmtDate(t.startTime)}</p>
                        <p className="text-sm text-gray-500">{fmtTime(t.startTime)} – {fmtTime(t.endTime)}</p>
                        {t.description && (
                          <p className="text-sm text-gray-400 mt-1">{t.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span>{confirmedCount}/{t.capacity} cupos ocupados</span>
                          {waitlistCount > 0 && (
                            <span className="text-amber-600">{waitlistCount} en espera</span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <button
                          onClick={() => handleEnroll(t)}
                          disabled={loading || (!myEnrollment && isFull && waitlistCount >= 20)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 whitespace-nowrap ${
                            myEnrollment
                              ? 'border border-red-200 text-red-500 hover:bg-red-50'
                              : isFull
                              ? 'bg-amber-500 text-white hover:bg-amber-600'
                              : 'bg-brand-600 text-white hover:bg-brand-700'
                          }`}
                        >
                          {loading
                            ? '...'
                            : myEnrollment
                            ? 'Cancelar'
                            : isFull
                            ? 'Lista de espera'
                            : 'Inscribirse'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BookingGroupCard({
  bookings,
  onCancel,
  isCancelling,
}: {
  bookings: Booking[];
  onCancel?: (group: Booking[]) => void;
  isCancelling: boolean;
}) {
  const first = bookings[0];
  const badge = STATUS_BADGE[first.status] ?? { label: first.status, className: 'bg-gray-100 text-gray-600' };
  const faded = first.status === 'CANCELLED' || first.status === 'REJECTED';

  return (
    <div className={`bg-white rounded-xl border p-4 ${faded ? 'opacity-60 border-gray-200' : 'border-gray-100 shadow-sm'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm text-gray-500">{formatDateTime(first.startTime)} — {formatDateTime(first.endTime).split(' ')[1]}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${badge.className}`}>
          {badge.label}
        </span>
      </div>
      <div className="space-y-1.5 mb-2">
        {bookings.map((b) => (
          <div key={b.id} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: b.resource.category?.color ?? '#6b7280' }} />
            <span className="text-sm font-medium text-gray-900">{b.resource.name}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="flex flex-wrap gap-2">
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {PURPOSE_LABELS[first.purpose]}
          </span>
          {first.purpose === 'PRODUCE' && first.produceItem && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
              {first.produceItem} x{first.produceQty}
            </span>
          )}
          {first.notes && (
            <span className="text-xs text-gray-400 italic truncate max-w-xs">{first.notes}</span>
          )}
        </div>
        {onCancel && (first.status === 'CONFIRMED' || first.status === 'PENDING') && (
          <button
            onClick={() => onCancel(bookings)}
            disabled={isCancelling}
            className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-60 flex-shrink-0"
          >
            {isCancelling ? '...' : 'Cancelar'}
          </button>
        )}
      </div>
    </div>
  );
}
