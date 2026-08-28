import { httpClient } from '@/shared/api/httpClient'
import type { ClassificarCategoriaPayload, ClassificarCategoriaResponse } from '@/shared/types/ia'

export const iaService = {
  classificarCategorias(payload: ClassificarCategoriaPayload) {
    return httpClient.post<ClassificarCategoriaResponse>('/api/ia/classificar_categoria', payload)
  },
}
