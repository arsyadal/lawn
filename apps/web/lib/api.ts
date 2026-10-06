const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '/api').replace(/\/$/, '');
let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}
function getStringProperty(value: unknown, property: string): string | null {
  if (!value || typeof value !== 'object' || !(property in value)) return null;
  const propertyValue = (value as Record<string, unknown>)[property];
  return typeof propertyValue === 'string' ? propertyValue : null;
}

function errorMessage(body: unknown, fallback: string): string {
  const message = getStringProperty(body, 'message');
  if (message) return message;
  if (body && typeof body === 'object' && 'message' in body && Array.isArray(body.message)) {
    return body.message.filter((item): item is string => typeof item === 'string').join(', ');
  }
  return getStringProperty(body, 'error') ?? fallback;
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!csrfRequest) {
    csrfRequest = fetch(`${API_BASE}/auth/csrf`, { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => ({}));
        if (!response.ok) throw new ApiError(errorMessage(body, 'Gagal menyiapkan keamanan formulir.'), response.status, body);
        let token = getStringProperty(body, 'csrfToken') ?? getStringProperty(body, 'token');
        if (!token && body && typeof body === 'object' && 'data' in body) token = getStringProperty(body.data, 'csrfToken');
        if (!token) throw new ApiError('Token keamanan tidak tersedia.', 500, body);
        csrfToken = token;
        return token;
      })
      .finally(() => { csrfRequest = null; });
  }
  return csrfRequest;
}

export interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipCsrf?: boolean;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json');
  if (mutating && !options.skipCsrf) headers.set('X-CSRF-Token', await getCsrfToken());

  const response = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
    cache: 'no-store',
    body: options.body instanceof FormData ? options.body : options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 403 && errorMessage(body, '').toLowerCase().includes('csrf')) csrfToken = null;
    if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('lawn:unauthorized'));
    throw new ApiError(errorMessage(body, `Permintaan gagal (${response.status}).`), response.status, body);
  }
  if (body && typeof body === 'object' && 'data' in body && Object.keys(body).length === 1) {
    const responseData = body.data;
    return responseData as T;
  }
  return body as T;
}
export function clearApiSession() {
  csrfToken = null;
}

export function listResult<T>(value: T[] | { data?: T[]; items?: T[]; total?: number }): { data: T[]; total: number } {
  if (Array.isArray(value)) return { data: value, total: value.length };
  const data = value.data ?? value.items ?? [];
  return { data, total: value.total ?? data.length };
}

export { API_BASE };
