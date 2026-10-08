import { Outlet } from 'react-router-dom'

export function PublicLayout() {
  return (
    <main className="min-h-screen w-full bg-[#0B0F19] text-slate-100 antialiased selection:bg-teal-500 selection:text-white">
      <Outlet />
    </main>
  )
}
