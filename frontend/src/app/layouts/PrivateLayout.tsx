import {
  BarChart3,
  Bell,
  Bot,
  CreditCard,
  FileText,
  Home,
  Landmark,
  LogOut,
  Menu,
  Settings,
  Tags,
  User,
  Wallet,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { useAuth } from '@/app/providers/AuthProvider'

export function PrivateLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const displayName = user?.nome ?? user?.email ?? 'Usuário'
  const userInitial = displayName.trim().charAt(0).toUpperCase() || 'U'

  const handleLogout = () => {
    setIsMobileSidebarOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  const handleNavigate = () => {
    setIsMobileSidebarOpen(false)
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      {isMobileSidebarOpen ? (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-200 lg:sticky lg:top-0 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isSidebarCollapsed ? 'w-72 lg:w-20' : 'w-72'}
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-[var(--color-border)] px-4">
          <span
            className={`text-lg font-semibold text-[var(--color-text)] ${
              isSidebarCollapsed ? 'inline lg:hidden' : 'inline'
            }`}
          >
            Finanças
          </span>
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className="hidden items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] p-2 text-[var(--color-text)] lg:inline-flex"
            title={isSidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <NavItem to="/" icon={<Home className="h-4 w-4" />} collapsed={isSidebarCollapsed} onClick={handleNavigate}>
            DashBoard
          </NavItem>
          <NavItem
            to="/transacoes"
            icon={<Wallet className="h-4 w-4" />}
            collapsed={isSidebarCollapsed}
            onClick={handleNavigate}
          >
            Transações
          </NavItem>
          <NavItem
            to="/relatorios"
            icon={<BarChart3 className="h-4 w-4" />}
            collapsed={isSidebarCollapsed}
            onClick={handleNavigate}
          >
            Relatórios
          </NavItem>
          <NavItem to="/lembretes" icon={<Bell className="h-4 w-4" />} collapsed={isSidebarCollapsed} onClick={handleNavigate}>
            Lembretes
          </NavItem>
          <NavItem to="/milhas" icon={<CreditCard className="h-4 w-4" />} collapsed={isSidebarCollapsed} onClick={handleNavigate}>
            Milhas
          </NavItem>
          <NavItem to="/investimentos" icon={<Landmark className="h-4 w-4" />} collapsed={isSidebarCollapsed} onClick={handleNavigate}>
            Investimentos
          </NavItem>
          <NavItem
            to="/investimentos/mercado"
            icon={<BarChart3 className="h-4 w-4" />}
            collapsed={isSidebarCollapsed}
            nested
            onClick={handleNavigate}
          >
            Mercado
          </NavItem>
          <NavItem
            to="/documentos"
            icon={<FileText className="h-4 w-4" />}
            collapsed={isSidebarCollapsed}
            onClick={handleNavigate}
          >
            Documentos
          </NavItem>
          <NavItem to="/ia" icon={<Bot className="h-4 w-4" />} collapsed={isSidebarCollapsed} onClick={handleNavigate}>
            IA
          </NavItem>

          <div className="pt-2">
            <div
              className={`mb-1 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] ${
                isSidebarCollapsed ? 'justify-start lg:justify-center' : ''
              }`}
            >
              <Settings className="h-4 w-4" />
              <span className={isSidebarCollapsed ? 'inline lg:hidden' : 'inline'}>Configuração</span>
            </div>

            <div className="space-y-1">
              <NavItem
                to="/formas-pagamento"
                icon={<CreditCard className="h-4 w-4" />}
                collapsed={isSidebarCollapsed}
                nested
                onClick={handleNavigate}
              >
                Formas Pagamento
              </NavItem>
              <NavItem
                to="/categorias"
                icon={<Tags className="h-4 w-4" />}
                collapsed={isSidebarCollapsed}
                nested
                onClick={handleNavigate}
              >
                Categorias
              </NavItem>
              <NavItem
                to="/usuarios"
                icon={<User className="h-4 w-4" />}
                collapsed={isSidebarCollapsed}
                nested
                onClick={handleNavigate}
              >
                Usuários
              </NavItem>
            </div>
          </div>
        </nav>

        <div className="mt-auto border-t border-[var(--color-border)] p-4">
          <div className={`mb-3 flex items-center gap-3 ${isSidebarCollapsed ? 'justify-start lg:justify-center' : ''}`}>
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-semibold text-[var(--color-primary-foreground)]">
              {userInitial}
            </div>
            <div className={isSidebarCollapsed ? 'min-w-0 lg:hidden' : 'min-w-0'}>
              <p className="truncate text-sm font-semibold leading-4 text-[var(--color-text)]">{displayName}</p>
              <p className="truncate text-xs text-[var(--color-muted)]">Administrador</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className={`inline-flex w-full items-center rounded-[var(--radius-sm)] px-2 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700 ${
              isSidebarCollapsed ? 'justify-start gap-2 lg:justify-center' : 'justify-start gap-2'
            }`}
            title="Sair do Sistema"
          >
            <LogOut className="h-4 w-4" />
            <span className={isSidebarCollapsed ? 'inline lg:hidden' : 'inline'}>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] p-2 text-[var(--color-text)] lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <h1 className="text-lg font-semibold text-[var(--color-text)]">Painel</h1>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NavItem({
  to,
  children,
  icon,
  collapsed,
  nested,
  onClick,
}: {
  to: string
  children: ReactNode
  icon: ReactNode
  collapsed: boolean
  nested?: boolean
  onClick?: () => void
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-sm transition ${nested ? 'pl-4' : ''} ${
          collapsed ? 'justify-start px-2.5 lg:justify-center' : ''
        } ${
          isActive
            ? 'bg-[var(--color-primary)]/10 font-medium text-[var(--color-primary)]'
            : 'text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-text)]'
        }`
      }
    >
      <span>{icon}</span>
      <span className={collapsed ? 'inline lg:hidden' : 'inline'}>{children}</span>
    </NavLink>
  )
}
