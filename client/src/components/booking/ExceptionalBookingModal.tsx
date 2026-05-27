import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Resource, BookingPurpose } from '../../types';
import { bookingService, CreateBookingDto } from '../../services/booking.service';
import { formatTimeInput, PURPOSE_LABELS } from '../../utils/dateHelpers';
import { getApiError } from '../../utils/apiError';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  resources: Resource[];
  preselectedDate?: Date;
}

function isValidTime(t: string): boolean {
  return /^\d{2}:\d{2}$/.test(t);
}

export default function ExceptionalBookingModal({ isOpen, onClose, resources, preselectedDate }: Props) {
  const [resourceId, setResourceId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState<BookingPurpose>('LEARN');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const activeResources = resources.filter((r) => r.isActive);

  useEffect(() => {
    if (isOpen) {
      setResourceId(activeResources[0]?.id ?? '');
      if (preselectedDate) {
        const d = preselectedDate;
        setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        setStartTime(`${h}:${m}`);
        const eH = String(d.getHours() + 1).padStart(2, '0');
        setEndTime(`${eH}:${m}`);
      } else {
        setDate('');
        setStartTime('09:00');
        setEndTime('10:00');
      }
      setPurpose('LEARN');
      setNotes('');
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceId || !date || !startTime || !endTime) {
      toast.error('Completa todos los campos obligatorios');
      return;
    }
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      toast.error('Hora inválida (usa formato HH:MM)');
      return;
    }
    if (startTime >= endTime) {
      toast.error('La hora de término debe ser posterior a la de inicio');
      return;
    }

    const startIso = new Date(`${date}T${startTime}:00`).toISOString();
    const endIso = new Date(`${date}T${endTime}:00`).toISOString();

    const dto: CreateBookingDto & { isExceptional: boolean } = {
      resourceId,
      startTime: startIso,
      endTime: endIso,
      purpose,
      notes: notes || undefined,
      isExceptional: true,
    };

    setLoading(true);
    try {
      await bookingService.create(dto as CreateBookingDto);
      toast.success('Reserva excepcional creada');
      onClose();
    } catch (err) {
      toast.error(getApiError(err, 'Error al crear la reserva'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-700 bg-orange-100 px-2.5 py-0.5 rounded-full">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                Solo administradoras
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Agendar Hora Excepcional</h2>
            <p className="text-sm text-gray-500 mt-0.5">Sin restricciones de horario ni duración</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recurso */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Máquina / Recurso *</label>
            <select
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
            >
              <option value="">Selecciona un recurso...</option>
              {activeResources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.category?.name}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Horas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio *</label>
              <input
                type="text"
                value={startTime}
                onChange={(e) => setStartTime(formatTimeInput(e.target.value))}
                placeholder="HH:MM"
                maxLength={5}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin *</label>
              <input
                type="text"
                value={endTime}
                onChange={(e) => setEndTime(formatTimeInput(e.target.value))}
                placeholder="HH:MM"
                maxLength={5}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Propósito */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Propósito *</label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as BookingPurpose)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
            >
              {(Object.entries(PURPOSE_LABELS) as [BookingPurpose, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Motivo o descripción del agendamiento excepcional..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-60 transition-colors">
              {loading ? 'Creando...' : 'Crear Reserva Excepcional'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
