import {
  BarChart3,
  Bell,
  Bot,
  ChevronDown,
  CreditCard,
  FileText,
  Home,
  Landmark,
  ListChecks,
  LogOut,
  Menu,
  PieChart,
  Plus,
  Settings,
  Tags,
  Target,
  User,
  Wallet,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '@/app/providers/AuthProvider'

const CONFIG_PATHS = ['/formas-pagamento', '/categorias', '/usuarios', '/configuracoes']

export function PrivateLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isConfigRouteActive = CONFIG_PATHS.some((path) => location.pathname.startsWith(path))
  const isMetasRouteActive = location.pathname.startsWith('/metas')

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false)
  const [isMetasOpen, setIsMetasOpen] = useState<boolean>(() => location.pathname.startsWith('/metas'))

  useEffect(() => {
    if (location.pathname.startsWith('/metas')) {
      setIsMetasOpen(true)
    }
  }, [location.pathname])

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
        } ${isSidebarCollapsed ? 'w-72 lg:w-20' : 'w-72'}`}
      >
        <div className="flex h-16 items-center justify-between border-b border-[var(--color-border)] px-4">
          <span
            className={`text-lg font-semibold text-[var(--color-text)] ${
              isSidebarCollapsed ? 'inline lg:hidden' : 'inline'
            }`}
          >
            Maluki Organiza
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

        <nav aria-label="Menu principal" className="flex-1 space-y-1 overflow-y-auto p-3">
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

          {/* Grupo: Metas de Gastos */}
          <div>
            <button
              type="button"
              onClick={() => {
                if (isSidebarCollapsed) {
                  navigate('/metas')
                  handleNavigate()
                  return
                }
                setIsMetasOpen((prev) => !prev)
              }}
              aria-expanded={isMetasOpen}
              aria-controls="sidebar-metas-submenu"
              className={`flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2.5 py-2 text-sm transition cursor-pointer ${
                isSidebarCollapsed ? 'justify-start lg:justify-center' : ''
              } ${
                isMetasRouteActive
                  ? 'bg-emerald-600 font-semibold text-white shadow-2xs'
                  : 'text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-text)]'
              }`}
              title="Metas de Gastos"
            >
              <span className="flex items-center gap-2">
                <Target className="h-4 w-4 shrink-0" />
                <span className={isSidebarCollapsed ? 'inline lg:hidden' : 'inline'}>Metas de Gastos</span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                  isSidebarCollapsed ? 'inline lg:hidden' : 'inline'
                } ${isMetasOpen ? 'rotate-0' : '-rotate-90'}`}
              />
            </button>

            <div
              id="sidebar-metas-submenu"
              hidden={!isMetasOpen}
              className="mt-1 space-y-0.5"
            >
              <NavItem
                to="/metas"
                end
                icon={<PieChart className="h-3.5 w-3.5" />}
                collapsed={isSidebarCollapsed}
                nested
                onClick={handleNavigate}
              >
                Visão Geral
              </NavItem>
              <NavItem
                to="/metas/lista"
                icon={<ListChecks className="h-3.5 w-3.5" />}
                collapsed={isSidebarCollapsed}
                nested
                onClick={handleNavigate}
              >
                Minhas Metas
              </NavItem>
              <NavItem
                to="/metas/analises"
                icon={<BarChart3 className="h-3.5 w-3.5" />}
                collapsed={isSidebarCollapsed}
                nested
                onClick={handleNavigate}
              >
                Análises
              </NavItem>
              <NavItem
                to="/metas/alertas"
                icon={<Bell className="h-3.5 w-3.5" />}
                collapsed={isSidebarCollapsed}
                nested
                onClick={handleNavigate}
              >
                Alertas
              </NavItem>
            </div>
          </div>

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
            <button
              type="button"
              onClick={() => setIsConfigOpen((prev) => !prev)}
              aria-expanded={isConfigOpen}
              aria-controls="sidebar-config-submenu"
              className={`mb-1 flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2.5 py-2 text-xs font-semibold uppercase tracking-wide transition cursor-pointer ${
                isSidebarCollapsed ? 'justify-start lg:justify-center' : ''
              } ${
                isConfigRouteActive && !isConfigOpen
                  ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-text)]'
              }`}
              title="Configurações"
            >
              <span className="flex items-center gap-2">
                <Settings className="h-4 w-4 shrink-0" />
                <span className={isSidebarCollapsed ? 'inline lg:hidden' : 'inline'}>Configurações</span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                  isSidebarCollapsed ? 'inline lg:hidden' : 'inline'
                } ${isConfigOpen ? 'rotate-0' : '-rotate-90'}`}
              />
            </button>

            <div
              id="sidebar-config-submenu"
              hidden={!isConfigOpen}
              className="space-y-1"
            >
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
              <NavItem
                to="/configuracoes"
                icon={<Settings className="h-4 w-4" />}
                collapsed={isSidebarCollapsed}
                nested
                onClick={handleNavigate}
              >
                Outros
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
        <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)] sticky top-0 z-30">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] p-2 text-[var(--color-text)] lg:hidden"
                aria-label="Abrir menu"
              >
                <Menu className="h-4 w-4" />
              </button>
              <h1 className="text-lg font-semibold text-[var(--color-text)]">Maluki Organiza</h1>
            </div>
            
            <div className="flex items-center gap-2 lg:hidden">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-semibold text-white">
                {userInitial}
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Floating Action Button (FAB) for Quick Transaction Launch */}
      <button
        type="button"
        onClick={() => navigate('/transacoes?novo=true')}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-xl hover:bg-[var(--color-primary)]/90 transition-transform active:scale-95 lg:hidden"
        title="Nova Transação"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Bottom Navigation Bar for Mobile */}
      <nav aria-label="Menu móvel" className="fixed bottom-0 left-0 right-0 z-40 flex h-16 border-t border-[var(--color-border)] bg-[var(--color-surface)] lg:hidden shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <BottomTabItem to="/" icon={<Home className="h-5 w-5" />} label="Início" />
        <BottomTabItem to="/transacoes" icon={<Wallet className="h-5 w-5" />} label="Transações" />
        <BottomTabItem to="/metas" icon={<Target className="h-5 w-5" />} label="Metas" />
        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="flex flex-1 flex-col items-center justify-center text-[var(--color-muted)] active:text-[var(--color-primary)] transition-colors"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] mt-1 font-medium">Mais</span>
        </button>
      </nav>
    </div>
  )
}

function NavItem({
  to,
  children,
  icon,
  collapsed,
  nested,
  end,
  onClick,
}: {
  to: string
  children: ReactNode
  icon: ReactNode
  collapsed: boolean
  nested?: boolean
  end?: boolean
  onClick?: () => void
}) {
  return (
    <NavLink
      to={to}
      end={end ?? to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-sm transition ${nested ? 'pl-5' : ''} ${
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

function BottomTabItem({
  to,
  icon,
  label,
}: {
  to: string
  icon: ReactNode
  label: string
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center justify-center transition-colors ${
          isActive
            ? 'text-[var(--color-primary)] font-semibold'
            : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
        }`
      }
    >
      {icon}
      <span className="text-[10px] mt-1 font-medium">{label}</span>
    </NavLink>
  )
}
