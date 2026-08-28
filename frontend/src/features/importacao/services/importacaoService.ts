import { httpClient } from '@/shared/api/httpClient'
import type {
  ClassificacaoCategoriasPayload,
  ClassificacaoCategoriasResultado,
  ImportacaoPayload,
  ImportacaoResultado,
} from '@/shared/types/importacao'

export const importacaoService = {
  importarTransacoes(payload: ImportacaoPayload, token?: string) {
    return httpClient.post<ImportacaoResultado>('/api/importar_transacoes', payload, token)
  },
  classificarCategorias(payload: ClassificacaoCategoriasPayload, token?: string) {
    return httpClient.post<ClassificacaoCategoriasResultado>('/api/ia/classificar_categoria', payload, token)
  },
}
