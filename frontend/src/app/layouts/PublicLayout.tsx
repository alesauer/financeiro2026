import { Outlet } from 'react-router-dom'

export function PublicLayout() {
  return (
    <main className="min-h-screen w-full bg-[#f1f5f4] text-slate-900 antialiased selection:bg-teal-600 selection:text-white">
      <Outlet />
    </main>
  )
}
