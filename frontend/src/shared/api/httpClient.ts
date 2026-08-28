import { env } from '@/shared/config/env'

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  token?: string
  signal?: AbortSignal
}

type ApiError = Error & {
  status?: number
  payload?: unknown
}

function resolveUrl(path: string) {
  if (!env.apiBaseUrl) {
    return path.startsWith('/api') ? path : `/api${path}`
  }

  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${env.apiBaseUrl}${normalized}`
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...options.headers,
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (options.body !== undefined && !isFormData) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  const response = await fetch(resolveUrl(path), {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined || isFormData ? (options.body as BodyInit | undefined) : JSON.stringify(options.body),
    signal: options.signal,
  })

  if (!response.ok) {
    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      payload = await response.text().catch(() => null)
    }

    const error: ApiError = new Error('Erro na requisição da API')
    error.status = response.status
    error.payload = payload
    throw error
  }

  if (response.status === 204) {
    return null as T
  }

  return (await response.json()) as T
}

export const httpClient = {
  get: <T>(path: string, token?: string, signal?: AbortSignal) => request<T>(path, { method: 'GET', token, signal }),
  post: <T>(path: string, body?: unknown, token?: string, signal?: AbortSignal) =>
    request<T>(path, { method: 'POST', body, token, signal }),
  put: <T>(path: string, body?: unknown, token?: string, signal?: AbortSignal) =>
    request<T>(path, { method: 'PUT', body, token, signal }),
  patch: <T>(path: string, body?: unknown, token?: string, signal?: AbortSignal) =>
    request<T>(path, { method: 'PATCH', body, token, signal }),
  del: <T>(path: string, token?: string, signal?: AbortSignal) => request<T>(path, { method: 'DELETE', token, signal }),
}
