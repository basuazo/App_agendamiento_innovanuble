import { useState, useEffect, useCallback } from 'react';
import { Resource, ResourceAvailability, Certification, User, BusinessHours, Booking } from '../../types';
import { useBookingStore } from '../../store/bookingStore';
import { useResourceStore } from '../../store/resourceStore';
import { useAuthStore } from '../../store/authStore';
import { bookingService } from '../../services/booking.service';
import { certificationService } from '../../services/certification.service';
import { userService } from '../../services/user.service';
import { formatTimeInput } from '../../utils/dateHelpers';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Purpose = 'LEARN' | 'PRODUCE' | 'DESIGN' | 'REUNION';
type CompanionRel = 'CUIDADOS' | 'AMISTAD' | 'OTRO';
type WizardStep = 'WHO' | 'SCHEDULE' | 'MACHINES' | 'DETAILS' | 'SUMMARY';

const PURPOSE_LABELS: Record<Purpose, string> = {
  LEARN: 'Aprender',
  PRODUCE: 'Producir',
  DESIGN: 'Diseñar',
  REUNION: 'Espacio de Reuniones',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  preselectedDate?: Date;
  businessHours?: BusinessHours[];
  maxBookingMinutes?: number;
  lunchBreak?: { enabled: boolean; start: string; end: string } | null;
  /** Si se provee, el wizard arranca en modo edición pre-rellenado con estos datos */
  editBookings?: Booking[];
}

// ─── Estado inicial ────────────────────────────────────────────────────────────

const makeInitial = (preselectedDate?: Date) => {
  const date = preselectedDate ? format(preselectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  let startTime = '09:00';
  let endTime = '10:00';
  if (preselectedDate) {
    const h = preselectedDate.getHours();
    const m = preselectedDate.getMinutes();
    const clH = h >= 8 && h <= 16 ? h : 9;
    startTime = `${String(clH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const eH = Math.min(clH + 1, 18);
    endTime = `${String(eH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return {
    bookingForSelf: true,
    targetUserId: '',
    date,
    startTime,
    endTime,
    purpose: 'LEARN' as Purpose,
    selectedResourceIds: [] as string[],
    resourceQuantities: {} as Record<string, number>,
    produceItem: '',
    produceQty: '1',
    withCompanions: false,
    companionCount: '1',
    companionRelation: 'AMISTAD' as CompanionRel,
    attendees: '2',
    isPrivate: false,
    notes: '',
  };
};

const isValidTime = (t: string) => /^\d{2}:\d{2}$/.test(t);

// Pre-rellena el estado del wizard desde reservas existentes (modo edición)
const makeInitialFromBookings = (editBookings: Booking[]) => {
  const first = editBookings[0];
  const start = new Date(first.startTime);
  const end = new Date(first.endTime);
  return {
    bookingForSelf: true,
    targetUserId: first.userId,
    date: format(start, 'yyyy-MM-dd'),
    startTime: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
    endTime: `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
    purpose: first.purpose as Purpose,
    selectedResourceIds: editBookings.map((b) => b.resourceId),
    resourceQuantities: Object.fromEntries(editBookings.map((b) => [b.resourceId, b.quantity ?? 1])),
    produceItem: first.produceItem ?? '',
    produceQty: String(first.produceQty ?? 1),
    withCompanions: !!first.companionRelation,
    companionCount: '1',
    companionRelation: (first.companionRelation as CompanionRel) ?? 'AMISTAD',
    attendees: String(first.attendees ?? 2),
    isPrivate: first.isPrivate ?? false,
    notes: first.notes ?? '',
  };
};

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 -m-1 transition-colors"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i < current ? 'bg-brand-600' : i === current - 1 ? 'bg-brand-600 w-4' : 'bg-gray-200'
          }`}
          style={{ width: i === current - 1 ? 16 : 8 }}
        />
      ))}
      <span className="text-xs text-gray-400 ml-1">{current}/{total}</span>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-4"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Volver
    </button>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function BookingWizard({
  isOpen,
  onClose,
  preselectedDate,
  businessHours = [],
  maxBookingMinutes = 240,
  lunchBreak,
  editBookings,
}: Props) {
  const isEditMode = !!editBookings?.length;
  const { create } = useBookingStore();
  const { resources, fetchAll } = useResourceStore();
  const { user } = useAuthStore();

  const isElevated = ['ADMIN', 'SUPER_ADMIN', 'LIDER_COMUNITARIA'].includes(user?.role ?? '');
  const canBookReunion = ['ADMIN', 'SUPER_ADMIN', 'LIDER_COMUNITARIA'].includes(user?.role ?? '');

  const [state, setState] = useState(() => makeInitial(preselectedDate));
  const [step, setStep] = useState<WizardStep>(isElevated ? 'WHO' : 'SCHEDULE');
  const [availability, setAvailability] = useState<ResourceAvailability | null>(null);
  const [checkingAv, setCheckingAv] = useState(false);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showProduceModal, setShowProduceModal] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Reiniciar al abrir
  useEffect(() => {
    if (isOpen) {
      const initial = isEditMode && editBookings
        ? makeInitialFromBookings(editBookings)
        : makeInitial(preselectedDate);
      setState(initial);
      // En edición: ir directo a SCHEDULE (no hay paso WHO)
      setStep(isEditMode ? 'SCHEDULE' : isElevated ? 'WHO' : 'SCHEDULE');
      setAvailability(null);
      setConfirmCancel(false);
      setShowProduceModal(false);
      setExpandedCategories(new Set());
      setUserSearch('');
      setUserDropdownOpen(false);
      fetchAll();
      certificationService.getMyCertifications().then(setCertifications).catch(() => {});
      if (isElevated) {
        userService.getAll().then((list) => setAdminUsers(list.filter((u) => u.id !== user?.id))).catch(() => {});
      }
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Consultar disponibilidad al avanzar a máquinas
  const fetchAvailability = useCallback(async () => {
    if (!isValidTime(state.startTime) || !isValidTime(state.endTime)) return;
    const startIso = new Date(`${state.date}T${state.startTime}:00`).toISOString();
    const endIso = new Date(`${state.date}T${state.endTime}:00`).toISOString();
    if (new Date(endIso) <= new Date(startIso)) return;
    setCheckingAv(true);
    try {
      const data = await bookingService.getAvailability(startIso, endIso);
      setAvailability(data);
    } catch {
      setAvailability(null);
    } finally {
      setCheckingAv(false);
    }
  }, [state.date, state.startTime, state.endTime]);

  useEffect(() => {
    if (step === 'MACHINES') fetchAvailability();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  // ── Derivados ──────────────────────────────────────────────────────────────

  const dayHours = state.date
    ? businessHours.find((h) => h.dayOfWeek === new Date(`${state.date}T12:00:00`).getDay()) ?? null
    : null;

  // Recursos excluiendo Espacio de Reuniones (que es ahora un propósito)
  const bookableResources = resources.filter(
    (r) => r.isActive && r.category?.slug !== 'ESPACIO_REUNION'
  );

  // Recurso sala de reuniones (para propósito REUNION)
  const salaResource = resources.find((r) => r.isActive && r.category?.slug === 'ESPACIO_REUNION');

  const isCertifiedFor = (r: Resource) => {
    if (!r.requiresCertification) return true;
    if (isElevated) return true;
    return certifications.some((c) => c.categoryId === r.categoryId);
  };

  const needsCertApproval = state.selectedResourceIds.some((id) => {
    const r = resources.find((r) => r.id === id);
    return r && !isCertifiedFor(r);
  });

  const salaReunionNeedsCert = state.purpose === 'REUNION' && salaResource && !isCertifiedFor(salaResource);

  // Número de pasos visibles (para el indicador)
  const totalSteps = isElevated
    ? state.purpose === 'REUNION' ? 4 : 5
    : state.purpose === 'REUNION' ? 3 : 4;

  // ── Navegación ─────────────────────────────────────────────────────────────

  const goBack = () => {
    if (step === 'SUMMARY') { setStep('DETAILS'); return; }
    if (step === 'DETAILS') {
      setStep(state.purpose === 'REUNION' ? 'SCHEDULE' : 'MACHINES');
      return;
    }
    if (step === 'MACHINES') { setStep('SCHEDULE'); return; }
    if (step === 'SCHEDULE') { if (isElevated) setStep('WHO'); return; }
  };

  const requestClose = () => setConfirmCancel(true);

  // ── Validaciones de paso ───────────────────────────────────────────────────

  const validateSchedule = (): string | null => {
    if (!state.date) return 'Selecciona una fecha';
    if (!isValidTime(state.startTime)) return 'Hora de inicio inválida (usa HH:MM)';
    if (!isValidTime(state.endTime)) return 'Hora de término inválida (usa HH:MM)';
    const start = new Date(`${state.date}T${state.startTime}:00`);
    const end = new Date(`${state.date}T${state.endTime}:00`);
    if (end <= start) return 'La hora de término debe ser posterior a la hora de inicio';
    if (start < new Date()) return 'No se pueden crear reservas en el pasado';
    const durationMs = end.getTime() - start.getTime();
    if (durationMs > maxBookingMinutes * 60 * 1000) {
      const h = Math.floor(maxBookingMinutes / 60);
      const m = maxBookingMinutes % 60;
      const label = m === 0 ? `${h} hora${h > 1 ? 's' : ''}` : `${h}:${String(m).padStart(2, '0')} horas`;
      return `La reserva no puede durar más de ${label}`;
    }
    if (dayHours && businessHours.length > 0) {
      if (!dayHours.isOpen) return 'El espacio no abre ese día';
      if (state.startTime < dayHours.openTime) return `El espacio abre a las ${dayHours.openTime}`;
      if (state.endTime > dayHours.closeTime) return `El espacio cierra a las ${dayHours.closeTime}`;
    }
    if (lunchBreak?.enabled && lunchBreak.start && lunchBreak.end) {
      if (state.startTime < lunchBreak.end && state.endTime > lunchBreak.start) {
        return `No se puede agendar en horario de colación. Debes agendar antes de las ${lunchBreak.start} y después de las ${lunchBreak.end}`;
      }
    }
    return null;
  };

  const handleScheduleNext = () => {
    const err = validateSchedule();
    if (err) { toast.error(err); return; }
    if (state.purpose === 'REUNION') {
      if (!salaResource) { toast.error('No hay espacio de reuniones disponible en este espacio'); return; }
      setStep('DETAILS');
    } else if (state.purpose === 'PRODUCE') {
      setShowProduceModal(true);
    } else {
      setStep('MACHINES');
    }
  };

  const handleProduceModalConfirm = () => {
    if (!state.produceItem.trim()) { toast.error('Indica qué vas a producir'); return; }
    if (!state.produceQty || parseInt(state.produceQty) < 1) { toast.error('Indica una cantidad válida'); return; }
    setShowProduceModal(false);
    setStep('MACHINES');
  };

  const handleMachinesNext = () => {
    if (state.selectedResourceIds.length === 0) {
      toast.error('Selecciona al menos una máquina');
      return;
    }
    setStep('DETAILS');
  };

  const handleDetailsNext = () => {
    setStep('SUMMARY');
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    const scheduleErr = validateSchedule();
    if (scheduleErr) { toast.error(scheduleErr); setStep('SCHEDULE'); return; }

    setLoading(true);
    try {
      // En modo edición: cancelar reservas anteriores antes de crear las nuevas
      if (isEditMode && editBookings) {
        for (const b of editBookings) {
          await bookingService.cancel(b.id);
        }
      }

      const startIso = new Date(`${state.date}T${state.startTime}:00`).toISOString();
      const endIso = new Date(`${state.date}T${state.endTime}:00`).toISOString();
      // En edición: preservar el usuario original de la reserva
      const effectiveTargetId = isEditMode && editBookings
        ? editBookings[0].userId
        : isElevated && !state.bookingForSelf && state.targetUserId
          ? state.targetUserId : undefined;

      let resourceIds: string[];
      if (state.purpose === 'REUNION') {
        if (!salaResource) { toast.error('Espacio de reuniones no disponible'); return; }
        resourceIds = [salaResource.id];
      } else {
        resourceIds = state.selectedResourceIds;
      }

      const parsedProduceQty = Math.max(1, parseInt(state.produceQty, 10) || 1);
      const parsedAttendees = Math.max(2, parseInt(state.attendees, 10) || 2);
      const parsedCompanionCount = Math.max(1, parseInt(state.companionCount, 10) || 1);

      // Crear una reserva por cada recurso seleccionado
      for (const resourceId of resourceIds) {
        const resource = resources.find((r) => r.id === resourceId);
        const isMeson = resource?.category?.slug === 'MESON_CORTE';
        await create({
          resourceId,
          startTime: startIso,
          endTime: endIso,
          purpose: state.purpose,
          produceItem: state.purpose === 'PRODUCE' ? state.produceItem : undefined,
          produceQty: state.purpose === 'PRODUCE' ? parsedProduceQty : undefined,
          quantity: isMeson ? (state.resourceQuantities[resourceId] ?? 1) : 1,
          isPrivate: state.purpose === 'REUNION' ? state.isPrivate : undefined,
          attendees: state.purpose === 'REUNION'
            ? parsedAttendees
            : state.withCompanions ? 1 + parsedCompanionCount : 1,
          companionRelation: state.purpose !== 'REUNION' && state.withCompanions
            ? state.companionRelation : undefined,
          notes: state.notes || undefined,
          targetUserId: effectiveTargetId,
          localDate: state.date,
          localStartTime: state.startTime,
          localEndTime: state.endTime,
        });
      }

      const count = resourceIds.length;
      if (isEditMode) {
        toast.success('Reserva actualizada');
      } else {
        const willBePending = !isElevated && (needsCertApproval || (state.purpose === 'REUNION' && state.isPrivate));
        toast.success(
          willBePending
            ? `Reserva${count > 1 ? 's enviadas' : ' enviada'} — queda pendiente de aprobación`
            : count > 1
            ? `${count} reservas confirmadas`
            : '¡Reserva confirmada!'
        );
      }
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Error al crear la reserva');
    } finally {
      setLoading(false);
    }
  };

  // ── Setters parciales ──────────────────────────────────────────────────────

  const set = <K extends keyof typeof state>(key: K, val: typeof state[K]) =>
    setState((prev) => ({ ...prev, [key]: val }));

  const toggleResource = (id: string) => {
    setState((prev) => {
      const ids = prev.selectedResourceIds.includes(id)
        ? prev.selectedResourceIds.filter((x) => x !== id)
        : [...prev.selectedResourceIds, id];
      return { ...prev, selectedResourceIds: ids };
    });
  };

  const setQuantityFor = (id: string, qty: number) => {
    setState((prev) => ({
      ...prev,
      resourceQuantities: { ...prev.resourceQuantities, [id]: qty },
    }));
  };

  const targetUserName = adminUsers.find((u) => u.id === state.targetUserId)?.name ?? '';

  const today = format(new Date(), 'yyyy-MM-dd');

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  const wrapModal = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        {children}
      </div>
      {/* Modal: ¿Qué vas a producir? */}
      {showProduceModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center shrink-0">
                <span className="text-xl">🧵</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">¿Qué vas a producir?</h3>
                <p className="text-xs text-gray-500 mt-0.5">Registra lo que planeas hacer en tu sesión</p>
              </div>
            </div>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Artículo a producir *
                </label>
                <input
                  type="text"
                  value={state.produceItem}
                  onChange={(e) => set('produceItem', e.target.value)}
                  placeholder="Ej: Camisas, vestidos, bolsos…"
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  Cantidad *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={state.produceQty}
                  onChange={(e) => set('produceQty', e.target.value.replace(/\D/g, ''))}
                  placeholder="1"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowProduceModal(false)}
                className="flex-1 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Volver
              </button>
              <button
                onClick={handleProduceModalConfirm}
                className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Continuar →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de confirmación de cancelar */}
      {confirmCancel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">¿Cancelar la reserva?</h3>
                <p className="text-xs text-gray-500 mt-0.5">Se perderán todos los datos ingresados.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setConfirmCancel(false)}
                className="flex-1 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Seguir editando
              </button>
              <button
                onClick={() => { setConfirmCancel(false); onClose(); }}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Sí, cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── WHO ────────────────────────────────────────────────────────────────────
  if (step === 'WHO') {
    return wrapModal(
      <div className="p-6 overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs text-gray-400 mb-1">
              <StepIndicator current={1} total={totalSteps} />
            </p>
            <h2 className="text-lg font-bold text-gray-900">Nueva Reserva</h2>
            <p className="text-sm text-gray-500">¿Para quién es la reserva?</p>
          </div>
          <CloseButton onClick={requestClose} />
        </div>

        <div className="space-y-3 mb-6">
          <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
            state.bookingForSelf ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
          }`}>
            <input
              type="radio"
              checked={state.bookingForSelf}
              onChange={() => { setState((p) => ({ ...p, bookingForSelf: true, targetUserId: '' })); setUserSearch(''); setUserDropdownOpen(false); }}
              className="accent-brand-600"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">Para mí</p>
              <p className="text-xs text-gray-500">Agendo en mi nombre</p>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
            !state.bookingForSelf ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
          }`}>
            <input
              type="radio"
              checked={!state.bookingForSelf}
              onChange={() => set('bookingForSelf', false)}
              className="accent-brand-600 mt-0.5"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Para otra usuaria</p>
              <p className="text-xs text-gray-500 mb-2">Busca por nombre o email</p>
              {!state.bookingForSelf && (() => {
                const selectedUser = adminUsers.find((u) => u.id === state.targetUserId);
                const filtered = adminUsers.filter((u) =>
                  u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                  u.email.toLowerCase().includes(userSearch.toLowerCase())
                );
                return (
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={userDropdownOpen ? userSearch : (selectedUser ? `${selectedUser.name} — ${selectedUser.email}` : userSearch)}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        set('targetUserId', '');
                        setUserDropdownOpen(true);
                      }}
                      onFocus={() => {
                        setUserSearch('');
                        setUserDropdownOpen(true);
                      }}
                      onBlur={() => setUserDropdownOpen(false)}
                      placeholder="Buscar usuaria..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    {userDropdownOpen && (
                      <div
                        className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {filtered.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-gray-400">Sin resultados</p>
                        ) : (
                          filtered.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50 transition-colors"
                              onMouseDown={() => {
                                set('targetUserId', u.id);
                                setUserSearch('');
                                setUserDropdownOpen(false);
                              }}
                            >
                              <span className="font-medium text-gray-800">{u.name}</span>
                              <span className="text-gray-400 ml-1">— {u.email}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </label>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={requestClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              if (!state.bookingForSelf && !state.targetUserId) {
                toast.error('Selecciona una usuaria');
                return;
              }
              setStep('SCHEDULE');
            }}
            className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Continuar →
          </button>
        </div>
      </div>
    );
  }

  // ── SCHEDULE ───────────────────────────────────────────────────────────────
  if (step === 'SCHEDULE') {
    const durationMinutes = (() => {
      if (!isValidTime(state.startTime) || !isValidTime(state.endTime)) return 0;
      const [sh, sm] = state.startTime.split(':').map(Number);
      const [eh, em] = state.endTime.split(':').map(Number);
      return (eh * 60 + em) - (sh * 60 + sm);
    })();
    const durationLabel = durationMinutes > 0
      ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60 > 0 ? `${durationMinutes % 60}min` : ''}`.trim()
      : '';
    const overMax = durationMinutes > maxBookingMinutes;
    const bhWarn = (() => {
      if (!dayHours || businessHours.length === 0) return null;
      if (!dayHours.isOpen) return 'El espacio no abre ese día';
      if (isValidTime(state.startTime) && state.startTime < dayHours.openTime)
        return `El espacio abre a las ${dayHours.openTime}`;
      if (isValidTime(state.endTime) && state.endTime > dayHours.closeTime)
        return `El espacio cierra a las ${dayHours.closeTime}`;
      return null;
    })();

    return wrapModal(
      <div className="p-6 overflow-y-auto">
        <div className="flex items-start justify-between mb-2">
          <StepIndicator current={isElevated ? 2 : 1} total={totalSteps} />
          <CloseButton onClick={requestClose} />
        </div>

        {isElevated && <BackButton onClick={goBack} />}

        <h2 className="text-lg font-bold text-gray-900 mb-0.5">Fecha y horario</h2>
        {isElevated && !state.bookingForSelf && state.targetUserId && (
          <p className="text-xs text-brand-700 font-medium mb-3">
            Para: {targetUserName}
          </p>
        )}
        <p className="text-sm text-gray-500 mb-5">¿Cuándo quieres usar el espacio?</p>

        {/* Fecha */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Fecha</label>
          <input
            type="date"
            min={today}
            value={state.date}
            onChange={(e) => set('date', e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Hora inicio / fin */}
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Hora inicio</label>
            <input
              type="text"
              placeholder="09:00"
              maxLength={5}
              value={state.startTime}
              onChange={(e) => set('startTime', formatTimeInput(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Hora fin</label>
            <input
              type="text"
              placeholder="10:00"
              maxLength={5}
              value={state.endTime}
              onChange={(e) => set('endTime', formatTimeInput(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
            />
          </div>
        </div>

        {/* Hints de duración y horario */}
        {durationMinutes > 0 && (
          <p className={`text-xs mb-1 ${overMax ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
            {overMax
              ? `Excede el máximo de ${Math.floor(maxBookingMinutes / 60)}h (actual: ${durationLabel})`
              : `Duración: ${durationLabel}`}
          </p>
        )}
        {dayHours && !bhWarn && dayHours.isOpen && (
          <p className="text-xs text-gray-400 mb-1">
            Horario del espacio: {dayHours.openTime} – {dayHours.closeTime}
          </p>
        )}
        {bhWarn && (
          <p className="text-xs text-red-600 font-medium mb-1">{bhWarn}</p>
        )}

        {/* Propósito */}
        <div className="mt-5 mb-6">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">¿Para qué usarás el espacio?</label>
          <div className="grid grid-cols-2 gap-2">
            {(['LEARN', 'PRODUCE', 'DESIGN'] as Purpose[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set('purpose', p)}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                  state.purpose === p
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="block text-base mb-0.5">
                  {p === 'LEARN' ? '📚' : p === 'PRODUCE' ? '🧵' : '✏️'}
                </span>
                {PURPOSE_LABELS[p]}
              </button>
            ))}
            {canBookReunion && (
              <button
                type="button"
                onClick={() => {
                  if (!salaResource) {
                    toast.error('No hay espacio de reuniones configurado en este espacio');
                    return;
                  }
                  set('purpose', 'REUNION');
                }}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                  state.purpose === 'REUNION'
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="block text-base mb-0.5">🏛️</span>
                Reunión
              </button>
            )}
          </div>
          {state.purpose === 'REUNION' && !salaResource && (
            <p className="text-xs text-amber-600 mt-2">
              No hay sala de reuniones activa en este espacio
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleScheduleNext}
          className="w-full py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          {state.purpose === 'REUNION' ? 'Continuar → Detalles' : state.purpose === 'PRODUCE' ? 'Continuar → ¿Qué producirás?' : 'Continuar → Máquinas'}
        </button>
      </div>
    );
  }

  // ── MACHINES ───────────────────────────────────────────────────────────────
  if (step === 'MACHINES') {
    // Agrupar por categoría
    const categoryMap = new Map<string, { name: string; color: string; resources: Resource[] }>();
    for (const r of bookableResources) {
      if (!r.category) continue;
      if (!categoryMap.has(r.categoryId)) {
        categoryMap.set(r.categoryId, { name: r.category.name, color: r.category.color ?? '#6b7280', resources: [] });
      }
      categoryMap.get(r.categoryId)!.resources.push(r);
    }
    const categories = Array.from(categoryMap.entries());

    const getAvStatus = (r: Resource) => {
      if (!availability) return null;
      return availability[r.id] ?? null;
    };

    const isDisabled = (r: Resource) => {
      const av = getAvStatus(r);
      return !!av && av.status !== 'available';
    };

    return wrapModal(
      <div className="p-6 overflow-y-auto">
        <div className="flex items-start justify-between mb-2">
          <StepIndicator current={isElevated ? 3 : 2} total={totalSteps} />
          <CloseButton onClick={requestClose} />
        </div>

        <BackButton onClick={goBack} />

        <h2 className="text-lg font-bold text-gray-900 mb-0.5">Selecciona máquinas</h2>
        <p className="text-sm text-gray-500 mb-1">
          {state.date} · {state.startTime} – {state.endTime}
        </p>
        <p className="text-xs text-gray-400 mb-4">Puedes seleccionar más de una</p>

        {checkingAv && (
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Verificando disponibilidad…
          </div>
        )}

        <div className="space-y-2 mb-6">
          {categories.length === 0 && (
            <p className="text-sm text-gray-400 italic text-center py-6">No hay máquinas disponibles</p>
          )}
          {categories.map(([catId, cat]) => {
            const isExpanded = expandedCategories.has(catId);
            const selectedInCat = cat.resources.filter(r => state.selectedResourceIds.includes(r.id)).length;
            return (
            <div key={catId} className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedCategories(prev => {
                  const next = new Set(prev);
                  if (next.has(catId)) next.delete(catId); else next.add(catId);
                  return next;
                })}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex-1">{cat.name}</span>
                {selectedInCat > 0 && (
                  <span className="text-xs font-medium text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full">
                    {selectedInCat}
                  </span>
                )}
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isExpanded && (
              <div className="p-2 space-y-1.5">
                {cat.resources.map((r) => {
                  const av = getAvStatus(r);
                  const disabled = isDisabled(r);
                  const selected = state.selectedResourceIds.includes(r.id);
                  const isMeson = r.category?.slug === 'MESON_CORTE';
                  const notCert = !isCertifiedFor(r);

                  return (
                    <div key={r.id}>
                      <label className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        disabled
                          ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                          : selected
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={disabled}
                          onChange={() => !disabled && toggleResource(r.id)}
                          className="accent-brand-600 w-4 h-4 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-900">{r.name}</span>
                            {disabled && av && (
                              <span className="text-xs text-red-500">{av.reason ?? 'No disponible'}</span>
                            )}
                            {!disabled && av?.status === 'available' && av.availableCapacity !== undefined && (
                              <span className="text-xs text-green-600">
                                {av.availableCapacity} de {r.capacity} disponibles
                              </span>
                            )}
                            {notCert && !disabled && (
                              <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                Sin certificación
                              </span>
                            )}
                          </div>
                          {r.description && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">{r.description}</p>
                          )}
                        </div>
                      </label>
                      {/* Selector de cantidad para mesones */}
                      {isMeson && selected && r.capacity > 1 && (
                        <div className="ml-10 mt-1.5 flex items-center gap-2">
                          <span className="text-xs text-gray-500">Cantidad:</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setQuantityFor(r.id, Math.max(1, (state.resourceQuantities[r.id] ?? 1) - 1))}
                              className="w-6 h-6 rounded-full border border-gray-300 text-gray-600 flex items-center justify-center text-sm hover:bg-gray-100"
                            >−</button>
                            <span className="text-sm font-medium w-5 text-center">
                              {state.resourceQuantities[r.id] ?? 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const maxQty = av?.availableCapacity ?? r.capacity;
                                setQuantityFor(r.id, Math.min(maxQty, (state.resourceQuantities[r.id] ?? 1) + 1));
                              }}
                              className="w-6 h-6 rounded-full border border-gray-300 text-gray-600 flex items-center justify-center text-sm hover:bg-gray-100"
                            >+</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </div>
            );
          })}
        </div>

        {state.selectedResourceIds.length > 0 && (
          <p className="text-xs text-brand-700 font-medium mb-3">
            {state.selectedResourceIds.length} máquina{state.selectedResourceIds.length !== 1 ? 's' : ''} seleccionada{state.selectedResourceIds.length !== 1 ? 's' : ''}
          </p>
        )}
        {needsCertApproval && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
            <p className="text-xs text-amber-700">
              ⚠️ Una o más máquinas requieren certificación. La reserva quedará pendiente de aprobación.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handleMachinesNext}
          disabled={state.selectedResourceIds.length === 0}
          className="w-full py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          Continuar → Detalles
        </button>
      </div>
    );
  }

  // ── DETAILS ────────────────────────────────────────────────────────────────
  if (step === 'DETAILS') {
    const stepNum = isElevated
      ? state.purpose === 'REUNION' ? 3 : 4
      : state.purpose === 'REUNION' ? 2 : 3;

    return wrapModal(
      <div className="p-6 overflow-y-auto">
        <div className="flex items-start justify-between mb-2">
          <StepIndicator current={stepNum} total={totalSteps} />
          <CloseButton onClick={requestClose} />
        </div>

        <BackButton onClick={goBack} />

        <h2 className="text-lg font-bold text-gray-900 mb-0.5">Detalles</h2>
        <p className="text-sm text-gray-500 mb-5">
          {PURPOSE_LABELS[state.purpose]}
          {state.purpose !== 'REUNION' && state.selectedResourceIds.length > 0 && (
            <span className="ml-1 text-gray-400">
              · {state.selectedResourceIds.map(id => resources.find(r => r.id === id)?.name).filter(Boolean).join(', ')}
            </span>
          )}
        </p>

        <div className="space-y-5">
          {/* Producir: resumen de lo ingresado en la modal previa */}
          {state.purpose === 'PRODUCE' && (
            <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 flex items-start gap-3">
              <span className="text-lg shrink-0">🧵</span>
              <div>
                <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-0.5">A producir</p>
                <p className="text-sm text-gray-800 font-medium">{state.produceItem}</p>
                <p className="text-xs text-gray-500">Cantidad: {state.produceQty}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowProduceModal(true)}
                className="ml-auto text-xs text-brand-600 hover:text-brand-800 font-medium shrink-0"
              >
                Editar
              </button>
            </div>
          )}

          {/* Reunión: asistentes e isPrivate */}
          {state.purpose === 'REUNION' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                  N° de asistentes
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={state.attendees}
                  onChange={(e) => set('attendees', e.target.value.replace(/\D/g, ''))}
                  placeholder="2"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={state.isPrivate}
                  onChange={(e) => set('isPrivate', e.target.checked)}
                  className="accent-brand-600 mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Reunión privada</p>
                  <p className="text-xs text-gray-500">Requiere aprobación del administrador</p>
                </div>
              </label>
            </div>
          )}

          {/* Acompañantes (no aplica para REUNION) */}
          {state.purpose !== 'REUNION' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Acompañantes
              </label>
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-3">
                <p className="text-xs text-blue-700">
                  💡 Recomendamos asistir sola al espacio, salvo que sea absolutamente necesario.
                </p>
              </div>
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all mb-2 ${
                state.withCompanions ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="checkbox"
                  checked={state.withCompanions}
                  onChange={(e) => set('withCompanions', e.target.checked)}
                  className="accent-brand-600"
                />
                <span className="text-sm font-medium text-gray-900">Voy con acompañante(s)</span>
              </label>

              {state.withCompanions && (
                <div className="ml-2 space-y-3 border-l-2 border-brand-100 pl-4 mt-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">¿Cuántas personas?</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={state.companionCount}
                      onChange={(e) => set('companionCount', e.target.value.replace(/\D/g, ''))}
                      placeholder="1"
                      className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Relación</label>
                    <div className="flex gap-2 flex-wrap">
                      {(['CUIDADOS', 'AMISTAD', 'OTRO'] as CompanionRel[]).map((rel) => (
                        <button
                          key={rel}
                          type="button"
                          onClick={() => set('companionRelation', rel)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            state.companionRelation === rel
                              ? 'border-brand-500 bg-brand-50 text-brand-700'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {rel === 'CUIDADOS' ? 'Cuidados' : rel === 'AMISTAD' ? 'Amistad' : 'Otro'}
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
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Notas {state.purpose === 'REUNION' ? '(identifica personas externas a la agrupación)' : '(opcional)'}
            </label>
            <textarea
              value={state.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder={
                state.purpose === 'REUNION'
                  ? 'Nombre y organización de las personas externas…'
                  : 'Cualquier detalle relevante…'
              }
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleDetailsNext}
            className="w-full py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            Ver resumen →
          </button>
        </div>
      </div>
    );
  }

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  if (step === 'SUMMARY') {
    const selectedResources = state.purpose === 'REUNION' && salaResource
      ? [salaResource]
      : state.selectedResourceIds.map((id) => resources.find((r) => r.id === id)).filter(Boolean) as Resource[];

    const formattedDate = state.date
      ? new Date(`${state.date}T12:00:00`).toLocaleDateString('es-CL', {
          weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
        })
      : '';

    const hasCertWarning = needsCertApproval || salaReunionNeedsCert;
    const hasPendingWarning = hasCertWarning || (state.purpose === 'REUNION' && state.isPrivate);

    return wrapModal(
      <div className="p-6 overflow-y-auto">
        <div className="flex items-start justify-between mb-2">
          <StepIndicator current={totalSteps} total={totalSteps} />
          <CloseButton onClick={requestClose} />
        </div>

        <BackButton onClick={goBack} />

        <h2 className="text-lg font-bold text-gray-900 mb-1">
          {isEditMode ? 'Revisa los cambios' : 'Resumen de tu reserva'}
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          {isEditMode ? 'Confirma los cambios antes de guardar' : 'Revisa los datos antes de confirmar'}
        </p>

        <div className="bg-gray-50 rounded-2xl p-4 space-y-3 mb-5 text-sm">
          {/* Para quién */}
          {isElevated && !state.bookingForSelf && state.targetUserId && (
            <div className="flex gap-2">
              <span className="text-gray-400 w-28 shrink-0">Para</span>
              <span className="font-medium text-gray-900">{targetUserName}</span>
            </div>
          )}

          {/* Fecha y hora */}
          <div className="flex gap-2">
            <span className="text-gray-400 w-28 shrink-0">Fecha</span>
            <span className="font-medium text-gray-900 capitalize">{formattedDate}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-400 w-28 shrink-0">Horario</span>
            <span className="font-medium text-gray-900">{state.startTime} – {state.endTime}</span>
          </div>

          {/* Propósito */}
          <div className="flex gap-2">
            <span className="text-gray-400 w-28 shrink-0">Propósito</span>
            <span className="font-medium text-gray-900">{PURPOSE_LABELS[state.purpose]}</span>
          </div>

          {/* Máquinas */}
          <div className="flex gap-2">
            <span className="text-gray-400 w-28 shrink-0">
              {state.purpose === 'REUNION' ? 'Espacio' : selectedResources.length > 1 ? 'Máquinas' : 'Máquina'}
            </span>
            <div>
              {selectedResources.map((r) => (
                <div key={r.id} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.category?.color ?? '#6b7280' }} />
                  <span className="font-medium text-gray-900">{r.name}</span>
                  {r.category?.slug === 'MESON_CORTE' && state.resourceQuantities[r.id] > 1 && (
                    <span className="text-gray-500">× {state.resourceQuantities[r.id]}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Detalles de propósito */}
          {state.purpose === 'PRODUCE' && state.produceItem && (
            <div className="flex gap-2">
              <span className="text-gray-400 w-28 shrink-0">Producir</span>
              <span className="font-medium text-gray-900">
                {state.produceItem} × {state.produceQty} unidades
              </span>
            </div>
          )}

          {state.purpose === 'REUNION' && (
            <>
              <div className="flex gap-2">
                <span className="text-gray-400 w-28 shrink-0">Asistentes</span>
                <span className="font-medium text-gray-900">{state.attendees} personas</span>
              </div>
              {state.isPrivate && (
                <div className="flex gap-2">
                  <span className="text-gray-400 w-28 shrink-0">Tipo</span>
                  <span className="font-medium text-amber-700">Privada (requiere aprobación)</span>
                </div>
              )}
            </>
          )}

          {state.purpose !== 'REUNION' && state.withCompanions && (
            <div className="flex gap-2">
              <span className="text-gray-400 w-28 shrink-0">Acompañantes</span>
              <span className="font-medium text-gray-900">
                {state.companionCount} persona{parseInt(state.companionCount) !== 1 ? 's' : ''} ·{' '}
                {state.companionRelation === 'CUIDADOS' ? 'Cuidados' : state.companionRelation === 'AMISTAD' ? 'Amistad' : 'Otro'}
              </span>
            </div>
          )}

          {state.notes && (
            <div className="flex gap-2">
              <span className="text-gray-400 w-28 shrink-0">Notas</span>
              <span className="text-gray-700 italic">{state.notes}</span>
            </div>
          )}
        </div>

        {/* Advertencia de certificación / pendiente */}
        {hasPendingWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
            <p className="text-xs text-amber-700">
              ⚠️ {state.purpose === 'REUNION' && state.isPrivate
                ? 'La reunión privada quedará pendiente de aprobación del administrador.'
                : 'Una o más máquinas requieren certificación. La reserva quedará pendiente de aprobación.'}
            </p>
          </div>
        )}

        {/* Botones */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={requestClose}
            className="py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => setStep('SCHEDULE')}
            className="py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {loading ? '…' : isEditMode ? 'Guardar cambios' : 'Confirmar'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
