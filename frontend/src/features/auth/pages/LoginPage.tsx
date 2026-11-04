import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthProvider'
import { Eye, EyeOff, Loader2, TrendingUp } from 'lucide-react'

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
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim() || !senha.trim()) {
      setError('Informe seu e-mail e senha de acesso.')
      return
    }

    setError(null)
    setInfoMessage(null)
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
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 font-sans">
      {/* ========================================================= */}
      {/* LADO ESQUERDO: PAINEL INSTITUCIONAL COM MARCA D'ÁGUA       */}
      {/* ========================================================= */}
      <div className="relative flex flex-col justify-center overflow-hidden bg-[#1e3a34] px-8 py-14 sm:px-16 lg:px-20 xl:px-28 text-white">
        {/* Marca d'água circular grande ao fundo (estilo emblema) */}
        <svg
          viewBox="0 0 600 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[115%] w-[115%] max-w-none text-white opacity-[0.06] select-none"
        >
          <circle cx="300" cy="300" r="270" stroke="currentColor" strokeWidth="14" />
          <circle cx="300" cy="300" r="235" stroke="currentColor" strokeWidth="4" />
          {/*Barras ascendentes e folha/gráfico estilizado ao centro*/}
          <path
            d="M170 390 L170 290 C170 280 178 272 188 272 L222 272 C232 272 240 280 240 290 L240 390 Z"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinejoin="round"
          />
          <path
            d="M265 390 L265 230 C265 220 273 212 283 212 L317 212 C327 212 335 220 335 230 L335 390 Z"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinejoin="round"
          />
          <path
            d="M360 390 L360 170 C360 160 368 152 378 152 L412 152 C422 152 430 160 430 170 L430 390 Z"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinejoin="round"
          />
          <path
            d="M145 425 L455 425"
            stroke="currentColor"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M165 235 Q260 155 415 115 M415 115 L375 112 M415 115 L408 154"
            stroke="currentColor"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Conteúdo centralizado na coluna esquerda */}
        <div className="relative z-10 mx-auto w-full max-w-md space-y-6">
          {/* Logo + Nome da Marca */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/10">
              <TrendingUp className="h-5 w-5 text-teal-200" />
            </div>
            <span className="text-xl sm:text-2xl font-serif tracking-wide text-white/95 uppercase">
              Maluki Organiza
            </span>
          </div>

          {/* Título Principal com destaque em caixa */}
          <h1 className="text-3xl sm:text-4xl font-normal tracking-tight text-white leading-tight">
            Que bom te ver{' '}
            <span className="inline-block bg-[#cfe3d4] px-2.5 py-0.5 font-semibold text-[#18312b]">
              de volta!
            </span>
          </h1>

          {/* Pílulas de benefícios (stacked) */}
          <div className="flex flex-col items-start gap-2.5 pt-1">
            <div className="inline-flex items-center gap-2.5 rounded-full bg-white/12 px-4 py-1.5 text-xs sm:text-sm text-white/90 backdrop-blur-xs">
              <span className="h-2 w-2 rounded-full bg-[#8ab89f]" />
              <span>Controle rápido, inteligente e sem burocracia</span>
            </div>
            <div className="inline-flex items-center gap-2.5 rounded-full bg-white/12 px-4 py-1.5 text-xs sm:text-sm text-white/90 backdrop-blur-xs">
              <span className="h-2 w-2 rounded-full bg-[#8ab89f]" />
              <span>Faturas, contas e patrimônio no seu painel</span>
            </div>
          </div>

          {/* Card escuro informativo inferior */}
          <div className="mt-4 rounded-2xl bg-black/35 p-5 sm:p-6 backdrop-blur-xs">
            <p className="text-xs sm:text-sm font-medium leading-relaxed text-white/95">
              Mais de 2.000 lançamentos sincronizados em 2026, com categorização inteligente, Open Finance e visão patrimonial completa.
            </p>
            <p className="mt-2.5 text-[11px] sm:text-xs text-white/65">
              Maluki Organiza — Controle de Contas, Cartões & Investimentos
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* LADO DIREITO: FUNDO CLARO COM CARD BRANCO CENTRALIZADO     */}
      {/* ========================================================= */}
      <div className="flex items-center justify-center bg-[#e8eae3] px-6 py-12 sm:px-12">
        <div className="w-full max-w-[400px] rounded-2xl bg-white p-8 sm:p-10 shadow-[0_8px_30px_ rgba(0,0,0,0.06)]">
          {/* Título do Card */}
          <h2 className="mb-6 text-xl font-semibold text-slate-800">
            Entrar
          </h2>

          {/* Alerta de Erro */}
          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          {/* Mensagem Informativa */}
          {infoMessage && (
            <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-xs font-medium text-teal-800">
              {infoMessage}
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                spellCheck={false}
                autoComplete="username"
                placeholder="Digite seu email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-[#2c5249] focus:outline-hidden focus:ring-2 focus:ring-[#2c5249]/20"
              />
            </div>

            {/* Campo Senha */}
            <div className="space-y-1.5">
              <label
                htmlFor="senha"
                className="block text-xs font-medium text-slate-700"
              >
                Senha
              </label>
              <div className="relative">
                <input
                  id="senha"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-3.5 pr-10 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-[#2c5249] focus:outline-hidden focus:ring-2 focus:ring-[#2c5249]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-700 transition"
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

            {/* Link Esqueceu sua senha? */}
            <div className="flex justify-end pt-0.5">
              <button
                type="button"
                onClick={() =>
                  setInfoMessage('Para redefinir sua senha, solicite ao administrador do sistema.')
                }
                className="text-xs font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900 transition cursor-pointer"
              >
                Esqueceu sua senha?
              </button>
            </div>

            {/* Botão Entrar */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-md bg-[#5c7c67] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs transition hover:bg-[#4b6855] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Entrando...</span>
                </>
              ) : (
                <span>Entrar</span>
              )}
            </button>
          </form>

          {/* Não tem uma conta? Cadastre-se */}
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() =>
                setInfoMessage('O cadastro de novos usuários é realizado pelo painel de Configurações > Usuários.')
              }
              className="text-xs font-medium text-slate-700 hover:text-slate-900 transition cursor-pointer"
            >
              Não tem uma conta? <span className="font-semibold">Cadastre-se</span>
            </button>
          </div>

          {/* Linha divisória + Rodapé de Suporte */}
          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            <p className="text-[11px] text-slate-700">
              Precisa de ajuda?{' '}
              <span className="text-slate-400">
                Entre em contato com o suporte
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
