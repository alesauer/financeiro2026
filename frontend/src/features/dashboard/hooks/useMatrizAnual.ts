import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/app/providers/AuthProvider'
import { dashboardService } from '@/features/dashboard/services/dashboardService'
import type { MatrizAgrupamento, MatrizAnual, MatrizBase, MatrizCartoesModo } from '@/shared/types/relatorio'
import { getErrorMessage } from '@/shared/utils/error'

export type MatrizFiltros = {
  ano: number
  agrupar: MatrizAgrupamento
  base: MatrizBase
  cartoes: MatrizCartoesModo
  comparar: boolean
}

export function useMatrizAnual(filtros: MatrizFiltros) {
  const { token } = useAuth()

  const [dados, setDados] = useState<MatrizAnual | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { ano, agrupar, base, cartoes, comparar } = filtros

  const carregar = useCallback(async () => {
    if (!token) return

    setLoading(true)
    setError(null)

    try {
      const resposta = await dashboardService.matrizAnual(token, { ano, agrupar, base, cartoes, comparar })
      setDados(resposta)
    } catch (err) {
      setDados(null)
      setError(getErrorMessage(err, 'Não foi possível carregar os dados do dashboard.'))
    } finally {
      setLoading(false)
    }
  }, [token, ano, agrupar, base, cartoes, comparar])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { dados, loading, error, recarregar: carregar }
}
