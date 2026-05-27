import { useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import { Booking, Training, BusinessHours, Maintenance } from '../../types';
import { PURPOSE_LABELS } from '../../utils/dateHelpers';

// ─── Tipos ──────────────────────────────────────────────────────────────────

type ClusterItem =
  | { kind: 'booking'; bookings: Booking[] }
  | { kind: 'training'; training: Training };

interface VisibleFCEvent {
  id: string;
  title?: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  editable?: boolean;
  extendedProps: {
    kind: 'booking' | 'training';
    bookings?: Booking[];
    training?: Training;
  };
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

function isWithinBusinessHours(date: Date, businessHours: BusinessHours[]): boolean {
  const dayOfWeek = date.getDay();
  const bh = businessHours.find((d) => d.dayOfWeek === dayOfWeek);
  if (!bh || !bh.isOpen) return false;
  const slotMinutes = date.getHours() * 60 + date.getMinutes();
  const [openH, openM] = bh.openTime.split(':').map(Number);
  const [closeH, closeM] = bh.closeTime.split(':').map(Number);
  return slotMinutes >= openMinutes(openH, openM) && slotMinutes < openMinutes(closeH, closeM);
}
function openMinutes(h: number, m: number) { return h * 60 + m; }


/**
 * Agrupa eventos visibles que se solapan en el tiempo usando union-find.
 * Grupos de 2+ → un único evento "cluster".
 * Grupos de 1 → el evento original sin cambios.
 */
function clusterVisibleEvents(events: VisibleFCEvent[]): (VisibleFCEvent | ReturnType<typeof makeClusterEvent>)[] {
  if (events.length === 0) return [];

  const n = events.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(i: number): number {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  }
  function union(i: number, j: number) { parent[find(i)] = find(j); }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sA = new Date(events[i].start).getTime();
      const eA = new Date(events[i].end).getTime();
      const sB = new Date(events[j].start).getTime();
      const eB = new Date(events[j].end).getTime();
      if (sA < eB && eA > sB) union(i, j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  const result: (VisibleFCEvent | ReturnType<typeof makeClusterEvent>)[] = [];
  for (const [, indices] of groups) {
    if (indices.length === 1) {
      result.push(events[indices[0]]);
    } else {
      const group = indices.map((i) => events[i]);
      result.push(makeClusterEvent(group));
    }
  }
  return result;
}

function makeClusterEvent(group: VisibleFCEvent[]) {
  const minStart = group.reduce((m, e) => (e.start < m ? e.start : m), group[0].start);
  const maxEnd   = group.reduce((m, e) => (e.end   > m ? e.end   : m), group[0].end);
  const items: ClusterItem[] = group.map((e) => {
    if (e.extendedProps.kind === 'training') return { kind: 'training', training: e.extendedProps.training! };
    return { kind: 'booking', bookings: e.extendedProps.bookings! };
  });
  return {
    id: `cluster-${group.map((e) => e.id).join('_')}`,
    start: minStart,
    end: maxEnd,
    backgroundColor: '#475569',
    borderColor: '#334155',
    textColor: '#fff',
    editable: false as const,
    extendedProps: { isCluster: true as const, clusterItems: items },
  };
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  bookings: Booking[];
  trainings?: Training[];
  maintenances?: Maintenance[];
  isAdmin?: boolean;
  currentUserId?: string;
  businessHours?: BusinessHours[];
  lunchBreak?: { enabled: boolean; start: string; end: string } | null;
  onSlotClick: (date: Date) => void;
  onTrainingClick?: (training: Training) => void;
  onMaintenanceClick?: (maintenance: Maintenance) => void;
  onCancelBooking?: (id: string) => Promise<void>;
  onEditBooking?: (bookings: Booking[]) => void;
}

// ─── Componente ──────────────────────────────────────────────────────────────

type DetailModal = { kind: 'booking'; bookings: Booking[] } | null;

type ClusterModal = { date: Date; items: ClusterItem[] } | null;

export default function CalendarView({
  bookings,
  trainings = [],
  maintenances = [],
  isAdmin = false,
  currentUserId,
  businessHours = [],
  lunchBreak,
  onSlotClick,
  onTrainingClick,
  onMaintenanceClick,
  onCancelBooking,
  onEditBooking,
}: Props) {
  const [detail, setDetail] = useState<DetailModal>(null);
  const [clusterModal, setClusterModal] = useState<ClusterModal>(null);
  const [showClosedPopup, setShowClosedPopup] = useState(false);
  const [showLunchPopup, setShowLunchPopup] = useState(false);

  const [confirmCancelBooking, setConfirmCancelBooking] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const closeDetail = () => {
    setDetail(null);
    setConfirmCancelBooking(false);
  };

  const handleCancelBooking = async () => {
    if (!detail || detail.kind !== 'booking') return;
    setCancelLoading(true);
    try {
      for (const booking of detail.bookings) {
        await onCancelBooking!(booking.id);
      }
      closeDetail();
    } catch {
      // error manejado vía toast en CalendarPage
    } finally {
      setCancelLoading(false);
    }
  };

  const handleClusterItemClick = (item: ClusterItem) => {
    setClusterModal(null);
    if (item.kind === 'booking') {
      setDetail({ kind: 'booking', bookings: item.bookings });
    } else if (item.kind === 'training') {
      if (onTrainingClick) onTrainingClick(item.training);
    }
  };

  // ─── Eventos de calendario ──────────────────────────────────────────────

  // Agrupa reservas por sesión (mismo usuario + horario + propósito)
  const bookingGroups = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      const key = `${b.userId}_${b.startTime}_${b.endTime}_${b.purpose}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return Array.from(map.values());
  }, [bookings]);

  // Eventos visibles (no-background) antes de agrupar
  const rawVisibleEvents = useMemo<VisibleFCEvent[]>(() => {
    const all: VisibleFCEvent[] = [];

    bookingGroups.forEach((group) => {
      const first = group[0];
      const color = first.resource.category?.color ?? '#6b7280';
      const isMulti = group.length > 1;
      const key = `${first.userId}_${first.startTime}_${first.endTime}_${first.purpose}`;
      all.push({
        id: `booking-group-${key}`,
        title: first.user.name,
        start: first.startTime,
        end: first.endTime,
        backgroundColor: isMulti ? 'transparent' : color,
        borderColor: isMulti ? '#4f46e5' : color,
        textColor: '#fff',
        extendedProps: { kind: 'booking', bookings: group },
      });
    });

    trainings.forEach((t) => {
      all.push({
        id: `training-label-${t.id}`,
        start: t.startTime,
        end: t.endTime,
        backgroundColor: '#f59e0b',
        borderColor: '#d97706',
        textColor: '#fff',
        editable: false,
        extendedProps: { kind: 'training', training: t },
      });
    });

    return all;
  }, [bookings, trainings]);

  // Eventos agrupados + fondos de capacitación + mantenciones
  const events = useMemo(() => {
    const bgTrainings = trainings.map((t) => ({
      id: `training-bg-${t.id}`,
      start: t.startTime,
      end: t.endTime,
      display: 'background' as const,
      color: '#fef3c7',
      extendedProps: { kind: 'trainingBg' as const, training: t },
    }));

    const bgMaintenances = maintenances.map((m) => ({
      id: `maintenance-bg-${m.id}`,
      start: m.startTime,
      end: m.endTime,
      display: 'background' as const,
      color: '#fecaca', // rojo claro
      extendedProps: { kind: 'maintenanceBg' as const, maintenance: m },
    }));

    // Eventos de mantención visibles (con etiqueta)
    const maintenanceLabels = maintenances.map((m) => ({
      id: `maintenance-label-${m.id}`,
      start: m.startTime,
      end: m.endTime,
      backgroundColor: '#dc2626',
      borderColor: '#b91c1c',
      textColor: '#fff',
      editable: false as const,
      extendedProps: { kind: 'maintenance' as const, maintenance: m },
    }));

    // Eventos de fondo de colación: un evento por día en ventana de ±120 días
    const bgLunchBreak: object[] = [];
    if (lunchBreak?.enabled && lunchBreak.start && lunchBreak.end) {
      const today = new Date();
      for (let i = 0; i <= 120; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        bgLunchBreak.push({
          id: `lunch-bg-${dateStr}`,
          start: `${dateStr}T${lunchBreak.start}:00`,
          end: `${dateStr}T${lunchBreak.end}:00`,
          display: 'background' as const,
          color: '#fecaca',
          extendedProps: { kind: 'lunchBg' as const },
        });
      }
    }

    return [...bgTrainings, ...bgLunchBreak, ...bgMaintenances, ...maintenanceLabels, ...clusterVisibleEvents(rawVisibleEvents)];
  }, [rawVisibleEvents, trainings, maintenances, lunchBreak]);

  // ─── Horarios de negocio FullCalendar ───────────────────────────────────

  const fcBusinessHours = businessHours.length > 0
    ? businessHours.filter((bh) => bh.isOpen).map((bh) => ({
        daysOfWeek: [bh.dayOfWeek],
        startTime: bh.openTime,
        endTime: bh.closeTime,
      }))
    : [{ daysOfWeek: [1, 2, 3, 4, 5, 6], startTime: '09:00', endTime: '17:00' }];

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleDateClick = (info: { date: Date }) => {
    const date = info.date;
    const ms = date.getTime();

    // Si hay una mantención activa en este slot, abrir su detalle
    const activeMaintenance = maintenances.find((m) =>
      ms >= new Date(m.startTime).getTime() && ms < new Date(m.endTime).getTime()
    );
    if (activeMaintenance) {
      if (onMaintenanceClick) onMaintenanceClick(activeMaintenance);
      return;
    }

    if (businessHours.length > 0 && !isWithinBusinessHours(date, businessHours)) {
      setShowClosedPopup(true);
      return;
    }

    // Verificar si cae en horario de colación
    if (lunchBreak?.enabled && lunchBreak.start && lunchBreak.end) {
      const slotH = date.getHours();
      const slotM = date.getMinutes();
      const slotMin = slotH * 60 + slotM;
      const [lsH, lsM] = lunchBreak.start.split(':').map(Number);
      const [leH, leM] = lunchBreak.end.split(':').map(Number);
      const lunchStartMin = lsH * 60 + lsM;
      const lunchEndMin = leH * 60 + leM;
      if (slotMin >= lunchStartMin && slotMin < lunchEndMin) {
        setShowLunchPopup(true);
        return;
      }
    }

    const items: ClusterItem[] = [];

    bookingGroups.forEach((group) => {
      const bS = new Date(group[0].startTime).getTime();
      const bE = new Date(group[0].endTime).getTime();
      if (ms >= bS && ms < bE) items.push({ kind: 'booking', bookings: group });
    });
    trainings.forEach((t) => {
      if (ms >= new Date(t.startTime).getTime() && ms < new Date(t.endTime).getTime())
        items.push({ kind: 'training', training: t });
    });

    if (items.length > 0) {
      setClusterModal({ date, items });
    } else {
      onSlotClick(date);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .fc-timegrid-slot-lane {
          cursor: pointer;
          position: relative;
        }
        .fc-timegrid-slot-lane:hover::after {
          content: '+';
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #d1d5db;
          font-size: 16px;
          font-weight: 700;
          pointer-events: none;
          line-height: 1;
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={isMobile ? 'timeGridDay' : 'timeGridWeek'}
          locale={esLocale}
          headerToolbar={isMobile ? {
            left: 'prev,next', center: 'title', right: 'timeGridDay,timeGridWeek',
          } : {
            left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={events}
          slotMinTime="08:00:00"
          slotMaxTime="18:00:00"
          slotDuration="00:30:00"
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          allDaySlot={false}
          weekends={true}
          height="auto"
          dateClick={handleDateClick}
          businessHours={fcBusinessHours}
          eventContent={(eventInfo) => {
            const props = eventInfo.event.extendedProps;

            // Cluster
            if (props.isCluster) {
              const items = props.clusterItems as ClusterItem[];
              const typeLabels = items.map((it) =>
                it.kind === 'booking' ? it.bookings[0].user.name
                : it.kind === 'training' ? it.training.title
                : 'Certificación'
              );
              return (
                <div className="p-1 overflow-hidden">
                  <p className="font-semibold text-xs">{items.length} actividades</p>
                  <p className="text-xs opacity-80 truncate">{typeLabels.join(' · ')}</p>
                </div>
              );
            }

            // Background events (no content)
            if (props.kind === 'trainingBg' || props.kind === 'lunchBg') return null;

            // Training label individual
            if (props.kind === 'training') {
              const t = props.training as Training;
              return (
                <div className="p-1 overflow-hidden">
                  <p className="font-semibold text-xs truncate">{t.title}</p>
                  {t.exemptions.length > 0 && (
                    <p className="text-xs opacity-80 truncate">
                      Libre: {t.exemptions.map((e) => e.resource.name).join(', ')}
                    </p>
                  )}
                  {isAdmin && <p className="text-xs opacity-70 italic">Click para gestionar</p>}
                </div>
              );
            }

            // Mantención individual
            if (props.kind === 'maintenance') {
              const m = props.maintenance as Maintenance;
              return (
                <div className="p-1 overflow-hidden">
                  <p className="font-semibold text-xs truncate">🔧 {m.title}</p>
                  {m.description && <p className="text-xs opacity-80 truncate">{m.description}</p>}
                </div>
              );
            }

            // Booking (group: 1 evento por sesión de usuaria)
            const bGroup = props.bookings as Booking[];
            const first = bGroup?.[0];
            if (!first) return null;
            const isMulti = bGroup.length > 1;
            if (isMulti) {
              return (
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 50%, #dc2626 100%)', borderRadius: 'inherit', overflow: 'hidden' }}>
                  <div className="p-1 h-full flex flex-col justify-between">
                    <div>
                      <p className="font-semibold text-xs truncate text-white">{first.user.name}</p>
                      <p className="text-xs truncate text-white/80">
                        {bGroup.length} máquinas · {bGroup.map((b) => b.resource.name).join(', ')}
                      </p>
                      <p className="text-xs text-white/70">{PURPOSE_LABELS[first.purpose]}</p>
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div className="p-1 overflow-hidden h-full flex flex-col justify-between">
                <div>
                  <p className="font-semibold text-xs truncate">{first.user.name}</p>
                  <p className="text-xs opacity-80 truncate">
                    {bGroup.map((b) => b.resource.name).join(', ')}
                  </p>
                  <p className="text-xs opacity-75">{PURPOSE_LABELS[first.purpose]}</p>
                </div>
              </div>
            );
          }}
          eventClick={(info) => {
            const props = info.event.extendedProps;
            if (props.kind === 'trainingBg' || props.kind === 'maintenanceBg' || props.kind === 'lunchBg') return;

            // Mantención: abrir detalle directo (no aplica cluster)
            if (props.kind === 'maintenance') {
              if (onMaintenanceClick) onMaintenanceClick(props.maintenance as Maintenance);
              return;
            }

            // Para cualquier evento (cluster o individual), recolectar todas las
            // actividades que se solapan con el rango del evento clickeado y mostrar
            // siempre el cluster modal. Esto permite ver el detalle O agregar algo nuevo.
            const evStart = info.event.start!.getTime();
            const evEnd   = info.event.end   ? info.event.end.getTime()
                                             : evStart + 30 * 60 * 1000;
            const items: ClusterItem[] = [];

            bookingGroups.forEach((group) => {
              const bS = new Date(group[0].startTime).getTime();
              const bE = new Date(group[0].endTime).getTime();
              if (bS < evEnd && bE > evStart) items.push({ kind: 'booking', bookings: group });
            });
            trainings.forEach((t) => {
              const tS = new Date(t.startTime).getTime();
              const tE = new Date(t.endTime).getTime();
              if (tS < evEnd && tE > evStart) items.push({ kind: 'training', training: t });
            });

            if (items.length > 0) {
              setClusterModal({ date: info.event.start!, items });
            }
          }}
          nowIndicator
        />
      </div>

      {/* ── Popup: horario no disponible ────────────────────────────────── */}
      {showClosedPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowClosedPopup(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Horario no disponible</h3>
                <p className="text-sm text-gray-600">
                  No se puede agendar en este horario. Ponte en contacto con un administrador.
                </p>
              </div>
            </div>
            <button onClick={() => setShowClosedPopup(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-lg transition-colors">
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ── Popup: horario de colación ────────────────────────────────────── */}
      {showLunchPopup && lunchBreak && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowLunchPopup(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Horario de colación</h3>
                <p className="text-sm text-gray-600">
                  No se puede agendar en horario de colación. Debes agendar antes de las{' '}
                  <strong>{lunchBreak.start}</strong> y después de las{' '}
                  <strong>{lunchBreak.end}</strong>.
                </p>
              </div>
            </div>
            <button onClick={() => setShowLunchPopup(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-lg transition-colors">
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ── Modal de actividades agrupadas (cluster) ─────────────────────── */}
      {clusterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setClusterModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 capitalize">
                  {clusterModal.date.toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long' })}
                </h3>
                <p className="text-sm text-gray-500">
                  {clusterModal.items.length} actividad{clusterModal.items.length !== 1 ? 'es' : ''} en este horario
                </p>
              </div>
              <button onClick={() => setClusterModal(null)}
                className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full p-1 -m-1 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <ul className="space-y-1.5 mb-4">
              {clusterModal.items.map((item, i) => (
                <li key={i}>
                  <button
                    onClick={() => handleClusterItemClick(item)}
                    className="w-full text-left bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2.5 text-sm transition-colors"
                  >
                    {item.kind === 'booking' && (() => {
                      const first = item.bookings[0];
                      const isMulti = item.bookings.length > 1;
                      return (
                        <>
                          <div className="flex items-center gap-2">
                            {isMulti ? (
                              <div className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed, #dc2626)' }} />
                            ) : (
                              <div className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: first.resource.category?.color ?? '#6b7280' }} />
                            )}
                            <span className="font-medium text-gray-900">{first.user.name}</span>
                            <span className="text-xs text-gray-400">
                              {new Date(first.startTime).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}
                              {' – '}
                              {new Date(first.endTime).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </span>
                          </div>
                          <div className="mt-1 space-y-0.5">
                            {item.bookings.map((b) => (
                              <div key={b.id} className="flex items-center gap-1.5 ml-1">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: b.resource.category?.color ?? '#6b7280' }} />
                                <span className="text-xs text-gray-500">{b.resource.name}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                    {item.kind === 'training' && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0 bg-amber-400" />
                        <span className="font-medium text-gray-900">{item.training.title}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-amber-600">Capacitación</span>
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            <button
              onClick={() => { onSlotClick(clusterModal.date); setClusterModal(null); }}
              className="w-full py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nueva actividad en este horario
            </button>
          </div>
        </div>
      )}

      {/* ── Modal de detalle de reserva ──────────────────────────────────── */}
      {detail?.kind === 'booking' && (() => {
        const first = detail.bookings[0];
        const canEdit = isAdmin || currentUserId === first.userId;
        const purposeText = first.purpose === 'PRODUCE'
          ? `Producir: ${first.produceItem} x${first.produceQty}`
          : PURPOSE_LABELS[first.purpose];
        const isActive = first.status !== 'CANCELLED' && first.status !== 'REJECTED';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
            onClick={closeDetail}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Detalle de reserva</h3>
                <button onClick={closeDetail}
                  className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full p-1 -m-1 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {confirmCancelBooking ? (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-700">¿Confirmas que deseas cancelar esta reserva?</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmCancelBooking(false)} disabled={cancelLoading}
                      className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60">
                      Volver
                    </button>
                    <button onClick={handleCancelBooking} disabled={cancelLoading}
                      className="flex-1 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60">
                      {cancelLoading ? 'Cancelando...' : 'Sí, cancelar'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium text-gray-700">Usuaria:</span> <span className="text-gray-900">{first.user.name}</span></p>
                    <p>
                      <span className="font-medium text-gray-700">Horario:</span>{' '}
                      <span className="text-gray-900">
                        {new Date(first.startTime).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
                        {new Date(first.startTime).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        {' – '}
                        {new Date(first.endTime).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </span>
                    </p>
                    <p><span className="font-medium text-gray-700">Propósito:</span> <span className="text-gray-900">{purposeText}</span></p>
                    <div>
                      <p className="font-medium text-gray-700 mb-1">Máquinas:</p>
                      <div className="space-y-1">
                        {detail.bookings.map((b) => (
                          <div key={b.id} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: b.resource.category?.color ?? '#6b7280' }} />
                            <span className="text-gray-900">{b.resource.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {first.notes && <p><span className="font-medium text-gray-700">Notas:</span> <span className="text-gray-900">{first.notes}</span></p>}
                  </div>
                  <div className="flex gap-2 mt-5">
                    {canEdit && isActive && onEditBooking && (
                      <button onClick={() => { closeDetail(); onEditBooking(detail.bookings); }}
                        className="flex-1 bg-brand-50 hover:bg-brand-100 text-brand-700 text-sm font-medium py-2 rounded-lg border border-brand-200 transition-colors">
                        Editar
                      </button>
                    )}
                    {canEdit && isActive && onCancelBooking && (
                      <button onClick={() => setConfirmCancelBooking(true)}
                        className="px-3 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors">
                        Cancelar
                      </button>
                    )}
                    <button onClick={closeDetail}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 rounded-lg transition-colors">
                      Cerrar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

    </>
  );
}
