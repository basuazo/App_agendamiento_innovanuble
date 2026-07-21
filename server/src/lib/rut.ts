export function normalizeRut(raw: string): string {
  return (raw ?? '').replace(/[.\-\s]/g, '').toUpperCase();
}
