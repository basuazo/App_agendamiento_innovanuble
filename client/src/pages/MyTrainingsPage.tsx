import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Training } from '../types';
import { trainingService } from '../services/training.service';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

export default function MyTrainingsPage() {
  const { user, currentSpaceId } = useAuthStore();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'mine' | 'all'>('mine');

  const load = async () => {
    try {
      setIsLoading(true);
      const data = await trainingService.getAll();
      setTrainings(data);
    } catch {
      toast.error('Error al cargar capacitaciones');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentSpaceId]);

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
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Error al procesar inscripción');
    } finally {
      setActionLoading(null);
    }
  };

  const now = new Date();
  const upcoming = trainings.filter((t) => new Date(t.endTime) >= now);
  const myTrainings = upcoming.filter((t) => t.enrollments.some((e) => e.userId === user?.id));
  const displayed = filter === 'mine' ? myTrainings : upcoming;

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Capacitaciones</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Inscríbete en las sesiones disponibles para tu espacio
        </p>
      </div>

      {/* Filtro */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setFilter('mine')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filter === 'mine'
              ? 'bg-brand-600 text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Mis inscripciones {myTrainings.length > 0 && `(${myTrainings.length})`}
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-brand-600 text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Todas las próximas {upcoming.length > 0 && `(${upcoming.length})`}
        </button>
      </div>

      {displayed.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-sm">
            {filter === 'mine'
              ? 'No estás inscrita en ninguna capacitación próxima'
              : 'No hay capacitaciones próximas disponibles'}
          </p>
          {filter === 'mine' && upcoming.length > 0 && (
            <button
              onClick={() => setFilter('all')}
              className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              Ver todas las capacitaciones disponibles →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((t) => {
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
                    <p className="text-sm text-gray-500">
                      {fmtTime(t.startTime)} – {fmtTime(t.endTime)}
                    </p>
                    {t.description && (
                      <p className="text-sm text-gray-400 mt-1">{t.description}</p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>
                        {confirmedCount}/{t.capacity} cupos ocupados
                      </span>
                      {waitlistCount > 0 && (
                        <span className="text-amber-600">{waitlistCount} en espera</span>
                      )}
                    </div>
                  </div>

                  {/* Botón de acción */}
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
    </div>
  );
}
