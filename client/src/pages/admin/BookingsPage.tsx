import { useEffect, useMemo, useState } from 'react';
import { Booking } from '../../types';
import { bookingService } from '../../services/booking.service';
import { formatDateTime, PURPOSE_LABELS } from '../../utils/dateHelpers';
import { useAuthStore } from '../../store/authStore';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import SortableHeader, { SortState, toggleSort, compareVals } from '../../components/shared/SortableHeader';
import toast from 'react-hot-toast';

type FilterType = 'ALL' | 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REJECTED';

interface BookingGroup {
  key: string;
  user: Booking['user'];
  startTime: string;
  endTime: string;
  purpose: Booking['purpose'];
  bookings: Booking[];
  status: Booking['status'];
}

function groupBookings(bookings: Booking[]): BookingGroup[] {
  const map = new Map<string, BookingGroup>();
  for (const b of bookings) {
    const key = `${b.userId}_${b.startTime}_${b.endTime}_${b.purpose}`;
    if (!map.has(key)) {
      map.set(key, { key, user: b.user, startTime: b.startTime, endTime: b.endTime, purpose: b.purpose, bookings: [], status: b.status });
    }
    map.get(key)!.bookings.push(b);
  }
  return Array.from(map.values());
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  CONFIRMED: { label: 'Confirmada',  className: 'bg-green-100 text-green-700' },
  PENDING:   { label: 'Pendiente',   className: 'bg-amber-100 text-amber-700' },
  CANCELLED: { label: 'Cancelada',   className: 'bg-red-100 text-red-500' },
  REJECTED:  { label: 'Rechazada',   className: 'bg-red-100 text-red-700' },
};

export default function BookingsPage() {
  const { currentSpaceId } = useAuthStore();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortState | null>(null);
  const handleSort = (key: string) => setSort(toggleSort(sort, key));
  const [cancellingKey, setCancellingKey] = useState<string | null>(null);
  const [approvingKey, setApprovingKey] = useState<string | null>(null);
  const [rejectingKey, setRejectingKey] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const data = await bookingService.getAdminAll();
      setBookings(data);
    } catch {
      toast.error('Error al cargar reservas');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [currentSpaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await bookingService.exportExcel();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'reservas.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  const handleCancel = async (group: BookingGroup) => {
    if (!confirm('¿Cancelar esta reserva?')) return;
    setCancellingKey(group.key);
    try {
      for (const b of group.bookings) await bookingService.cancel(b.id);
      toast.success('Reserva cancelada');
      load(true);
    } catch {
      toast.error('Error al cancelar');
    } finally {
      setCancellingKey(null);
    }
  };

  const handleApprove = async (group: BookingGroup) => {
    setApprovingKey(group.key);
    try {
      for (const b of group.bookings) await bookingService.approve(b.id);
      toast.success('Reserva aprobada');
      load(true);
    } catch {
      toast.error('Error al aprobar');
    } finally {
      setApprovingKey(null);
    }
  };

  const handleReject = async (group: BookingGroup) => {
    if (!confirm('¿Rechazar esta reserva?')) return;
    setRejectingKey(group.key);
    try {
      for (const b of group.bookings) await bookingService.reject(b.id);
      toast.success('Reserva rechazada');
      load(true);
    } catch {
      toast.error('Error al rechazar');
    } finally {
      setRejectingKey(null);
    }
  };

  const pendingCount = bookings.filter((b) => b.status === 'PENDING').length;

  const displayGroups = useMemo(() => {
    const q = search.toLowerCase();
    const byStatus = bookings.filter((b) => filter === 'ALL' || b.status === filter);
    const bySearch = q
      ? byStatus.filter((b) =>
          b.resource.name.toLowerCase().includes(q) ||
          b.user.name.toLowerCase().includes(q) ||
          b.user.email.toLowerCase().includes(q)
        )
      : byStatus;
    const groups = groupBookings(bySearch);
    if (!sort) return groups;
    return [...groups].sort((a, b) => {
      const val = (x: BookingGroup) =>
        sort.key === 'user'      ? x.user.name :
        sort.key === 'startTime' ? x.startTime :
        sort.key === 'purpose'   ? x.purpose :
        sort.key === 'status'    ? x.status : '';
      return compareVals(val(a), val(b), sort.dir);
    });
  }, [bookings, filter, search, sort]);

  const filterLabels: Record<FilterType, string> = {
    ALL: 'Todas',
    PENDING: `Pendientes${pendingCount > 0 ? ` (${pendingCount})` : ''}`,
    CONFIRMED: 'Confirmadas',
    CANCELLED: 'Canceladas',
    REJECTED: 'Rechazadas',
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Todas las Reservas</h1>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {exporting ? 'Exportando...' : 'Exportar Excel'}
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por máquina o usuario..."
          className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6 flex-wrap">
        {(['ALL', 'PENDING', 'CONFIRMED', 'CANCELLED', 'REJECTED'] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <SortableHeader label="Usuario" sortKey="user" sort={sort} onSort={handleSort} className="text-left" />
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Máquinas</th>
                  <SortableHeader label="Fecha y Hora" sortKey="startTime" sort={sort} onSort={handleSort} className="text-left" />
                  <SortableHeader label="Propósito" sortKey="purpose" sort={sort} onSort={handleSort} className="text-left" />
                  <SortableHeader label="Estado" sortKey="status" sort={sort} onSort={handleSort} className="text-center" />
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayGroups.map((g) => {
                  const badge = STATUS_BADGE[g.status] ?? { label: g.status, className: 'bg-gray-100 text-gray-600' };
                  const faded = g.status === 'CANCELLED' || g.status === 'REJECTED';
                  return (
                    <tr key={g.key} className={faded ? 'opacity-60' : ''}>
                      <td className="px-4 py-3">
                        <p className="text-gray-900 font-medium">{g.user.name}</p>
                        <p className="text-xs text-gray-400">{g.user.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {g.bookings.map((b) => (
                            <div key={b.id} className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: b.resource.category?.color ?? '#6b7280' }}
                              />
                              <span className="text-gray-700">{b.resource.name}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDateTime(g.startTime)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {PURPOSE_LABELS[g.purpose]}
                        </span>
                        {g.purpose === 'PRODUCE' && g.bookings[0].produceItem && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {g.bookings[0].produceItem} x{g.bookings[0].produceQty}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {g.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApprove(g)}
                                disabled={approvingKey === g.key}
                                className="text-xs text-emerald-600 hover:text-emerald-800 font-medium disabled:opacity-60"
                              >
                                {approvingKey === g.key ? '...' : 'Aprobar'}
                              </button>
                              <button
                                onClick={() => handleReject(g)}
                                disabled={rejectingKey === g.key}
                                className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-60"
                              >
                                {rejectingKey === g.key ? '...' : 'Rechazar'}
                              </button>
                            </>
                          )}
                          {g.status === 'CONFIRMED' && (
                            <button
                              onClick={() => handleCancel(g)}
                              disabled={cancellingKey === g.key}
                              className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-60"
                            >
                              {cancellingKey === g.key ? '...' : 'Cancelar'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {displayGroups.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">No hay reservas en esta sección</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
