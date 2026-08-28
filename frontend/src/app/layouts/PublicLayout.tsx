import { Outlet } from 'react-router-dom'

export function PublicLayout() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10">
      <Outlet />
    </main>
  )
}
