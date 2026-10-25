export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', signal });
  const payload = await response.json().catch(() => ({ error: 'Invalid server response' }));
  if (!response.ok) throw new ApiError(payload.error || `Request failed (${response.status})`, response.status);
  return payload as T;
}

export async function mutateJSON<T>(url: string, method: 'POST' | 'PATCH' | 'DELETE',
  csrfToken: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'content-type': 'application/json', 'x-trace-csrf': csrfToken },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({ error: 'Invalid server response' }));
  if (!response.ok) throw new ApiError(payload.error || `Request failed (${response.status})`, response.status);
  return payload as T;
}

export function formatDate(value?: string | null): string {
  if (!value) return 'Unknown time';
  const stamp = new Date(value);
  return Number.isNaN(stamp.valueOf()) ? value : stamp.toLocaleString();
}

export function stringifyContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return '';
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

export function truncateText(text: string, max = 180): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
