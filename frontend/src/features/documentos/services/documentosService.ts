import { env } from '@/shared/config/env'
import { httpClient } from '@/shared/api/httpClient'
import type { Documento, DocumentoAnexo, DocumentoPaginated, DocumentoPayload, TipoDocumento } from '@/shared/types/documento'

const BASE = '/api/documentos'

function baseUrl(path: string) {
  if (!env.apiBaseUrl) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${env.apiBaseUrl}${normalized}`
}

export const documentosService = {
  list(
    token: string,
    filters?: {
      page?: number
      perPage?: number
      tipoId?: number
      favorito?: boolean
      search?: string
      status?: string
    }
  ) {
    const params = new URLSearchParams()
    if (filters?.page) params.set('page', String(filters.page))
    if (filters?.perPage) params.set('per_page', String(filters.perPage))
    if (filters?.tipoId) params.set('tipo_id', String(filters.tipoId))
    if (filters?.favorito !== undefined) params.set('favorito', String(filters.favorito))
    if (filters?.search) params.set('search', filters.search)
    if (filters?.status) params.set('status', filters.status)

    const query = params.toString() ? `?${params.toString()}` : ''
    return httpClient.get<DocumentoPaginated>(`${BASE}/${query}`, token)
  },
  tipos(token: string) {
    return httpClient.get<TipoDocumento[]>(`${BASE}/tipos`, token)
  },
  get(token: string, id: number) {
    return httpClient.get<Documento>(`${BASE}/${id}`, token)
  },
  create(token: string, payload: DocumentoPayload) {
    return httpClient.post<Documento>(`${BASE}/`, payload, token)
  },
  update(token: string, id: number, payload: Partial<DocumentoPayload>) {
    return httpClient.put<Documento>(`${BASE}/${id}`, payload, token)
  },
  toggleFavorito(token: string, id: number) {
    return httpClient.patch<Documento>(`${BASE}/${id}/favorito`, {}, token)
  },
  remove(token: string, id: number) {
    return httpClient.del<{ message: string }>(`${BASE}/${id}`, token)
  },
  listAnexos(token: string, id: number) {
    return httpClient.get<DocumentoAnexo[]>(`${BASE}/${id}/anexos`, token)
  },
  deleteAnexo(token: string, id: number, anexoId: number) {
    return httpClient.del<{ message: string }>(`${BASE}/${id}/anexos/${anexoId}`, token)
  },
  async downloadAnexo(token: string, id: number, anexoId: number) {
    const response = await fetch(baseUrl(`${BASE}/${id}/anexos/${anexoId}`), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(typeof payload === 'string' ? payload : JSON.stringify(payload))
    }

    const disposition = response.headers.get('content-disposition')
    const filenameMatch = disposition?.match(/filename="?([^\"]+)"?/)?.[1]
    const filename = filenameMatch || `anexo-${anexoId}`
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  },
  async getAnexoBlob(token: string, id: number, anexoId: number) {
    const response = await fetch(baseUrl(`${BASE}/${id}/anexos/${anexoId}`), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      throw new Error('Não foi possível carregar o anexo')
    }

    const blob = await response.blob()
    return URL.createObjectURL(blob)
  },
  async uploadAnexos(token: string, id: number, files: File[]) {
    const form = new FormData()
    files.forEach((file) => form.append('files', file))

    const response = await fetch(baseUrl(`${BASE}/${id}/anexos`), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(typeof payload === 'string' ? payload : JSON.stringify(payload))
    }

    return (await response.json()) as DocumentoAnexo[]
  },
}
