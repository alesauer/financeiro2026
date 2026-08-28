import type { PaginatedResponse } from '@/shared/types/lembrete'

export type TipoDocumento = {
  id: number
  nome: string
  descricao: string | null
  ativo: boolean
}

export type DocumentoAnexo = {
  id: number
  documento_id: number
  original_name: string
  stored_name: string
  mime_type: string
  size_bytes: number
  storage_path: string
  uploaded_at: string
}

export type Documento = {
  id: number
  usuario_id: number
  tipo_documento_id: number
  tipo_documento_nome?: string | null
  nome: string
  registro: string | null
  outras_informacoes: string | null
  anexos?: DocumentoAnexo[]
  created_at: string
  updated_at: string
}

export type DocumentoPayload = {
  tipo_documento_id: number
  nome: string
  registro: string | null
  outras_informacoes: string | null
}

export type DocumentoPaginated = PaginatedResponse<Documento>
