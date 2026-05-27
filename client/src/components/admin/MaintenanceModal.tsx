import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Maintenance } from '../../types';
import { maintenanceService } from '../../services/maintenance.service';
import { formatTimeInput } from '../../utils/dateHelpers';
import { getApiError } from '../../utils/apiError';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  preselectedDate?: Date;
  initialMaintenance?: Maintenance;
}

function isValidTime(t: string): boolean {
  return /^\d{2}:\d{2}$/.test(t);
}

function parseDateParts(iso: string) {
  const d = new Date(iso);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { date, time };
}

export default function MaintenanceModal({ isOpen, onClose, onSaved, preselectedDate, initialMaintenance }: Props) {
  const isEditing = !!initialMaintenance;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('18:00');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (initialMaintenance) {
      setTitle(initialMaintenance.title);
      setDescription(initialMaintenance.description ?? '');
      const s = parseDateParts(initialMaintenance.startTime);
      const e = parseDateParts(initialMaintenance.endTime);
      setStartDate(s.date);
      setStartTime(s.time);
      setEndDate(e.date);
      setEndTime(e.time);
    } else {
      setTitle('');
      setDescription('');
      if (preselectedDate) {
        const d = preselectedDate;
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        setStartDate(date);
        setEndDate(date);
      } else {
        setStartDate('');
        setEndDate('');
      }
      setStartTime('09:00');
      setEndTime('18:00');
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) {
      toast.error('Completa título y fechas');
      return;
    }
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      toast.error('Hora inválida (HH:MM)');
      return;
    }
    const startIso = new Date(`${startDate}T${startTime}:00`).toISOString();
    const endIso = new Date(`${endDate}T${endTime}:00`).toISOString();
    if (new Date(startIso) >= new Date(endIso)) {
      toast.error('La fecha/hora de fin debe ser posterior al inicio');
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        await maintenanceService.update(initialMaintenance!.id, { title, description, startTime: startIso, endTime: endIso });
        toast.success('Mantención actualizada');
      } else {
        await maintenanceService.create({ title, description, startTime: startIso, endTime: endIso });
        toast.success('Mantención creada');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(getApiError(err, 'Error al guardar'));
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
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Cierre del espacio
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">{isEditing ? 'Editar Mantención' : 'Nueva Mantención'}</h2>
            <p className="text-sm text-gray-500 mt-0.5">Bloquea el agendamiento durante el período indicado</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors mt-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Mantención preventiva equipos"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Detalle opcional de la mantención..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          {/* Inicio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Inicio</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value); }}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Hora</label>
                <input
                  type="text"
                  value={startTime}
                  onChange={(e) => setStartTime(formatTimeInput(e.target.value))}
                  placeholder="HH:MM"
                  maxLength={5}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
          </div>

          {/* Fin */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fin</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Hora</label>
                <input
                  type="text"
                  value={endTime}
                  onChange={(e) => setEndTime(formatTimeInput(e.target.value))}
                  placeholder="HH:MM"
                  maxLength={5}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700">
            ⚠️ Durante este período <strong>no se podrán crear reservas</strong> en el espacio.
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition-colors">
              {loading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear Mantención'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
