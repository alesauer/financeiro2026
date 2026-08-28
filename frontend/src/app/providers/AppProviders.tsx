import type { ReactNode } from 'react'

import { AuthProvider } from '@/app/providers/AuthProvider'

export function AppProviders({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
