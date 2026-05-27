import { useEffect, useState } from 'react';
import { settingsService } from '../../services/settings.service';
import { BusinessHours } from '../../types';
import { useAuthStore } from '../../store/authStore';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 22; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`);
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`);
}

type DayState = Pick<BusinessHours, 'dayOfWeek' | 'isOpen' | 'openTime' | 'closeTime'>;

const DEFAULT_HOURS: DayState[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i,
  isOpen: i !== 0,
  openTime: '09:00',
  closeTime: '17:00',
}));

export default function SettingsPage() {
  const { currentSpaceId, user } = useAuthStore();
  const [days, setDays] = useState<DayState[]>(DEFAULT_HOURS);
  const [maxCapacity, setMaxCapacity] = useState<string>('12');
  const [maxCapacityReunion, setMaxCapacityReunion] = useState<string>('12');
  const [maxBookingMinutes, setMaxBookingMinutes] = useState<number>(240);
  const [lunchBreakEnabled, setLunchBreakEnabled] = useState(false);
  const [lunchBreakStart, setLunchBreakStart] = useState('13:00');
  const [lunchBreakEnd, setLunchBreakEnd] = useState('14:00');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // SUPER_ADMIN necesita tener un espacio seleccionado
    if (user?.role === 'SUPER_ADMIN' && !currentSpaceId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    settingsService.getBusinessHours().then((data) => {
      if (data.days.length === 7) {
        setDays(
          data.days
            .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
            .map(({ dayOfWeek, isOpen, openTime, closeTime }) => ({
              dayOfWeek, isOpen, openTime, closeTime,
            }))
        );
      }
      setMaxCapacity(String(data.maxCapacity));
      setMaxCapacityReunion(String(data.maxCapacityReunion));
      setMaxBookingMinutes(data.maxBookingMinutes ?? 240);
      setLunchBreakEnabled(data.lunchBreakEnabled ?? false);
      setLunchBreakStart(data.lunchBreakStart ?? '13:00');
      setLunchBreakEnd(data.lunchBreakEnd ?? '14:00');
    }).catch(() => {
      toast.error('Error al cargar horarios');
    }).finally(() => {
      setIsLoading(false);
    });
  }, [currentSpaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (dayOfWeek: number, patch: Partial<DayState>) => {
    setDays((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d))
    );
  };

  const handleSave = async () => {
    const parsedCapacity = parseInt(maxCapacity, 10);
    const parsedReunion = parseInt(maxCapacityReunion, 10);
    if (!parsedCapacity || parsedCapacity < 1 || !parsedReunion || parsedReunion < 1) {
      toast.error('El aforo debe ser un número mayor a 0');
      return;
    }
    if (lunchBreakEnabled) {
      if (!lunchBreakStart || !lunchBreakEnd) {
        toast.error('Define hora de inicio y término del horario de colación');
        return;
      }
      if (lunchBreakEnd <= lunchBreakStart) {
        toast.error('La hora de término de colación debe ser posterior a la hora de inicio');
        return;
      }
    }
    setIsSaving(true);
    try {
      await settingsService.updateBusinessHours(days, parsedCapacity, parsedReunion, maxBookingMinutes, lunchBreakEnabled, lunchBreakStart, lunchBreakEnd);
      toast.success('Configuración guardada correctamente');
    } catch {
      toast.error('Error al guardar configuración');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  if (user?.role === 'SUPER_ADMIN' && !currentSpaceId) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-center py-16 text-gray-400 text-sm">
          Selecciona un espacio en el menú superior para ver su configuración
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configuración del Espacio</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Define aforo máximo y los horarios de operación del espacio.
        </p>
      </div>

      {/* Aforo */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <h2 className="text-base font-semibold text-gray-800 mb-1">Aforo máximo</h2>
        <p className="text-sm text-gray-500 mb-4">
          Límite de personas que pueden usar el espacio al mismo tiempo. Se aplica al crear reservas.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Máquinas y talleres
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Total de personas usando máquinas en el mismo horario
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sala de reuniones
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={maxCapacityReunion}
              onChange={(e) => setMaxCapacityReunion(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Máximo de personas por reserva de sala de reuniones
            </p>
          </div>
        </div>
      </div>

      {/* Duración máxima de reserva */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <h2 className="text-base font-semibold text-gray-800 mb-1">Duración máxima de agendamiento</h2>
        <p className="text-sm text-gray-500 mb-4">
          Tiempo máximo que una usuaria puede reservar en una sola sesión.
        </p>
        <select
          value={maxBookingMinutes}
          onChange={(e) => setMaxBookingMinutes(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          {[30, 60, 90, 120, 150, 180, 210, 240].map((m) => {
            const h = Math.floor(m / 60);
            const min = m % 60;
            const label = min === 0
              ? `${h} hora${h > 1 ? 's' : ''}`
              : `${h}:${String(min).padStart(2, '0')} horas`;
            return <option key={m} value={m}>{label}</option>;
          })}
        </select>
      </div>

      {/* Hora de colación */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-800">Horario de colación</h2>
          <button
            type="button"
            onClick={() => setLunchBreakEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              lunchBreakEnabled ? 'bg-brand-600' : 'bg-gray-200'
            }`}
            role="switch"
            aria-checked={lunchBreakEnabled}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                lunchBreakEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Bloquea un rango horario diario para colación. Se marcará en rojo en el calendario y no se podrán crear reservas en ese horario.
        </p>
        {lunchBreakEnabled && (
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 whitespace-nowrap">Desde</label>
            <select
              value={lunchBreakStart}
              onChange={(e) => setLunchBreakStart(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <label className="text-xs text-gray-500 whitespace-nowrap">Hasta</label>
            <select
              value={lunchBreakEnd}
              onChange={(e) => setLunchBreakEnd(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              {TIME_OPTIONS.filter((t) => t > lunchBreakStart).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Horarios */}
      <h2 className="text-base font-semibold text-gray-800 mb-3">Horarios de operación</h2>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {days.map((day) => (
          <div key={day.dayOfWeek} className="px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              {/* Día + toggle */}
              <div className="flex items-center gap-3 min-w-[130px]">
                <button
                  type="button"
                  onClick={() => update(day.dayOfWeek, { isOpen: !day.isOpen })}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    day.isOpen ? 'bg-brand-600' : 'bg-gray-200'
                  }`}
                  role="switch"
                  aria-checked={day.isOpen}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                      day.isOpen ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className={`text-sm font-medium ${day.isOpen ? 'text-gray-900' : 'text-gray-400'}`}>
                  {DAY_NAMES[day.dayOfWeek]}
                </span>
              </div>

              {/* Selectores de hora */}
              {day.isOpen ? (
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <label className="text-xs text-gray-500 whitespace-nowrap">Desde</label>
                  <select
                    value={day.openTime}
                    onChange={(e) => update(day.dayOfWeek, { openTime: e.target.value })}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <label className="text-xs text-gray-500 whitespace-nowrap">Hasta</label>
                  <select
                    value={day.closeTime}
                    onChange={(e) => update(day.dayOfWeek, { closeTime: e.target.value })}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    {TIME_OPTIONS.filter((t) => t > day.openTime).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="text-sm text-gray-400 italic">Cerrado</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 bg-brand-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Guardando...
            </>
          ) : (
            'Guardar configuración'
          )}
        </button>
      </div>
    </div>
  );
}
