export function getErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado.') {
  if (!error) return fallback

  if (error instanceof Error) {
    const candidate = error as Error & { payload?: unknown }
    if (candidate.payload) {
      if (typeof candidate.payload === 'string') return candidate.payload
      if (typeof candidate.payload === 'object') {
        try {
          return JSON.stringify(candidate.payload)
        } catch {
          return candidate.message || fallback
        }
      }
    }

    return candidate.message || fallback
  }

  if (typeof error === 'string') return error
  return fallback
}
