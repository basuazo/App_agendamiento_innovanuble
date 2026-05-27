export interface SortState { key: string; dir: 'asc' | 'desc'; }

export function toggleSort(current: SortState | null, key: string): SortState {
  if (current?.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  return { key, dir: 'asc' };
}

export function compareVals(a: unknown, b: unknown, dir: 'asc' | 'desc'): number {
  const av = a == null ? '' : String(a);
  const bv = b == null ? '' : String(b);
  const cmp = av.localeCompare(bv, 'es', { sensitivity: 'base', numeric: true });
  return dir === 'asc' ? cmp : -cmp;
}

interface Props {
  label: string;
  sortKey: string;
  sort: SortState | null;
  onSort: (key: string) => void;
  className?: string;
}

export default function SortableHeader({ label, sortKey, sort, onSort, className = '' }: Props) {
  const isActive = sort?.key === sortKey;
  const icon = isActive ? (sort!.dir === 'asc' ? '↑' : '↓') : '↕';
  return (
    <th
      className={`px-4 py-3 font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-xs leading-none ${isActive ? 'text-brand-500' : 'text-gray-400'}`}>{icon}</span>
      </span>
    </th>
  );
}
