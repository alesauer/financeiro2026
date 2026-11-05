import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  Bot,
  User,
  Send,
  Plus,
  Trash2,
  Sparkles,
  MessageSquare,
} from 'lucide-react'
import { iaService } from '../services/iaService'
import type { IaConversaItem, IaMensagem } from '../types'
import { getErrorMessage } from '@/shared/utils/error'

type IaAssistenteTabProps = {
  token?: string
}

const SUGESTOES_PERGUNTAS = [
  'Quanto gastei neste mês?',
  'Onde estou gastando mais?',
  'Quais são minhas maiores despesas?',
  'Como está a situação das minhas metas?',
  'Compare meus gastos com o mês passado',
  'Quais são minhas despesas fixas recorrentes?',
  'Quanto posso gastar até o fim do mês?',
]

export function IaAssistenteTab({ token }: IaAssistenteTabProps) {
  const [conversas, setConversas] = useState<IaConversaItem[]>([])
  const [conversaAtivaId, setConversaAtivaId] = useState<number | null>(null)
  const [mensagens, setMensagens] = useState<IaMensagem[]>([])
  const [inputTexto, setInputTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [sidebarAberta, setSidebarAberta] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [mensagens, enviando])

  // Carregar lista de conversas
  const carregarConversas = async (selecionarPrimeira = true) => {
    try {
      const res = await iaService.listConversas(token)
      setConversas(res.conversas)
      if (selecionarPrimeira && res.conversas.length > 0 && !conversaAtivaId) {
        setConversaAtivaId(res.conversas[0].id)
      } else if (res.conversas.length === 0) {
        // Se não houver conversas, cria a primeira automaticamente
        criarNovaConversa()
      }
    } catch (err) {
      setErro(getErrorMessage(err, 'Erro ao carregar conversas.'))
    }
  }

  useEffect(() => {
    carregarConversas()
  }, [token])

  // Carregar mensagens da conversa ativa
  useEffect(() => {
    if (!conversaAtivaId) {
      setMensagens([])
      return
    }

    async function carregarMensagens() {
      setErro(null)
      try {
        const res = await iaService.getConversa(conversaAtivaId!, token)
        setMensagens(res.mensagens)
      } catch (err) {
        setErro(getErrorMessage(err, 'Não foi possível carregar as mensagens.'))
      }
    }

    carregarMensagens()
  }, [conversaAtivaId, token])

  const criarNovaConversa = async () => {
    try {
      const nova = await iaService.createConversa('Nova conversa', token)
      setConversas((prev) => [nova, ...prev])
      setConversaAtivaId(nova.id)
      setMensagens([])
      setInputTexto('')
    } catch (err) {
      setErro(getErrorMessage(err, 'Erro ao criar nova conversa.'))
    }
  }

  const excluirConversa = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm('Deseja realmente excluir esta conversa?')) return

    try {
      await iaService.deleteConversa(id, token)
      const restantes = conversas.filter((c) => c.id !== id)
      setConversas(restantes)
      if (conversaAtivaId === id) {
        setConversaAtivaId(restantes[0]?.id ?? null)
        if (restantes.length === 0) {
          criarNovaConversa()
        }
      }
    } catch (err) {
      setErro(getErrorMessage(err, 'Erro ao excluir conversa.'))
    }
  }

  const handleEnviar = async (textoParaEnviar?: string) => {
    const texto = (textoParaEnviar || inputTexto).trim()
    if (!texto || enviando) return

    let idAlvo = conversaAtivaId
    if (!idAlvo) {
      try {
        const nova = await iaService.createConversa(texto.slice(0, 30), token)
        setConversas((prev) => [nova, ...prev])
        idAlvo = nova.id
        setConversaAtivaId(nova.id)
      } catch (err) {
        setErro(getErrorMessage(err, 'Erro ao iniciar conversa.'))
        return
      }
    }

    // Adiciona otimisticamente a mensagem do usuário na tela
    const msgTemporaria: IaMensagem = {
      id: Date.now(),
      role: 'user',
      conteudo: texto,
      created_at: new Date().toISOString(),
    }
    setMensagens((prev) => [...prev, msgTemporaria])
    setInputTexto('')
    setEnviando(true)
    setErro(null)

    try {
      const respostaIA = await iaService.sendMessage(idAlvo, texto, token)
      setMensagens((prev) => [...prev, respostaIA])
      // Atualiza lista de conversas para refletir o título automático
      carregarConversas(false)
    } catch (err) {
      setErro(getErrorMessage(err, 'Não foi possível obter a resposta do assistente.'))
    } finally {
      setEnviando(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEnviar()
    }
  }

  return (
    <div className="flex h-[720px] flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xs lg:flex-row">
      {/* Sidebar de Histórico de Conversas */}
      <aside
        className={`${
          sidebarAberta ? 'w-full lg:w-72' : 'hidden'
        } flex shrink-0 flex-col border-b border-[var(--color-border)] bg-slate-50/70 p-3 lg:border-b-0 lg:border-r`}
      >
        <div className="flex items-center justify-between pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
            Conversas
          </span>
          <button
            type="button"
            onClick={criarNovaConversa}
            className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-2.5 py-1 text-xs font-semibold text-white shadow-2xs transition hover:opacity-90 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nova</span>
          </button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto pr-1">
          {conversas.map((c) => {
            const isAtiva = c.id === conversaAtivaId
            return (
              <div
                key={c.id}
                onClick={() => setConversaAtivaId(c.id)}
                className={`group flex items-center justify-between rounded-[var(--radius-sm)] px-3 py-2.5 text-xs transition cursor-pointer ${
                  isAtiva
                    ? 'bg-emerald-600 font-semibold text-white shadow-2xs'
                    : 'text-[var(--color-text)] hover:bg-slate-200/60'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${isAtiva ? 'text-white' : 'text-[var(--color-muted)]'}`} />
                  <span className="truncate">{c.titulo}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => excluirConversa(c.id, e)}
                  title="Excluir conversa"
                  className={`opacity-0 transition group-hover:opacity-100 ${
                    isAtiva ? 'text-white hover:text-rose-200' : 'text-slate-400 hover:text-rose-600'
                  }`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </aside>

      {/* Área Central de Mensagens */}
      <main className="flex flex-1 flex-col overflow-hidden bg-[var(--color-surface)]">
        {/* Header do Chat */}
        <header className="flex h-13 items-center justify-between border-b border-[var(--color-border)] px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white shadow-2xs">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">
                Assistente Financeiro com IA
              </p>
              <p className="text-[11px] text-[var(--color-muted)]">
                Respostas baseadas nos lançamentos e contas reais do sistema
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarAberta((prev) => !prev)}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] lg:hidden"
          >
            {sidebarAberta ? 'Ocultar sessões' : 'Ver sessões'}
          </button>
        </header>

        {/* Mensagens */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {mensagens.length === 0 ? (
            <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-600 shadow-2xs">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-[var(--color-text)]">
                Como posso ajudar suas finanças hoje?
              </h3>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Faça perguntas em português sobre receitas, gastos por categoria, maiores despesas ou metas.
              </p>

              {/* Pills de Sugestão */}
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {SUGESTOES_PERGUNTAS.map((sugestao) => (
                  <button
                    key={sugestao}
                    type="button"
                    onClick={() => handleEnviar(sugestao)}
                    className="rounded-full border border-[var(--color-border)] bg-slate-50 px-3 py-1.5 text-xs text-slate-700 transition hover:border-[var(--color-primary)] hover:bg-teal-50 hover:text-teal-900 cursor-pointer"
                  >
                    {sugestao}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            mensagens.map((msg) => {
              const isUser = msg.role === 'user'
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold shadow-2xs ${
                      isUser
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-[var(--radius-md)] p-3.5 text-sm leading-relaxed shadow-2xs sm:max-w-[75%] ${
                      isUser
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'border border-[var(--color-border)] bg-slate-50/70 text-slate-800'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.conteudo}</div>
                  </div>
                </div>
              )
            })
          )}

          {enviando ? (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xs">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-slate-50 px-4 py-3 text-xs text-[var(--color-muted)] shadow-2xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 animate-spin text-[var(--color-primary)]" />
                  <span>Analisando lançamentos financeiros...</span>
                </div>
              </div>
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>

        {/* Barra de Sugestões Rápidas quando há mensagens */}
        {mensagens.length > 0 ? (
          <div className="border-t border-[var(--color-border)] bg-slate-50/50 px-4 py-2">
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              <span className="shrink-0 font-medium text-[var(--color-muted)]">Sugestões:</span>
              {SUGESTOES_PERGUNTAS.slice(0, 3).map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => handleEnviar(sug)}
                  disabled={enviando}
                  className="shrink-0 rounded-full border border-[var(--color-border)] bg-white px-2.5 py-0.5 text-[11px] text-slate-600 transition hover:border-[var(--color-primary)] hover:text-teal-800 cursor-pointer disabled:opacity-50"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Input e Envio */}
        <footer className="border-t border-[var(--color-border)] p-3 sm:p-4">
          {erro ? <p className="mb-2 text-xs text-rose-600">{erro}</p> : null}
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              handleEnviar()
            }}
            className="flex items-end gap-2"
          >
            <textarea
              rows={2}
              value={inputTexto}
              onChange={(e) => setInputTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua dúvida financeira (ex: quanto gastei com alimentação nos últimos 30 dias?)..."
              disabled={enviando}
              className="flex-1 resize-none rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
            />
            <button
              type="submit"
              disabled={!inputTexto.trim() || enviando}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-primary)] text-white shadow-2xs transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </footer>
      </main>
    </div>
  )
}
