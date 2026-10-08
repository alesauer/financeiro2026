import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthProvider'
import {
  Wallet,
  TrendingUp,
  Award,
  Sparkles,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  CheckCircle2,
  LockKeyhole,
} from 'lucide-react'

type LocationState = {
  from?: {
    pathname?: string
  }
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [lembrar, setLembrar] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim() || !senha.trim()) {
      setError('Informe seu e-mail e senha de acesso.')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      await login({ email: email.trim(), senha })
      const state = location.state as LocationState
      navigate(state?.from?.pathname || '/', { replace: true })
    } catch {
      setError('Credenciais incorretas ou usuário não encontrado. Verifique os dados e tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col lg:flex-row overflow-hidden bg-[#070B14] text-slate-100 font-sans">
      {/* Background Glowing Ambient Orbs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-teal-600/15 blur-[140px]" />
      <div className="pointer-events-none absolute top-1/2 -right-40 h-[550px] w-[550px] rounded-full bg-emerald-600/10 blur-[150px]" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[140px]" />

      {/* Grid Pattern Overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.4) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* ========================================================= */}
      {/* LEFT SIDE: SHOWCASE HERO & BRAND EXPERIENCE (Desktop) */}
      {/* ========================================================= */}
      <div className="relative z-10 flex flex-1 flex-col justify-between p-8 sm:p-12 lg:p-16 xl:p-20">
        {/* Brand Header */}
        <div>
          <div className="inline-flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-500 via-emerald-400 to-teal-200 p-0.5 shadow-lg shadow-teal-500/25">
              <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950">
                <Wallet className="h-6 w-6 text-teal-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                  Finanças<span className="text-teal-400">2026</span>
                </h1>
                <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-300">
                  AI Edition
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Gestão Patrimonial, Cartões & Inteligência Financeira
              </p>
            </div>
          </div>
        </div>

        {/* Hero Headline & Value Props */}
        <div className="my-10 max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs font-medium text-slate-300 backdrop-blur-md shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
            <span>Categorização automática por IA & Gestão de Milhas</span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl leading-[1.15]">
            A clareza definitiva para o seu{' '}
            <span className="bg-gradient-to-r from-teal-300 via-emerald-400 to-cyan-300 bg-clip-text text-transparent">
              patrimônio financeiro.
            </span>
          </h2>

          <p className="text-sm sm:text-base leading-relaxed text-slate-300">
            Controle receitas, despesas parceladas, vencimentos de faturas, cotações de milhas e carteiras de investimentos em uma única plataforma projetada para alta performance.
          </p>

          {/* Floating Showcase Cards */}
          <div className="grid grid-cols-1 gap-3.5 pt-4 sm:grid-cols-2">
            {/* Card 1: Patrimônio */}
            <div className="group rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-md transition hover:border-teal-500/40 hover:bg-slate-900/80 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Patrimônio Líquido</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-xl font-bold tracking-tight text-white">
                R$ 284.950,00
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                <span>+18,4% rentabilidade anual</span>
              </div>
            </div>

            {/* Card 2: Milhas & Benefícios */}
            <div className="group rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-md transition hover:border-amber-500/40 hover:bg-slate-900/80 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Milhas & Pontos</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                  <Award className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-xl font-bold tracking-tight text-white">
                480.000 <span className="text-xs font-normal text-slate-400">pts</span>
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
                <span>≈ R$ 9.600 economizados em viagens</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security / Trust Footer */}
        <div className="flex flex-wrap items-center gap-6 border-t border-slate-800/80 pt-6 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-400" />
            <span>Criptografia de Ponta a Ponta</span>
          </div>
          <div className="flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-emerald-400" />
            <span>Dados 100% Isolados e Privados</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* RIGHT SIDE: ULTRA-MODERN LOGIN CARD */}
      {/* ========================================================= */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md">
          <div className="relative rounded-2xl border border-slate-800/90 bg-slate-900/85 p-8 sm:p-10 shadow-2xl shadow-black/60 backdrop-blur-2xl">
            {/* Subtle Gradient Border Accent */}
            <div className="pointer-events-none absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-teal-400 to-transparent opacity-80" />

            {/* Form Header */}
            <div className="mb-6 space-y-2 text-left">
              <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Acesse sua conta
              </h3>
              <p className="text-xs sm:text-sm text-slate-400">
                Informe suas credenciais para entrar no seu painel.
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3.5 text-xs font-medium text-rose-300 backdrop-blur-md animate-in fade-in duration-200">
                {error}
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* E-mail Field */}
              <div className="space-y-1.5 text-left">
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
                >
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="seu.email@dominio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-950/70 py-2.5 pl-10 pr-3.5 text-sm text-white placeholder:text-slate-500 transition focus:border-teal-400 focus:bg-slate-950 focus:outline-hidden focus:ring-2 focus:ring-teal-400/25"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="senha"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
                  >
                    Senha
                  </label>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    id="senha"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="w-full rounded-xl border border-slate-700/80 bg-slate-950/70 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-slate-500 transition focus:border-teal-400 focus:bg-slate-950 focus:outline-hidden focus:ring-2 focus:ring-teal-400/25"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-2.5 rounded p-0.5 text-slate-400 hover:text-slate-200 transition"
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me Option */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={lembrar}
                    onChange={(e) => setLembrar(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-teal-500 focus:ring-teal-500/30"
                  />
                  <span>Lembrar meu acesso</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-teal-500/25 transition duration-200 hover:from-teal-400 hover:to-emerald-500 hover:shadow-teal-500/40 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            {/* Operational Status Pill */}
            <div className="mt-8 flex items-center justify-center gap-2 border-t border-slate-800/80 pt-5 text-[11px] font-medium text-slate-400">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Ambiente Seguro e Conectado</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
