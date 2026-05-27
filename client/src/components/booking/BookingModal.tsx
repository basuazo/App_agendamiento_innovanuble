import { useState, useEffect, useCallback } from 'react';
import { Resource, ResourceAvailability, Category, Certification, User, BusinessHours } from '../../types';
import { useBookingStore } from '../../store/bookingStore';
import { useResourceStore } from '../../store/resourceStore';
import { useAuthStore } from '../../store/authStore';
import { bookingService } from '../../services/booking.service';
import { certificationService } from '../../services/certification.service';
import { userService } from '../../services/user.service';
import { PURPOSE_LABELS, formatTimeInput } from '../../utils/dateHelpers';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  preselectedDate?: Date;
  preselectedResource?: Resource;
  businessHours?: BusinessHours[];
  maxBookingMinutes?: number;
}

export default function BookingModal({ isOpen, onClose, preselectedDate, preselectedResource, businessHours = [], maxBookingMinutes = 240 }: Props) {
  const { create } = useBookingStore();
  const { resources, fetchAll } = useResourceStore();
  const { user } = useAuthStore();
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'LIDER_COMUNITARIA'].includes(user?.role ?? '');

  // Step 0 (admin only): user selection
  const [bookingForSelf, setBookingForSelf] = useState(true);
  const [targetUserId, setTargetUserId] = useState('');
  const [adminUsers, setAdminUsers] = useState<User[]>([]);

  // Step 1: category selection
  const [step, setStep] = useState<0 | 1 | 2>(isAdmin ? 0 : 1);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [certifications, setCertifications] = useState<Certification[]>([]);

  // Step 2: machine + booking details
  const [resourceId, setResourceId] = useState(preselectedResource?.id ?? '');
  const [date, setDate] = useState(
    preselectedDate ? format(preselectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [purpose, setPurpose] = useState<'LEARN' | 'PRODUCE' | 'DESIGN'>('LEARN');
  const [isPrivate, setIsPrivate] = useState(false);
  const [produceItem, setProduceItem] = useState('');
  const [produceQty, setProduceQty] = useState<string>('1');
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [withCompanions, setWithCompanions] = useState(false);
  const [companionCount, setCompanionCount] = useState<string>('1');
  const [companionRelation, setCompanionRelation] = useState<'CUIDADOS' | 'AMISTAD' | 'OTRO'>('AMISTAD');
  const [reunionAttendees, setReunionAttendees] = useState<string>('2');
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<ResourceAvailability | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAll();
      if (!isAdmin) {
        certificationService.getMyCertifications().then(setCertifications).catch(() => {});
      } else {
        userService.getAll().then((list) => setAdminUsers(list.filter((u) => u.id !== user?.id))).catch(() => {});
      }
    }
  }, [isOpen, fetchAll, isAdmin, user?.id]);

  useEffect(() => {
    if (preselectedDate) {
      setDate(format(preselectedDate, 'yyyy-MM-dd'));
      const h = preselectedDate.getHours();
      const m = preselectedDate.getMinutes();
      const clampedH = h >= 9 && h <= 16 ? h : 9;
      setStartTime(`${String(clampedH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      const endDate = new Date(preselectedDate.getTime() + 60 * 60 * 1000);
      setEndTime(`${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`);
    }
  }, [preselectedDate]);

  useEffect(() => {
    if (preselectedResource) {
      setSelectedCategory(preselectedResource.category);
      setResourceId(preselectedResource.id);
      if (!isAdmin) setStep(2);
    }
  }, [preselectedResource, isAdmin]);

  // Horario del día seleccionado (usar T12:00:00 para evitar desfase UTC al parsear solo la fecha)
  const dayHours = date
    ? businessHours.find((h) => h.dayOfWeek === new Date(`${date}T12:00:00`).getDay()) ?? null
    : null;

  const isValidTime = (t: string) => /^\d{2}:\d{2}$/.test(t);

  const fetchAvailability = useCallback(async () => {
    if (!date || !isValidTime(startTime) || !isValidTime(endTime)) return;
    setCheckingAvailability(true);
    try {
      const startIso = new Date(`${date}T${startTime}:00`).toISOString();
      const endIso = new Date(`${date}T${endTime}:00`).toISOString();
      if (new Date(endIso) <= new Date(startIso)) { setAvailability(null); return; }
      const data = await bookingService.getAvailability(startIso, endIso);
      setAvailability(data);
      if (resourceId && data[resourceId] && data[resourceId].status !== 'available') {
        setResourceId('');
      }
    } catch {
      setAvailability(null);
    } finally {
      setCheckingAvailability(false);
    }
  }, [date, startTime, endTime, resourceId]);

  useEffect(() => {
    if (isOpen && step === 2 && date) fetchAvailability();
  }, [isOpen, step, date, startTime, endTime]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const resetForm = () => {
    setStep(isAdmin ? 0 : 1);
    setSelectedCategory(null);
    setResourceId('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setStartTime('09:00');
    setEndTime('10:00');
    setPurpose('LEARN');
    setProduceItem('');
    setProduceQty('1');
    setNotes('');
    setQuantity(1);
    setIsPrivate(false);
    setWithCompanions(false);
    setCompanionCount('1');
    setCompanionRelation('AMISTAD');
    setReunionAttendees('2');
    setAvailability(null);
    setBookingForSelf(true);
    setTargetUserId('');
  };

  const handleClose = () => { onClose(); resetForm(); };

  const handleUserStepContinue = () => {
    if (!bookingForSelf && !targetUserId) {
      toast.error('Selecciona una usuaria');
      return;
    }
    // If a resource was preselected, skip category selection
    setStep(preselectedResource ? 2 : 1);
  };

  const handleCategorySelect = (cat: Category) => {
    setSelectedCategory(cat);
    setQuantity(1);
    setIsPrivate(false);
    setWithCompanions(false);
    setCompanionCount('1');
    setCompanionRelation('AMISTAD');
    // Para Espacio de Reuniones, auto-seleccionar el único recurso
    if (cat.slug === 'ESPACIO_REUNION') {
      const reunionResource = resources.find((r) => r.isActive && r.categoryId === cat.id);
      setResourceId(reunionResource?.id ?? '');
    } else {
      setResourceId('');
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceId) {
      toast.error(selectedCategory?.slug === 'ESPACIO_REUNION'
        ? 'El espacio de reuniones no está disponible en este horario'
        : 'Selecciona una máquina');
      return;
    }

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      toast.error('Ingresa las horas en formato HH:MM (ej: 09:00)');
      return;
    }

    const startDate = new Date(`${date}T${startTime}:00`);
    const endDate = new Date(`${date}T${endTime}:00`);

    if (endDate <= startDate) {
      toast.error('La hora de término debe ser después de la hora de inicio');
      return;
    }
    const durationMs = endDate.getTime() - startDate.getTime();
    if (durationMs > maxBookingMinutes * 60 * 1000) {
      const h = Math.floor(maxBookingMinutes / 60); const m = maxBookingMinutes % 60;
      const label = m === 0 ? `${h} hora${h > 1 ? 's' : ''}` : `${h}:${String(m).padStart(2,'0')} horas`;
      toast.error(`La reserva no puede durar más de ${label}`);
      return;
    }

    // Validar horario de negocio
    if (dayHours && businessHours.length > 0) {
      if (!dayHours.isOpen) {
        toast.error('El espacio no abre ese día');
        return;
      }
      if (startTime < dayHours.openTime) {
        toast.error(`El espacio abre a las ${dayHours.openTime}. Ajusta la hora de inicio.`);
        return;
      }
      if (endTime > dayHours.closeTime) {
        toast.error(`El espacio cierra a las ${dayHours.closeTime}. Ajusta la hora de término.`);
        return;
      }
    }

    const parsedProduceQty = Math.max(1, parseInt(produceQty, 10) || 1);
    const parsedCompanionCount = Math.max(1, parseInt(companionCount, 10) || 1);
    const parsedReunionAttendees = Math.max(1, parseInt(reunionAttendees, 10) || 1);

    setLoading(true);
    try {
      await create({
        resourceId,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        purpose: selectedCategory?.slug === 'ESPACIO_REUNION' ? 'REUNION' : purpose,
        produceItem: purpose === 'PRODUCE' ? produceItem : undefined,
        produceQty: purpose === 'PRODUCE' ? parsedProduceQty : undefined,
        quantity: selectedCategory?.slug === 'MESON_CORTE' ? quantity : 1,
        notes: notes || undefined,
        isPrivate: selectedCategory?.slug === 'ESPACIO_REUNION' ? isPrivate : undefined,
        attendees: selectedCategory?.slug === 'ESPACIO_REUNION' ? parsedReunionAttendees : (withCompanions ? 1 + parsedCompanionCount : undefined),
        companionRelation: selectedCategory?.slug !== 'ESPACIO_REUNION' && withCompanions ? companionRelation : undefined,
        targetUserId: isAdmin && !bookingForSelf && targetUserId ? targetUserId : undefined,
        localDate: date,
        localStartTime: startTime,
        localEndTime: endTime,
      });
      const selectedResource = categoryResources.find((r) => r.id === resourceId);
      const willBeConfirmed =
        isAdmin ||
        (selectedCategory?.slug === 'ESPACIO_REUNION'
          ? !isPrivate && certifications.some((c) => c.categoryId === selectedCategory?.id)
          : !selectedResource?.requiresCertification ||
            certifications.some((c) => c.categoryId === selectedCategory?.id));
      toast.success(
        willBeConfirmed
          ? '¡Reserva confirmada!'
          : 'Reserva enviada — quedará pendiente de aprobación del administrador'
      );
      handleClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Error al crear la reserva');
    } finally {
      setLoading(false);
    }
  };

  const isCertifiedFor = (cat: Category) => {
    const catResources = resources.filter((r) => r.isActive && r.categoryId === cat.id);
    const requiresCert = catResources.some((r) => r.requiresCertification);
    if (!requiresCert) return true;
    return isAdmin || certifications.some((c) => c.categoryId === cat.id);
  };

  const categoryResources = resources.filter(
    (r) => r.isActive && r.categoryId === selectedCategory?.id
  );

  const isResourceDisabled = (r: Resource) => {
    if (!availability) return false;
    const av = availability[r.id];
    return !!av && av.status !== 'available';
  };

  const getResourceLabel = (r: Resource) => {
    if (!availability) return r.name;
    const av = availability[r.id];
    if (!av || av.status === 'available') {
      if (r.capacity > 1 && av?.availableCapacity !== undefined) {
        return `${r.name} (${av.availableCapacity} de ${r.capacity} disponibles)`;
      }
      return r.name;
    }
    return `${r.name} — ${av.reason}`;
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const notCertifiedWarning = selectedCategory
    && selectedCategory.slug !== 'ESPACIO_REUNION'
    && !isCertifiedFor(selectedCategory);

  // ── Step 0: Admin user selection ─────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Nueva Reserva</h2>
              <p className="text-sm text-gray-500 mt-0.5">¿Para quién agenda?</p>
            </div>
            <button onClick={handleClose} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full p-1 -m-1 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-3 mb-6">
            <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
              bookingForSelf ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                checked={bookingForSelf}
                onChange={() => { setBookingForSelf(true); setTargetUserId(''); }}
                className="accent-brand-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Para mí</p>
                <p className="text-xs text-gray-500">Agendo en mi nombre</p>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
              !bookingForSelf ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="radio"
                checked={!bookingForSelf}
                onChange={() => setBookingForSelf(false)}
                className="accent-brand-600 mt-0.5"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Para otra usuaria</p>
                <p className="text-xs text-gray-500 mb-2">Selecciona la persona</p>
                {!bookingForSelf && (
                  <select
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Seleccionar usuaria...</option>
                    {adminUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {u.email}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleUserStepContinue}
              className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: Category grid ────────────────────────────────────────────────
  if (step === 1) {
    // Derivar categorías únicas desde los recursos activos
    const categoryMap = new Map<string, Category>();
    for (const r of resources) {
      if (r.isActive && !categoryMap.has(r.categoryId)) {
        categoryMap.set(r.categoryId, r.category);
      }
    }
    const availableCategories = Array.from(categoryMap.values()).sort((a, b) => a.order - b.order);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                {isAdmin && (
                  <button
                    onClick={() => setStep(0)}
                    className="text-xs text-brand-600 hover:underline mb-1 flex items-center gap-1"
                  >
                    ← Cambiar usuaria
                  </button>
                )}
                <h2 className="text-xl font-bold text-gray-900">Nueva Reserva</h2>
                <p className="text-sm text-gray-500 mt-0.5">Selecciona una categoría de máquina</p>
                {isAdmin && !bookingForSelf && targetUserId && (
                  <p className="text-xs text-brand-700 font-medium mt-0.5">
                    Para: {adminUsers.find((u) => u.id === targetUserId)?.name}
                  </p>
                )}
              </div>
              <button onClick={handleClose} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full p-1 -m-1 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {availableCategories.map((cat) => {
                const certified = isCertifiedFor(cat);
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat)}
                    className="relative p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] hover:shadow-md"
                    style={{ borderColor: cat.color + '60' }}
                  >
                    <div
                      className="w-8 h-8 rounded-full mb-2"
                      style={{ backgroundColor: cat.color + '20' }}
                    >
                      <div className="w-3 h-3 rounded-full m-2.5" style={{ backgroundColor: cat.color }} />
                    </div>
                    <p className="text-sm font-semibold text-gray-800 leading-tight">
                      {cat.name}
                    </p>
                    <p className="text-xs mt-1.5">
                      {certified ? (
                        <span className="text-emerald-600 font-medium">✓ Certificada</span>
                      ) : (
                        <span className="text-amber-600 font-medium">Sin certificación</span>
                      )}
                    </p>
                  </button>
                );
              })}
            </div>

            {!isAdmin && (
              <p className="text-xs text-gray-400 mt-4 text-center">
                Sin certificación, tu reserva quedará pendiente de aprobación
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Machine + booking details ───────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              {isAdmin && !bookingForSelf && targetUserId && (
                <p className="text-xs text-brand-700 font-medium mb-1">
                  Agendando para: {adminUsers.find((u) => u.id === targetUserId)?.name}
                </p>
              )}
              <h2 className="text-xl font-bold text-gray-900">Nueva Reserva</h2>
              {selectedCategory && (
                <p className="text-sm text-gray-500 mt-0.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: selectedCategory.color }}
                  />
                  {selectedCategory.name}
                </p>
              )}
            </div>
            <button onClick={handleClose} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full p-1 -m-1 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {notCertifiedWarning && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              <p className="text-xs text-amber-800 font-medium">
                ⚠️ No tienes certificación en esta categoría. Tu reserva quedará pendiente de aprobación del administrador.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
              {dayHours && (
                dayHours.isOpen
                  ? <p className="text-xs text-gray-400 mt-1">Horario del espacio: {dayHours.openTime} – {dayHours.closeTime}</p>
                  : <p className="text-xs text-red-500 mt-1">El espacio no abre ese día</p>
              )}
            </div>

            {/* Hora inicio / término */}
            {(() => {
              const startOutOfRange = dayHours?.isOpen && isValidTime(startTime) && startTime < dayHours.openTime;
              const endOutOfRange = dayHours?.isOpen && isValidTime(endTime) && endTime > dayHours.closeTime;
              const baseInput = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2';
              return (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora de inicio *</label>
                    <input
                      type="text"
                      value={startTime}
                      onChange={(e) => setStartTime(formatTimeInput(e.target.value))}
                      placeholder="HH:MM"
                      maxLength={5}
                      className={`${baseInput} ${startOutOfRange ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-brand-500'}`}
                    />
                    {startOutOfRange && (
                      <p className="text-xs text-red-500 mt-0.5">Antes de apertura ({dayHours!.openTime})</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hora de término *</label>
                    <input
                      type="text"
                      value={endTime}
                      onChange={(e) => setEndTime(formatTimeInput(e.target.value))}
                      placeholder="HH:MM"
                      maxLength={5}
                      className={`${baseInput} ${endOutOfRange ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-brand-500'}`}
                    />
                    {endOutOfRange && (
                      <p className="text-xs text-red-500 mt-0.5">Después del cierre ({dayHours!.closeTime})</p>
                    )}
                  </div>
                </div>
              );
            })()}
            {(() => {
              if (!isValidTime(startTime) || !isValidTime(endTime)) return null;
              const s = new Date(`2000-01-01T${startTime}:00`);
              const e = new Date(`2000-01-01T${endTime}:00`);
              const diffMs = e.getTime() - s.getTime();
              if (diffMs <= 0) return (
                <p className="text-xs text-red-500 -mt-3">La hora de término debe ser después del inicio</p>
              );
              if (diffMs > maxBookingMinutes * 60 * 1000) {
                const h = Math.floor(maxBookingMinutes / 60); const m = maxBookingMinutes % 60;
                const label = m === 0 ? `${h} hora${h > 1 ? 's' : ''}` : `${h}:${String(m).padStart(2,'0')} horas`;
                return <p className="text-xs text-red-500 -mt-3">Máximo {label} por reserva</p>;
              }
              const hrs = Math.floor(diffMs / 3600000);
              const mins = Math.floor((diffMs % 3600000) / 60000);
              return (
                <p className="text-xs text-gray-400 -mt-3">
                  Duración: {hrs > 0 ? `${hrs}h ` : ''}{mins > 0 ? `${mins}min` : ''}
                </p>
              );
            })()}

            {/* Máquina — oculto para Espacio de Reuniones (se auto-selecciona) */}
            {selectedCategory?.slug !== 'ESPACIO_REUNION' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Máquina *
                  {checkingAvailability && (
                    <span className="ml-2 text-xs text-gray-400 font-normal">Verificando disponibilidad...</span>
                  )}
                </label>
                <select
                  value={resourceId}
                  onChange={(e) => setResourceId(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Seleccionar máquina...</option>
                  {categoryResources.map((r) => (
                    <option key={r.id} value={r.id} disabled={isResourceDisabled(r)}>
                      {getResourceLabel(r)}
                    </option>
                  ))}
                </select>
                {categoryResources.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">No hay máquinas disponibles en esta categoría</p>
                )}
              </div>
            )}

            {/* Cantidad de mesones (solo para MESON_CORTE) */}
            {selectedCategory?.slug === 'MESON_CORTE' && resourceId && (() => {
              const r = categoryResources.find((r) => r.id === resourceId);
              const av = availability?.[resourceId];
              const maxQty = av?.availableCapacity ?? r?.capacity ?? 4;
              return (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cantidad de mesones a utilizar *
                  </label>
                  <select
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n} mesón{n > 1 ? 'es' : ''}</option>
                    ))}
                  </select>
                  {maxQty < 4 && (
                    <p className="text-xs text-amber-600 mt-1">
                      Solo {maxQty} mesón{maxQty > 1 ? 'es' : ''} disponible{maxQty > 1 ? 's' : ''} en este horario
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Tipo de uso para ESPACIO_REUNION / Propósito para el resto */}
            {selectedCategory?.slug === 'ESPACIO_REUNION' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de uso *</label>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <button
                    type="button"
                    onClick={() => setIsPrivate(false)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      !isPrivate
                        ? 'border-sky-500 bg-sky-50'
                        : 'border-gray-200 bg-white hover:border-sky-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-800">Compartido</p>
                    <p className="text-xs text-gray-500 mt-0.5">Uso de mesones — acepto que otros estén en el espacio</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrivate(true)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      isPrivate
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 bg-white hover:border-amber-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-800">Privado</p>
                    <p className="text-xs text-gray-500 mt-0.5">Espacio completo exclusivo</p>
                  </button>
                </div>
                {isPrivate && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-1">
                    <p className="text-xs text-amber-800 font-medium">
                      ⚠️ El modo privado siempre requiere aprobación del administrador.
                    </p>
                  </div>
                )}
                {!isPrivate && selectedCategory && !isCertifiedFor(selectedCategory) && !isAdmin && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-1">
                    <p className="text-xs text-amber-800 font-medium">
                      ⚠️ Sin certificación en Espacio de Reuniones, tu reserva quedará pendiente de aprobación.
                    </p>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  ℹ️ Reservar el Espacio de Reuniones bloquea los Mesones de Corte en ese horario.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">¿Para qué usarás la máquina? *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(['LEARN', 'PRODUCE', 'DESIGN'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPurpose(p)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                        purpose === p
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-brand-400'
                      }`}
                    >
                      {PURPOSE_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* N° de asistentes — solo para Espacio de Reuniones */}
            {selectedCategory?.slug === 'ESPACIO_REUNION' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ¿Cuántas personas asistirán a la reunión? *
                </label>
                <input
                  type="number"
                  value={reunionAttendees}
                  onChange={(e) => setReunionAttendees(e.target.value)}
                  min={1}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-xs text-gray-400 mt-1">Inclúyete a ti misma en el total</p>
              </div>
            )}

            {/* Campos PRODUCE */}
            {purpose === 'PRODUCE' && (
              <div className="bg-orange-50 rounded-lg p-4 space-y-3">
                <p className="text-xs text-orange-700 font-medium">¿Qué vas a producir?</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Producto *</label>
                  <input
                    type="text"
                    value={produceItem}
                    onChange={(e) => setProduceItem(e.target.value)}
                    placeholder="Ej: Camisas, Bolsas, Piezas..."
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad *</label>
                  <input
                    type="number"
                    value={produceQty}
                    onChange={(e) => setProduceQty(e.target.value)}
                    min={1}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
            )}

            {/* Acompañantes — no aplica para Sala de Reuniones */}
            {selectedCategory?.slug !== 'ESPACIO_REUNION' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">¿Vendrás acompañado/a? *</label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setWithCompanions(false)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                      !withCompanions
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-brand-400'
                    }`}
                  >
                    No, solo yo
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithCompanions(true)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                      withCompanions
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-brand-400'
                    }`}
                  >
                    Sí, con acompañantes
                  </button>
                </div>
                {withCompanions && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ¿Cuántos acompañantes? *
                      </label>
                      <input
                        type="number"
                        value={companionCount}
                        onChange={(e) => setCompanionCount(e.target.value)}
                        min={1}
                        max={11}
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        {(() => { const n = 1 + (parseInt(companionCount, 10) || 0); return `Total en el espacio: ${n} persona${n > 1 ? 's' : ''}`; })()}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ¿Cuál es tu relación con ellos? *
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {([
                          { value: 'CUIDADOS', label: 'Cuidados' },
                          { value: 'AMISTAD', label: 'Amistad' },
                          { value: 'OTRO', label: 'Otro' },
                        ] as const).map(({ value, label }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setCompanionRelation(value)}
                            className={`py-2 px-2 rounded-lg text-xs font-medium border transition-all ${
                              companionRelation === value
                                ? 'bg-brand-600 text-white border-brand-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-brand-400'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {selectedCategory?.slug === 'ESPACIO_REUNION'
                  ? 'Personas externas a tu agrupación (opcional)'
                  : 'Notas (opcional)'}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder={
                  selectedCategory?.slug === 'ESPACIO_REUNION'
                    ? 'Indica nombre y organización de quienes asisten y no pertenecen a tu agrupación...'
                    : 'Información adicional...'
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(preselectedResource ? (isAdmin ? 0 : 1) : 1)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ← Volver
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
              >
                {loading ? 'Reservando...' : 'Confirmar Reserva'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
