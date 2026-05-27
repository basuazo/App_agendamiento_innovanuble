export function getApiError(err: unknown, fallback = 'Ha ocurrido un error'): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e?.response?.data?.error ?? e?.message ?? fallback;
}
