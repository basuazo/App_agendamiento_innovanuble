import { useState, useEffect } from 'react';
import { Resource, Training } from '../../types';
import { trainingService } from '../../services/training.service';
import { resourceService } from '../../services/resource.service';
import { formatTimeInput } from '../../utils/dateHelpers';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  preselectedDate?: Date;
  preselectedHour?: number;
  initialTraining?: Training; // modo edición
}

const isValidTime = (t: string) => /^\d{2}:\d{2}$/.test(t);

export default function TrainingModal({ isOpen, onClose, onSaved, preselectedDate, preselectedHour, initialTraining }: Props) {
  const isEditMode = !!initialTraining;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [capacity, setCapacity] = useState<string>('10');
  const [exemptIds, setExemptIds] = useState<string[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      resourceService.getAll().then(setResources).catch(() => {});
    }
  }, [isOpen]);

  // Inicializar campos cuando se abre en modo edición
  useEffect(() => {
    if (isOpen && initialTraining) {
      const start = new Date(initialTraining.startTime);
      const end = new Date(initialTraining.endTime);
      setTitle(initialTraining.title);
      setDescription(initialTraining.description ?? '');
      setDate(format(start, 'yyyy-MM-dd'));
      setStartTime(`${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`);
      setEndTime(`${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`);
      setCapacity(String(initialTraining.capacity));
      setExemptIds(initialTraining.exemptions.map((e) => e.resource.id));
    } else if (isOpen && !initialTraining) {
      resetForm();
    }
  }, [isOpen, initialTraining]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preseleccionar fecha/hora al crear nueva
  useEffect(() => {
    if (!initialTraining) {
      if (preselectedDate) setDate(format(preselectedDate, 'yyyy-MM-dd'));
      if (preselectedHour !== undefined) {
        setStartTime(`${String(preselectedHour).padStart(2, '0')}:00`);
        setEndTime(`${String(preselectedHour + 1).padStart(2, '0')}:00`);
      }
    }
  }, [preselectedDate, preselectedHour, initialTraining]);

  const toggleExempt = (id: string) => {
    setExemptIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('El título es requerido');
      return;
    }
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      toast.error('Las horas deben estar en formato HH:MM');
      return;
    }
    if (endTime <= startTime) {
      toast.error('La hora de fin debe ser posterior a la hora de inicio');
      return;
    }

    const startIso = new Date(`${date}T${startTime}:00`).toISOString();
    const endIso = new Date(`${date}T${endTime}:00`).toISOString();

    setLoading(true);
    try {
      if (isEditMode && initialTraining) {
        await trainingService.update(initialTraining.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          startTime: startIso,
          endTime: endIso,
          capacity: Math.max(1, parseInt(capacity, 10) || 10),
        });
        await trainingService.updateExemptions(initialTraining.id, exemptIds);
        toast.success('Capacitación actualizada');
      } else {
        await trainingService.create({
          title: title.trim(),
          description: description.trim() || undefined,
          startTime: startIso,
          endTime: endIso,
          capacity: Math.max(1, parseInt(capacity, 10) || 10),
          exemptResourceIds: exemptIds,
        });
        toast.success('Capacitación creada');
      }
      onSaved();
      onClose();
      resetForm();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? `Error al ${isEditMode ? 'actualizar' : 'crear'} la capacitación`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setStartTime('09:00');
    setEndTime('10:00');
    setCapacity('10');
    setExemptIds([]);
  };

  if (!isOpen) return null;

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isEditMode ? 'Editar Capacitación' : 'Bloquear para Capacitación'}
              </h2>
              {!isEditMode && (
                <p className="text-xs text-gray-500 mt-0.5">Bloquea todos los recursos en el horario indicado</p>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Título */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título de la capacitación *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Taller de costura básica"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Información adicional sobre la capacitación..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
              <input
                type="date"
                value={date}
                min={today}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Hora inicio y fin */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio *</label>
                <input
                  type="text"
                  value={startTime}
                  onChange={(e) => setStartTime(formatTimeInput(e.target.value))}
                  placeholder="HH:MM"
                  maxLength={5}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    startTime && !isValidTime(startTime) ? 'border-red-400' : 'border-gray-300'
                  }`}
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
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    endTime && (!isValidTime(endTime) || endTime <= startTime) ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
              </div>
            </div>

            {/* Capacidad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cupos disponibles *</label>
              <input
                type="number"
                min={1}
                max={100}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-xs text-gray-400 mt-1">Usuarias que pueden inscribirse con cupo confirmado</p>
            </div>

            {/* Recursos exentos */}
            {resources.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Liberar recursos del bloqueo{' '}
                  <span className="text-xs text-gray-400 font-normal">(los marcados seguirán disponibles)</span>
                </label>
                <div className="border border-gray-200 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                  {resources.filter((r) => r.isActive).map((r) => (
                    <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exemptIds.includes(r.id)}
                        onChange={() => toggleExempt(r.id)}
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-gray-700">{r.name}</span>
                      <span className="text-xs text-gray-400">({r.category.name})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!isEditMode && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700">
                  <strong>Importante:</strong> Se bloqueará la agenda de todos los recursos no liberados en este horario.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-60 transition-colors"
              >
                {loading
                  ? isEditMode ? 'Guardando...' : 'Creando...'
                  : isEditMode ? 'Guardar cambios' : 'Crear Capacitación'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
