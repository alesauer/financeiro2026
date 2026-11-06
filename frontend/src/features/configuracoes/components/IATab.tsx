import { useState, useEffect } from 'react'
import {
  Bot,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Zap,
  Sparkles,
  Server,
  Save,
  Check,
} from 'lucide-react'
import { configuracoesService } from '../services/configuracoesService'
import type { IAConfig, IATestarResponse } from '@/shared/types/configuracao'
import { getErrorMessage } from '@/shared/utils/error'

type Props = {
  token: string | null
}

export function IATab({ token }: Props) {
  const [config, setConfig] = useState<IAConfig>({
    provedor_ativo: 'deepseek',
    deepseek_api_key: '',
    deepseek_modelo: 'deepseek-chat',
    openai_api_key: '',
    openai_modelo: 'gpt-4o-mini',
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testandoProvedor, setTestandoProvedor] = useState<'deepseek' | 'openai' | null>(null)
  const [resultadoTeste, setResultadoTeste] = useState<{
    provedor: 'deepseek' | 'openai'
    resposta: IATestarResponse
  } | null>(null)

  const [showKeyDeepSeek, setShowKeyDeepSeek] = useState(false)
  const [showKeyOpenAI, setShowKeyOpenAI] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    if (!token) return
    carregarConfig()
  }, [token])

  const carregarConfig = async () => {
    if (!token) return
    setLoading(true)
    setFeedback(null)
    try {
      const data = await configuracoesService.getIAConfig(token)
      setConfig(data)
    } catch (err) {
      setFeedback({
        tipo: 'erro',
        texto: getErrorMessage(err, 'Não foi possível carregar as configurações de IA.'),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSalvar = async () => {
    if (!token) return
    setSaving(true)
    setFeedback(null)
    try {
      const res = await configuracoesService.saveIAConfig(token, config)
      setConfig(res)
      setFeedback({
        tipo: 'sucesso',
        texto: `Configurações de IA salvas com sucesso! O provedor ativo agora é ${res.provedor_ativo.toUpperCase()}.`,
      })
    } catch (err) {
      setFeedback({
        tipo: 'erro',
        texto: getErrorMessage(err, 'Erro ao salvar as configurações de IA.'),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTestar = async (provedor: 'deepseek' | 'openai') => {
    if (!token) return
    setTestandoProvedor(provedor)
    setResultadoTeste(null)
    setFeedback(null)

    const apiKey = provedor === 'deepseek' ? config.deepseek_api_key : config.openai_api_key
    const modelo = provedor === 'deepseek' ? config.deepseek_modelo : config.openai_modelo

    try {
      const res = await configuracoesService.testarIA(token, {
        provedor,
        api_key: apiKey,
        modelo,
      })
      setResultadoTeste({ provedor, resposta: res })
    } catch (err) {
      setResultadoTeste({
        provedor,
        resposta: {
          sucesso: false,
          mensagem: getErrorMessage(err, 'Falha ao conectar com o serviço de teste.'),
        },
      })
    } finally {
      setTestandoProvedor(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-[var(--color-muted)]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent mr-2" />
        Carregando configurações de IA...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Banner de Apresentação */}
      <div className="rounded-[var(--radius-md)] border border-sky-200 bg-sky-50/70 p-4 text-sky-900">
        <div className="flex items-start gap-3">
          <Bot className="h-6 w-6 shrink-0 text-sky-600 mt-0.5" />
          <div className="space-y-1 text-sm">
            <h3 className="font-semibold text-sky-950">Provedor e Chaves de Inteligência Artificial</h3>
            <p className="text-xs text-sky-800 leading-relaxed">
              O motor de IA é utilizado no <strong>Assistente Conversacional</strong>, na{' '}
              <strong>Previsão de Gastos</strong> e na <strong>Categorização Automática de Extratos</strong>.
              Você pode alternar a qualquer momento entre o <strong>DeepSeek</strong> (alta capacidade e custo reduzido)
              e a <strong>OpenAI</strong> (ChatGPT).
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border p-3 text-sm animate-in fade-in duration-200 ${
            feedback.tipo === 'sucesso'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.tipo === 'sucesso' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span>{feedback.texto}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="rounded p-1 hover:bg-black/5 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Seletor de Provedor Ativo */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs">
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-[var(--color-text)]">Provedor de IA em Uso</h4>
          <p className="text-xs text-[var(--color-muted)]">
            Selecione qual provedor será acionado para responder mensagens e gerar análises inteligentes no sistema.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Card Opção DeepSeek */}
          <div
            onClick={() => setConfig((prev) => ({ ...prev, provedor_ativo: 'deepseek' }))}
            className={`cursor-pointer rounded-[var(--radius-md)] border-2 p-4 transition ${
              config.provedor_ativo === 'deepseek'
                ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                : 'border-[var(--color-border)] bg-[var(--color-bg)]/40 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs">
                  DS
                </span>
                <span className="font-semibold text-sm text-[var(--color-text)]">DeepSeek</span>
              </div>
              {config.provedor_ativo === 'deepseek' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  <Check className="h-3 w-3" /> ATIVO
                </span>
              ) : (
                <span className="text-[11px] font-medium text-[var(--color-muted)]">Clique para ativar</span>
              )}
            </div>
            <p className="text-xs text-[var(--color-muted)] mb-2">
              Modelo ultrarrápido, compatível com function calling nativo e até 10x mais econômico por token.
            </p>
            <span className="inline-block rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              ⚡ Recomendado pelo SaaS
            </span>
          </div>

          {/* Card Opção OpenAI */}
          <div
            onClick={() => setConfig((prev) => ({ ...prev, provedor_ativo: 'openai' }))}
            className={`cursor-pointer rounded-[var(--radius-md)] border-2 p-4 transition ${
              config.provedor_ativo === 'openai'
                ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                : 'border-[var(--color-border)] bg-[var(--color-bg)]/40 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">
                  OA
                </span>
                <span className="font-semibold text-sm text-[var(--color-text)]">OpenAI</span>
              </div>
              {config.provedor_ativo === 'openai' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  <Check className="h-3 w-3" /> ATIVO
                </span>
              ) : (
                <span className="text-[11px] font-medium text-[var(--color-muted)]">Clique para ativar</span>
              )}
            </div>
            <p className="text-xs text-[var(--color-muted)] mb-2">
              Família GPT-4o e GPT-4o-mini com alta precisão contextual e amplo ecossistema.
            </p>
            <span className="inline-block rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              Padrão da Indústria
            </span>
          </div>
        </div>
      </div>

      {/* Card Configuração DeepSeek */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <h4 className="text-sm font-semibold text-[var(--color-text)]">Configuração DeepSeek</h4>
          </div>
          {config.provedor_ativo === 'deepseek' && (
            <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
              Provedor Principal
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Chave de API DeepSeek */}
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-semibold text-[var(--color-text)]">Chave de API (DeepSeek API Key)</label>
            <div className="relative">
              <input
                type={showKeyDeepSeek ? 'text' : 'password'}
                value={config.deepseek_api_key}
                onChange={(e) => setConfig((prev) => ({ ...prev, deepseek_api_key: e.target.value }))}
                placeholder="sk-..."
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 pr-10 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKeyDeepSeek((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title={showKeyDeepSeek ? 'Ocultar chave' : 'Exibir chave'}
              >
                {showKeyDeepSeek ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-[var(--color-muted)]">
              Chave obtida no console da DeepSeek (ex.: sk-cd088d64baf044bb881e54b5dddcf600).
            </p>
          </div>

          {/* Modelo DeepSeek */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-text)]">Modelo DeepSeek</label>
            <select
              value={config.deepseek_modelo}
              onChange={(e) => setConfig((prev) => ({ ...prev, deepseek_modelo: e.target.value }))}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <option value="deepseek-chat">deepseek-chat (Recomendado - V3 rápido e suporta ferramentas)</option>
              <option value="deepseek-reasoner">deepseek-reasoner (R1 - Raciocínio lógico detalhado)</option>
            </select>
          </div>

          {/* Botão Testar Conexão DeepSeek */}
          <div className="flex items-end">
            <button
              type="button"
              disabled={testandoProvedor === 'deepseek' || !config.deepseek_api_key}
              onClick={() => handleTestar('deepseek')}
              className="inline-flex h-9.5 items-center gap-1.5 rounded-[var(--radius-sm)] border border-indigo-300 bg-indigo-50 px-4 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              {testandoProvedor === 'deepseek' ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-700 border-t-transparent" />
                  Testando conexão...
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  Testar Chave DeepSeek
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feedback do Teste DeepSeek */}
        {resultadoTeste?.provedor === 'deepseek' && (
          <div
            className={`mt-4 rounded-[var(--radius-sm)] border p-3 text-xs ${
              resultadoTeste.resposta.sucesso
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {resultadoTeste.resposta.sucesso ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Conexão verificada com sucesso!</span>
                  {resultadoTeste.resposta.tempo_ms && (
                    <span className="text-[10px] text-emerald-700 font-normal">
                      (Tempo de resposta: {resultadoTeste.resposta.tempo_ms}ms)
                    </span>
                  )}
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  <span>Falha no teste de conexão:</span>
                </>
              )}
            </div>
            <p className="mt-1 pl-6 text-[11px] opacity-90">{resultadoTeste.resposta.mensagem}</p>
          </div>
        )}
      </div>

      {/* Card Configuração OpenAI */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-emerald-600" />
            <h4 className="text-sm font-semibold text-[var(--color-text)]">Configuração OpenAI</h4>
          </div>
          {config.provedor_ativo === 'openai' && (
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              Provedor Principal
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Chave de API OpenAI */}
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-semibold text-[var(--color-text)]">Chave de API (OpenAI API Key)</label>
            <div className="relative">
              <input
                type={showKeyOpenAI ? 'text' : 'password'}
                value={config.openai_api_key}
                onChange={(e) => setConfig((prev) => ({ ...prev, openai_api_key: e.target.value }))}
                placeholder="sk-proj-..."
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 pr-10 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKeyOpenAI((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title={showKeyOpenAI ? 'Ocultar chave' : 'Exibir chave'}
              >
                {showKeyOpenAI ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-[var(--color-muted)]">
              Chave obtida no painel da OpenAI (platform.openai.com/api-keys).
            </p>
          </div>

          {/* Modelo OpenAI */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-text)]">Modelo OpenAI</label>
            <select
              value={config.openai_modelo}
              onChange={(e) => setConfig((prev) => ({ ...prev, openai_modelo: e.target.value }))}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <option value="gpt-4o-mini">gpt-4o-mini (Recomendado - Inteligente e econômico)</option>
              <option value="gpt-4o">gpt-4o (Modelo mais avançado da OpenAI)</option>
            </select>
          </div>

          {/* Botão Testar Conexão OpenAI */}
          <div className="flex items-end">
            <button
              type="button"
              disabled={testandoProvedor === 'openai' || !config.openai_api_key}
              onClick={() => handleTestar('openai')}
              className="inline-flex h-9.5 items-center gap-1.5 rounded-[var(--radius-sm)] border border-emerald-300 bg-emerald-50 px-4 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              {testandoProvedor === 'openai' ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
                  Testando conexão...
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  Testar Chave OpenAI
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feedback do Teste OpenAI */}
        {resultadoTeste?.provedor === 'openai' && (
          <div
            className={`mt-4 rounded-[var(--radius-sm)] border p-3 text-xs ${
              resultadoTeste.resposta.sucesso
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {resultadoTeste.resposta.sucesso ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Conexão verificada com sucesso!</span>
                  {resultadoTeste.resposta.tempo_ms && (
                    <span className="text-[10px] text-emerald-700 font-normal">
                      (Tempo de resposta: {resultadoTeste.resposta.tempo_ms}ms)
                    </span>
                  )}
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  <span>Falha no teste de conexão:</span>
                </>
              )}
            </div>
            <p className="mt-1 pl-6 text-[11px] opacity-90">{resultadoTeste.resposta.mensagem}</p>
          </div>
        )}
      </div>

      {/* Botão Salvar Todas as Configurações */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          disabled={saving}
          onClick={handleSalvar}
          className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50 cursor-pointer"
        >
          {saving ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Salvando alterações...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Salvar Configurações de IA</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

