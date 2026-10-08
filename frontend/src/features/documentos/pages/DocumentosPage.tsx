import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/app/providers/AuthProvider'
import {
  FileText,
  Search,
  Plus,
  Layers,
  LayoutGrid,
  Star,
  Download,
  Trash2,
  Edit3,
  Calendar,
  Building2,
  Tag,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  X,
  Upload,
  HeartPulse,
  IdCard,
  Car,
  Home,
  ShieldCheck,
  Award,
  Receipt,
  Briefcase,
  FileCheck,
  Maximize2,
  FolderOpen,
  Stethoscope,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { documentosService } from '../services/documentosService'
import type { Documento, TipoDocumento, DocumentoAnexo, DocumentoPayload } from '@/shared/types/documento'

// Color Palettes for Apple Wallet Passes - Styled for System Light Theme
const WALLET_PALETTES = [
  {
    id: 'sapphire',
    name: 'Teal & Safira (ID)',
    headerBg: 'bg-gradient-to-r from-teal-600 to-cyan-700',
    accentColor: '#0d9488',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  {
    id: 'emerald',
    name: 'Esmeralda (Saúde & Laudos)',
    headerBg: 'bg-gradient-to-r from-emerald-600 to-teal-700',
    accentColor: '#059669',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: 'amber',
    name: 'Âmbar (Veículos)',
    headerBg: 'bg-gradient-to-r from-amber-500 to-orange-600',
    accentColor: '#d97706',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    id: 'violet',
    name: 'Índigo (Contratos)',
    headerBg: 'bg-gradient-to-r from-indigo-600 to-purple-700',
    accentColor: '#4f46e5',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    id: 'rose',
    name: 'Rubi (Garantias)',
    headerBg: 'bg-gradient-to-r from-rose-500 to-pink-600',
    accentColor: '#e11d48',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    id: 'cyan',
    name: 'Ciano (Seguros)',
    headerBg: 'bg-gradient-to-r from-sky-500 to-blue-600',
    accentColor: '#0284c7',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  {
    id: 'gold',
    name: 'Dourado (Certificados)',
    headerBg: 'bg-gradient-to-r from-yellow-500 to-amber-600',
    accentColor: '#ca8a04',
    badgeClass: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  },
  {
    id: 'slate',
    name: 'Titânio (Profissional)',
    headerBg: 'bg-gradient-to-r from-slate-600 to-zinc-700',
    accentColor: '#475569',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  {
    id: 'obsidian',
    name: 'Grafite Executivo',
    headerBg: 'bg-gradient-to-r from-zinc-800 to-slate-900',
    accentColor: '#18181b',
    badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-300',
  },
]

const ICON_MAP: Record<string, typeof FileText> = {
  IdCard,
  HeartPulse,
  Car,
  Home,
  ShieldCheck,
  Receipt,
  Award,
  Briefcase,
  FileCheck,
  Stethoscope,
  FileText,
}

function getIconComponent(iconName?: string | null) {
  if (!iconName) return FileText
  return ICON_MAP[iconName] || FileText
}

function getPalette(corPass?: string | null) {
  if (!corPass) return WALLET_PALETTES[0]
  const found = WALLET_PALETTES.find((p) => p.id === corPass)
  return found || WALLET_PALETTES[0]
}

export function DocumentosPage() {
  const { token } = useAuth()
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [tipos, setTipos] = useState<TipoDocumento[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTipoId, setSelectedTipoId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'favoritos' | 'validos' | 'expirando' | 'expirados'>('all')
  const [viewMode, setViewMode] = useState<'stack' | 'grid'>('stack')

  // Modals & Active Document
  const [inspectedDoc, setInspectedDoc] = useState<Documento | null>(null)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<Documento | null>(null)
  const [lightboxAnexo, setLightboxAnexo] = useState<{ url: string; nome: string; mime: string } | null>(null)

  // Copy feedback
  const [copiedId, setCopiedId] = useState<number | null>(null)

  // Form State
  const [formData, setFormData] = useState<DocumentoPayload>({
    tipo_documento_id: 1,
    nome: '',
    registro: '',
    emissor: '',
    titular: '',
    data_emissao: '',
    data_validade: '',
    cor_pass: 'sapphire',
    icone: 'IdCard',
    favorito: false,
    tags: '',
    outras_informacoes: '',
  })
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadingAnexos, setUploadingAnexos] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inspectorFileInputRef = useRef<HTMLInputElement>(null)

  // Load Data
  const fetchData = async () => {
    if (!token) return
    try {
      setIsLoading(true)
      const [docsRes, tiposRes] = await Promise.all([
        documentosService.list(token, { perPage: 100 }),
        documentosService.tipos(token),
      ])
      setDocumentos(docsRes.items)
      setTipos(tiposRes)
      if (tiposRes.length > 0 && !editingDoc) {
        setFormData((prev) => ({ ...prev, tipo_documento_id: tiposRes[0].id }))
      }
    } catch (err) {
      console.error('Erro ao buscar documentos:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [token])

  // Filtered Documents
  const filteredDocs = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const thirtyDaysAhead = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

    return documentos.filter((doc) => {
      // Category filter
      if (selectedTipoId !== null && doc.tipo_documento_id !== selectedTipoId) {
        return false
      }

      // Status filter
      if (statusFilter === 'favoritos' && !doc.favorito) return false
      if (doc.data_validade) {
        const valDate = new Date(doc.data_validade + 'T00:00:00')
        if (statusFilter === 'validos' && valDate < today) return false
        if (statusFilter === 'expirando' && (valDate < today || valDate > thirtyDaysAhead)) return false
        if (statusFilter === 'expirados' && valDate >= today) return false
      } else {
        if (statusFilter === 'expirando' || statusFilter === 'expirados') return false
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = doc.nome.toLowerCase().includes(q)
        const matchReg = doc.registro?.toLowerCase().includes(q) || false
        const matchEmissor = doc.emissor?.toLowerCase().includes(q) || false
        const matchTitular = doc.titular?.toLowerCase().includes(q) || false
        const matchTags = doc.tags?.toLowerCase().includes(q) || false
        const matchInfo = doc.outras_informacoes?.toLowerCase().includes(q) || false
        const matchTipo = doc.tipo_documento_nome?.toLowerCase().includes(q) || false
        return matchName || matchReg || matchEmissor || matchTitular || matchTags || matchInfo || matchTipo
      }

      return true
    })
  }, [documentos, selectedTipoId, statusFilter, searchQuery])

  // KPIs
  const kpis = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

    let total = documentos.length
    let laudos = 0
    let expirando = 0
    let totalAnexos = 0

    documentos.forEach((d) => {
      if (d.tipo_documento_nome?.toLowerCase().includes('saúde') || d.tipo_documento_nome?.toLowerCase().includes('laudo')) {
        laudos++
      }
      if (d.data_validade) {
        const val = new Date(d.data_validade + 'T00:00:00')
        if (val >= today && val <= thirtyDays) expirando++
      }
      totalAnexos += d.anexos?.length || 0
    })

    return { total, laudos, expirando, totalAnexos }
  }, [documentos])

  // Actions
  const handleCopyRegistro = (reg: string, id: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    navigator.clipboard.writeText(reg)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleToggleFavorito = async (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!token) return
    try {
      const updated = await documentosService.toggleFavorito(token, id)
      setDocumentos((prev) => prev.map((d) => (d.id === id ? { ...d, favorito: updated.favorito } : d)))
      if (inspectedDoc?.id === id) {
        setInspectedDoc((prev) => (prev ? { ...prev, favorito: updated.favorito } : null))
      }
    } catch (err) {
      console.error('Erro ao alternar favorito:', err)
    }
  }

  const handleDeleteDoc = async (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!token || !confirm('Confirma a exclusão deste passe da carteira?')) return
    try {
      await documentosService.remove(token, id)
      setDocumentos((prev) => prev.filter((d) => d.id !== id))
      if (inspectedDoc?.id === id) setInspectedDoc(null)
    } catch (err) {
      console.error('Erro ao excluir documento:', err)
    }
  }

  const handleOpenCreateModal = () => {
    setEditingDoc(null)
    setFormData({
      tipo_documento_id: tipos[0]?.id || 1,
      nome: '',
      registro: '',
      emissor: '',
      titular: '',
      data_emissao: '',
      data_validade: '',
      cor_pass: 'sapphire',
      icone: 'IdCard',
      favorito: false,
      tags: '',
      outras_informacoes: '',
    })
    setPendingFiles([])
    setIsFormModalOpen(true)
  }

  const handleOpenEditModal = (doc: Documento, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingDoc(doc)
    setFormData({
      tipo_documento_id: doc.tipo_documento_id,
      nome: doc.nome,
      registro: doc.registro || '',
      emissor: doc.emissor || '',
      titular: doc.titular || '',
      data_emissao: doc.data_emissao || '',
      data_validade: doc.data_validade || '',
      cor_pass: doc.cor_pass || 'sapphire',
      icone: doc.icone || 'IdCard',
      favorito: doc.favorito || false,
      tags: doc.tags || '',
      outras_informacoes: doc.outras_informacoes || '',
    })
    setPendingFiles([])
    setIsFormModalOpen(true)
  }

  const handleSaveDocumento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !formData.nome.trim()) return

    try {
      setIsSubmitting(true)
      let savedDoc: Documento
      if (editingDoc) {
        savedDoc = await documentosService.update(token, editingDoc.id, formData)
      } else {
        savedDoc = await documentosService.create(token, formData)
      }

      // Upload pending files
      if (pendingFiles.length > 0) {
        const anexos = await documentosService.uploadAnexos(token, savedDoc.id, pendingFiles)
        savedDoc.anexos = anexos
      }

      await fetchData()
      setIsFormModalOpen(false)
      if (inspectedDoc?.id === savedDoc.id) {
        setInspectedDoc(savedDoc)
      }
    } catch (err) {
      console.error('Erro ao salvar passe:', err)
      alert('Erro ao salvar documento. Verifique os campos.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInspectorUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!token || !inspectedDoc || !e.target.files?.length) return
    const files = Array.from(e.target.files)
    try {
      setUploadingAnexos(true)
      const newAnexos = await documentosService.uploadAnexos(token, inspectedDoc.id, files)
      const updatedDoc = {
        ...inspectedDoc,
        anexos: [...(inspectedDoc.anexos || []), ...newAnexos],
      }
      setInspectedDoc(updatedDoc)
      setDocumentos((prev) => prev.map((d) => (d.id === inspectedDoc.id ? updatedDoc : d)))
    } catch (err) {
      console.error('Erro ao enviar arquivos:', err)
      alert('Erro ao anexar arquivos.')
    } finally {
      setUploadingAnexos(false)
      if (inspectorFileInputRef.current) inspectorFileInputRef.current.value = ''
    }
  }

  const handleDeleteAnexo = async (anexoId: number) => {
    if (!token || !inspectedDoc || !confirm('Excluir este arquivo?')) return
    try {
      await documentosService.deleteAnexo(token, inspectedDoc.id, anexoId)
      const updatedAnexos = (inspectedDoc.anexos || []).filter((a) => a.id !== anexoId)
      const updatedDoc = { ...inspectedDoc, anexos: updatedAnexos }
      setInspectedDoc(updatedDoc)
      setDocumentos((prev) => prev.map((d) => (d.id === inspectedDoc.id ? updatedDoc : d)))
    } catch (err) {
      console.error('Erro ao remover anexo:', err)
    }
  }

  const handlePreviewAnexo = async (anexo: DocumentoAnexo) => {
    if (!token || !inspectedDoc) return
    try {
      const blobUrl = await documentosService.getAnexoBlob(token, inspectedDoc.id, anexo.id)
      setLightboxAnexo({
        url: blobUrl,
        nome: anexo.original_name,
        mime: anexo.mime_type,
      })
    } catch (err) {
      console.error('Erro ao abrir preview:', err)
      alert('Não foi possível carregar o anexo para visualização.')
    }
  }

  // Status Badge Calculation
  const getPassStatus = (dataValidade?: string | null) => {
    if (!dataValidade) {
      return {
        label: 'Permanente',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: CheckCircle2,
      }
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const val = new Date(dataValidade + 'T00:00:00')
    const diffDays = Math.ceil((val.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return {
        label: `Vencido (${Math.abs(diffDays)}d)`,
        badge: 'bg-rose-50 text-rose-700 border-rose-200',
        icon: AlertTriangle,
      }
    }
    if (diffDays <= 30) {
      return {
        label: `Vence em ${diffDays}d`,
        badge: 'bg-amber-50 text-amber-700 border-amber-200 font-semibold',
        icon: Clock,
      }
    }
    return {
      label: `Válido até ${val.toLocaleDateString('pt-BR')}`,
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: CheckCircle2,
    }
  }

  return (
    <section className="space-y-6 pb-12">
      {/* 1. Header do Módulo (Padrão do Sistema) */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
              Documentos & Laudos
            </h2>
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-text)] shadow-2xs">
              {kpis.total} passes
            </span>
            {kpis.expirando > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white shadow-2xs">
                {kpis.expirando} vencendo
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            Organize RG, CNH, laudos médicos, passaportes, exames e certificados com visualização em passes digitais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Alternador de Visualização: Pilha Wallet vs Grade */}
          <div className="flex rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('stack')}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 transition ${
                viewMode === 'stack'
                  ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
              title="Pilha Estilo Apple Wallet"
            >
              <Layers className="h-3.5 w-3.5 text-[var(--color-primary)]" />
              Pilha Wallet
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 transition ${
                viewMode === 'grid'
                  ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
              title="Visualização em Grade"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Grade
            </button>
          </div>

          {/* Botão Principal de Adicionar */}
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Adicionar Passe
          </button>
        </div>
      </header>

      {/* 2. KPIs de Visão Geral (Padrão do Sistema) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total de Passes */}
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Total de Passes
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-bg)] text-[var(--color-primary)]">
              <IdCard className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold tracking-tight text-[var(--color-text)]">{kpis.total}</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">Documentos e registros salvos</p>
          </div>
        </div>

        {/* Laudos & Saúde */}
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Saúde & Laudos
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <HeartPulse className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold tracking-tight text-emerald-600">{kpis.laudos}</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">Exames e relatórios clínicos</p>
          </div>
        </div>

        {/* Vencendo em Breve */}
        <div
          className={`rounded-[var(--radius-md)] border p-4 shadow-xs ${
            kpis.expirando > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-[var(--color-border)] bg-[var(--color-surface)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Vencendo (&lt;30d)
            </span>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                kpis.expirando > 0 ? 'bg-amber-100 text-amber-700' : 'bg-[var(--color-bg)] text-[var(--color-muted)]'
              }`}
            >
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2">
            <p className={`text-2xl font-bold tracking-tight ${kpis.expirando > 0 ? 'text-amber-600' : 'text-[var(--color-text)]'}`}>
              {kpis.expirando}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {kpis.expirando > 0 ? 'Requer renovação em breve' : 'Nenhum passe prestes a vencer'}
            </p>
          </div>
        </div>

        {/* Arquivos no Cofre */}
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Arquivos & Anexos
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-bg)] text-indigo-600">
              <FolderOpen className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold tracking-tight text-[var(--color-text)]">{kpis.totalAnexos}</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">PDFs e imagens anexados</p>
          </div>
        </div>
      </div>

      {/* 3. Toolbar de Filtros e Categorias */}
      <div className="space-y-3 border-b border-[var(--color-border)] pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Busca */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--color-muted)]" />
            <input
              type="text"
              placeholder="Buscar por nome, registro, titular, laboratório..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-8 pr-7 text-xs text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-[var(--color-muted)] hover:text-[var(--color-text)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filtro de Status */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'favoritos', label: '⭐ Favoritos' },
              { id: 'validos', label: '🟢 Válidos' },
              { id: 'expirando', label: '🟡 Vencendo (<30d)' },
              { id: 'expirados', label: '🔴 Expirados' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id as any)}
                className={`rounded-[var(--radius-sm)] px-3 py-1.5 transition ${
                  statusFilter === f.id
                    ? 'bg-[var(--color-surface)] text-[var(--color-primary)] border border-[var(--color-border)] shadow-xs font-bold'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Categorias Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedTipoId(null)}
            className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
              selectedTipoId === null
                ? 'border-[var(--color-primary)] bg-teal-50/70 text-[var(--color-primary)] shadow-2xs'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Todas as Categorias
            <span className="ml-0.5 rounded-full bg-[var(--color-bg)] px-1.5 py-0.2 text-[10px] text-[var(--color-muted)]">
              {documentos.length}
            </span>
          </button>

          {tipos.map((tipo) => {
            const IconComp = getIconComponent(tipo.icone)
            const count = documentos.filter((d) => d.tipo_documento_id === tipo.id).length
            const isSelected = selectedTipoId === tipo.id

            return (
              <button
                key={tipo.id}
                type="button"
                onClick={() => setSelectedTipoId(isSelected ? null : tipo.id)}
                className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                  isSelected
                    ? 'border-[var(--color-primary)] bg-teal-50/70 text-[var(--color-primary)] shadow-2xs'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                <IconComp className="h-3.5 w-3.5" />
                {tipo.nome}
                <span className="ml-0.5 rounded-full bg-[var(--color-bg)] px-1.5 py-0.2 text-[10px] text-[var(--color-muted)]">
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Estado Vazio */}
      {filteredDocs.length === 0 && !isLoading && (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center max-w-md mx-auto space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg)] text-[var(--color-muted)]">
            <IdCard className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-[var(--color-text)]">Nenhum passe encontrado</h3>
          <p className="text-xs text-[var(--color-muted)]">
            {searchQuery || selectedTipoId || statusFilter !== 'all'
              ? 'Nenhum documento corresponde aos filtros selecionados.'
              : 'Sua carteira de documentos e laudos está vazia. Adicione o seu primeiro passe agora.'}
          </p>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            Criar Passe
          </button>
        </div>
      )}

      {/* 4. VISUALIZAÇÃO EM PILHA WALLET (Stack Mode com Cores e Padrões do Sistema) */}
      {viewMode === 'stack' && filteredDocs.length > 0 && (
        <div className="py-4 max-w-2xl mx-auto">
          <div className="space-y-[-110px] sm:space-y-[-125px] pt-2 pb-40">
            {filteredDocs.map((doc, index) => {
              const IconComp = getIconComponent(doc.icone || doc.tipo_documento_icone)
              const palette = getPalette(doc.cor_pass)
              const status = getPassStatus(doc.data_validade)
              const StatusIcon = status.icon

              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 25 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.03 }}
                  style={{ zIndex: index + 1 }}
                  whileHover={{ y: -25, zIndex: 40 }}
                  onClick={() => setInspectedDoc(doc)}
                  className="relative cursor-pointer transition-all duration-200 transform-gpu group"
                >
                  {/* Card Pass */}
                  <div className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-md hover:shadow-xl transition-shadow overflow-hidden relative">
                    {/* Top Header Strip / Gradient */}
                    <div className={`${palette.headerBg} p-4 sm:p-5 text-white relative`}>
                      {/* Recortes Laterais de Passe Wallet */}
                      <div className="absolute -left-2.5 bottom-0 translate-y-1/2 h-5 w-5 rounded-full bg-[var(--color-bg)] border-r border-[var(--color-border)]" />
                      <div className="absolute -right-2.5 bottom-0 translate-y-1/2 h-5 w-5 rounded-full bg-[var(--color-bg)] border-l border-[var(--color-border)]" />

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs border border-white/30 shadow-xs">
                            <IconComp className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/80">
                              {doc.tipo_documento_nome || 'Documento'}
                            </span>
                            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
                              {doc.nome}
                            </h3>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorito(doc.id, e)}
                          className="rounded-lg bg-black/15 p-2 text-white/90 hover:bg-black/25 hover:text-amber-300 transition-colors"
                          title={doc.favorito ? 'Remover dos favoritos' : 'Favoritar'}
                        >
                          <Star className={`h-4 w-4 ${doc.favorito ? 'fill-amber-300 text-amber-300' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Card Content Body */}
                    <div className="p-4 sm:p-5 space-y-3 bg-[var(--color-surface)]">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        {doc.titular && (
                          <div>
                            <span className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wider block">
                              Titular
                            </span>
                            <span className="font-semibold text-[var(--color-text)] truncate block">
                              {doc.titular}
                            </span>
                          </div>
                        )}

                        {doc.registro && (
                          <div>
                            <span className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wider block">
                              Registro
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="font-mono font-bold text-[var(--color-text)]">
                                {doc.registro}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleCopyRegistro(doc.registro!, doc.id, e)}
                                className="text-[var(--color-muted)] hover:text-[var(--color-text)]"
                                title="Copiar"
                              >
                                {copiedId === doc.id ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="col-span-2 sm:col-span-1">
                          <span className="text-[10px] font-semibold text-[var(--color-muted)] uppercase tracking-wider block">
                            Situação
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${status.badge}`}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
                        </div>
                      </div>

                      {/* Card Bottom: Emissor + Anexos + Código de Barras Decorativo */}
                      <div className="pt-2.5 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-muted)]">
                        <div className="flex items-center gap-3">
                          {doc.emissor && (
                            <span className="flex items-center gap-1 font-medium text-[var(--color-text)]">
                              <Building2 className="h-3.5 w-3.5 text-[var(--color-muted)]" />
                              {doc.emissor}
                            </span>
                          )}
                          {doc.anexos && doc.anexos.length > 0 && (
                            <span className="inline-flex items-center gap-1 rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-text)] border border-[var(--color-border)]">
                              <Paperclip className="h-3 w-3 text-[var(--color-primary)]" />
                              {doc.anexos.length} anexo{doc.anexos.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        {/* Barcode Graphic */}
                        <div className="flex items-center gap-0.5 text-slate-300">
                          <div className="h-3.5 w-1 bg-slate-400 rounded-full" />
                          <div className="h-3.5 w-0.5 bg-slate-300 rounded-full" />
                          <div className="h-3.5 w-1.5 bg-slate-400 rounded-full" />
                          <div className="h-3.5 w-0.5 bg-slate-300 rounded-full" />
                          <div className="h-3.5 w-2 bg-slate-500 rounded-full" />
                          <div className="h-3.5 w-1 bg-slate-400 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* 5. VISUALIZAÇÃO EM GRADE (Grid Mode) */}
      {viewMode === 'grid' && filteredDocs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc, index) => {
            const IconComp = getIconComponent(doc.icone || doc.tipo_documento_icone)
            const palette = getPalette(doc.cor_pass)
            const status = getPassStatus(doc.data_validade)
            const StatusIcon = status.icon

            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: index * 0.02 }}
                onClick={() => setInspectedDoc(doc)}
                className="cursor-pointer rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs hover:shadow-md hover:border-teal-400 transition-all overflow-hidden flex flex-col justify-between"
              >
                {/* Header Strip */}
                <div className={`${palette.headerBg} p-4 text-white relative`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 border border-white/30">
                        <IconComp className="h-4.5 w-4.5 text-white" />
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/80 block">
                          {doc.tipo_documento_nome || 'Passe'}
                        </span>
                        <h4 className="text-sm font-bold text-white truncate max-w-[170px]">
                          {doc.nome}
                        </h4>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleToggleFavorito(doc.id, e)}
                      className="rounded-lg bg-black/15 p-1.5 text-white/90 hover:bg-black/25 transition"
                    >
                      <Star className={`h-3.5 w-3.5 ${doc.favorito ? 'fill-amber-300 text-amber-300' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 space-y-2.5 text-xs">
                  {doc.titular && (
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--color-muted)]">Titular:</span>
                      <span className="font-semibold text-[var(--color-text)] truncate max-w-[150px]">{doc.titular}</span>
                    </div>
                  )}
                  {doc.registro && (
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--color-muted)]">Registro:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold text-[var(--color-text)]">{doc.registro}</span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyRegistro(doc.registro!, doc.id, e)}
                          className="text-[var(--color-muted)] hover:text-[var(--color-text)]"
                        >
                          {copiedId === doc.id ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  {doc.emissor && (
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--color-muted)]">Emissor:</span>
                      <span className="font-medium text-[var(--color-text)] truncate max-w-[150px]">{doc.emissor}</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg)]/50 flex items-center justify-between text-xs">
                  <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${status.badge}`}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </span>

                  {doc.anexos && doc.anexos.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-muted)]">
                      <Paperclip className="h-3 w-3 text-[var(--color-primary)]" />
                      {doc.anexos.length}
                    </span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* MODAL 1: DETALHES DO PASSE E COFRE DE ANEXOS */}
      <AnimatePresence>
        {inspectedDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] w-full max-w-2xl shadow-xl overflow-hidden my-6"
            >
              {(() => {
                const IconComp = getIconComponent(inspectedDoc.icone || inspectedDoc.tipo_documento_icone)
                const palette = getPalette(inspectedDoc.cor_pass)
                const status = getPassStatus(inspectedDoc.data_validade)
                const StatusIcon = status.icon

                return (
                  <div className={`${palette.headerBg} p-6 text-white relative`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 border border-white/30 shadow-xs">
                          <IconComp className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <span className="text-xs font-extrabold uppercase tracking-widest text-white/80">
                            {inspectedDoc.tipo_documento_nome || 'Passe Digital'}
                          </span>
                          <h2 className="text-xl sm:text-2xl font-bold text-white">{inspectedDoc.nome}</h2>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorito(inspectedDoc.id, e)}
                          className="p-2 rounded-lg bg-black/15 hover:bg-black/25 text-white transition"
                        >
                          <Star className={`h-4.5 w-4.5 ${inspectedDoc.favorito ? 'fill-amber-300 text-amber-300' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setInspectedDoc(null)}
                          className="p-2 rounded-lg bg-black/15 hover:bg-black/25 text-white transition"
                        >
                          <X className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-white/20 text-xs text-white">
                      {inspectedDoc.titular && (
                        <div>
                          <span className="text-[10px] font-semibold text-white/70 uppercase tracking-wider block">Titular</span>
                          <p className="font-bold text-sm truncate">{inspectedDoc.titular}</p>
                        </div>
                      )}
                      {inspectedDoc.registro && (
                        <div>
                          <span className="text-[10px] font-semibold text-white/70 uppercase tracking-wider block">Registro</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-sm">{inspectedDoc.registro}</span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyRegistro(inspectedDoc.registro!, inspectedDoc.id, e)}
                              className="text-white/80 hover:text-white"
                            >
                              {copiedId === inspectedDoc.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-300" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                      <div>
                        <span className="text-[10px] font-semibold text-white/70 uppercase tracking-wider block">Situação</span>
                        <div className="mt-0.5">
                          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${status.badge}`}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Informações detalhadas */}
              <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
                {/* Meta details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-[var(--color-bg)] p-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)] text-xs">
                  {inspectedDoc.emissor && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-[var(--color-primary)]" />
                      <div>
                        <span className="text-[var(--color-muted)]">Órgão Emissor / Laboratório:</span>
                        <p className="font-semibold text-[var(--color-text)]">{inspectedDoc.emissor}</p>
                      </div>
                    </div>
                  )}
                  {inspectedDoc.data_emissao && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-indigo-500" />
                      <div>
                        <span className="text-[var(--color-muted)]">Data de Emissão:</span>
                        <p className="font-semibold text-[var(--color-text)]">
                          {new Date(inspectedDoc.data_emissao + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  )}
                  {inspectedDoc.tags && (
                    <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                      <Tag className="h-4 w-4 text-pink-500" />
                      <div>
                        <span className="text-[var(--color-muted)]">Tags:</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {inspectedDoc.tags.split(',').map((t, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-[11px] font-medium"
                            >
                              #{t.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Observações / Laudo */}
                {inspectedDoc.outras_informacoes && (
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
                      <Stethoscope className="h-4 w-4" />
                      Observações Clínicas / Dados do Laudo
                    </div>
                    <p className="text-xs text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">
                      {inspectedDoc.outras_informacoes}
                    </p>
                  </div>
                )}

                {/* Anexos */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text)]">
                      <Paperclip className="h-4 w-4 text-[var(--color-primary)]" />
                      Anexos ({inspectedDoc.anexos?.length || 0})
                    </div>

                    <div>
                      <input
                        type="file"
                        multiple
                        ref={inspectorFileInputRef}
                        onChange={handleInspectorUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => inspectorFileInputRef.current?.click()}
                        disabled={uploadingAnexos}
                        className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text)] shadow-xs transition hover:bg-[var(--color-bg)] disabled:opacity-50"
                      >
                        <Upload className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                        {uploadingAnexos ? 'Enviando...' : 'Anexar Arquivos'}
                      </button>
                    </div>
                  </div>

                  {(!inspectedDoc.anexos || inspectedDoc.anexos.length === 0) && (
                    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-muted)]">
                      Nenhum arquivo ou laudo anexado a este passe.
                    </div>
                  )}

                  {inspectedDoc.anexos && inspectedDoc.anexos.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {inspectedDoc.anexos.map((anexo) => {
                        const isImage = anexo.mime_type.startsWith('image/')
                        const isPdf = anexo.mime_type.includes('pdf')

                        return (
                          <div
                            key={anexo.id}
                            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 flex items-center justify-between gap-2 hover:border-[var(--color-primary)] transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="flex h-8 w-8 items-center justify-center rounded bg-[var(--color-bg)] text-[var(--color-muted)] shrink-0">
                                {isImage ? (
                                  <FileText className="h-4 w-4 text-emerald-600" />
                                ) : isPdf ? (
                                  <FileText className="h-4 w-4 text-rose-600" />
                                ) : (
                                  <FileText className="h-4 w-4 text-blue-600" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[var(--color-text)] truncate">{anexo.original_name}</p>
                                <span className="text-[10px] text-[var(--color-muted)]">
                                  {(anexo.size_bytes / 1024).toFixed(1)} KB
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {(isImage || isPdf) && (
                                <button
                                  type="button"
                                  onClick={() => handlePreviewAnexo(anexo)}
                                  className="p-1 rounded text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg)] transition"
                                  title="Visualizar"
                                >
                                  <Maximize2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => token && documentosService.downloadAnexo(token, inspectedDoc.id, anexo.id)}
                                className="p-1 rounded text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition"
                                title="Baixar"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAnexo(anexo.id)}
                                className="p-1 rounded text-[var(--color-muted)] hover:text-rose-600 hover:bg-rose-50 transition"
                                title="Excluir"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg)] flex items-center justify-between">
                <button
                  type="button"
                  onClick={(e) => handleDeleteDoc(inspectedDoc.id, e)}
                  className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-xs hover:bg-rose-50 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const docToEdit = inspectedDoc
                      setInspectedDoc(null)
                      handleOpenEditModal(docToEdit)
                    }}
                    className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-text)] shadow-xs hover:bg-[var(--color-bg)] transition"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectedDoc(null)}
                    className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:opacity-90 transition"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: LIGHTBOX PREVIEW */}
      <AnimatePresence>
        {lightboxAnexo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
            <div className="relative w-full max-w-4xl max-h-[90vh] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-2xl overflow-hidden flex flex-col">
              <div className="p-3.5 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg)]">
                <span className="text-xs font-bold text-[var(--color-text)] truncate max-w-lg">{lightboxAnexo.nome}</span>
                <button
                  type="button"
                  onClick={() => setLightboxAnexo(null)}
                  className="p-1 rounded text-[var(--color-muted)] hover:text-[var(--color-text)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[400px]">
                {lightboxAnexo.mime.startsWith('image/') ? (
                  <img
                    src={lightboxAnexo.url}
                    alt={lightboxAnexo.nome}
                    className="max-h-[75vh] object-contain rounded-lg shadow-md"
                  />
                ) : lightboxAnexo.mime.includes('pdf') ? (
                  <iframe
                    src={lightboxAnexo.url}
                    title={lightboxAnexo.nome}
                    className="w-full h-[75vh] rounded-lg border border-[var(--color-border)]"
                  />
                ) : (
                  <p className="text-xs text-[var(--color-muted)]">Visualização direta indisponível para este tipo de arquivo.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: CRIADOR / EDITOR COM LIVE PREVIEW */}
      <AnimatePresence>
        {isFormModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] w-full max-w-4xl shadow-xl overflow-hidden my-6"
            >
              {/* Header */}
              <div className="p-5 border-b border-[var(--color-border)] flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[var(--color-text)]">
                    {editingDoc ? 'Editar Passe' : 'Novo Passe de Documento'}
                  </h3>
                  <p className="text-xs text-[var(--color-muted)]">
                    Preencha os dados e visualize o passe em tempo real.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="p-1 rounded text-[var(--color-muted)] hover:text-[var(--color-text)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Form & Live Preview */}
              <form onSubmit={handleSaveDocumento}>
                <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[68vh] overflow-y-auto">
                  {/* Left Column (7 cols) */}
                  <div className="lg:col-span-7 space-y-4">
                    {/* Categoria */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                        Categoria / Tipo de Documento *
                      </label>
                      <select
                        value={formData.tipo_documento_id}
                        onChange={(e) => {
                          const tipoId = Number(e.target.value)
                          const selected = tipos.find((t) => t.id === tipoId)
                          setFormData((prev) => ({
                            ...prev,
                            tipo_documento_id: tipoId,
                            icone: selected?.icone || prev.icone,
                            cor_pass: selected?.cor || prev.cor_pass,
                          }))
                        }}
                        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
                      >
                        {tipos.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Nome */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                        Nome do Documento / Exame *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: CNH Digital, Hemograma Completo, Passaporte, Laudo Lombar"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-hidden"
                      />
                    </div>

                    {/* Registro & Titular */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                          Número de Registro / Código
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: 000.000.000-00 ou CRM-1234"
                          value={formData.registro || ''}
                          onChange={(e) => setFormData({ ...formData, registro: e.target.value })}
                          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                          Titular / Paciente
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Nome do Titular"
                          value={formData.titular || ''}
                          onChange={(e) => setFormData({ ...formData, titular: e.target.value })}
                          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Emissor */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                        Órgão Emissor / Laboratório / Hospital
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: SSP-SP, Fleury, Albert Einstein, Detran"
                        value={formData.emissor || ''}
                        onChange={(e) => setFormData({ ...formData, emissor: e.target.value })}
                        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-hidden"
                      />
                    </div>

                    {/* Emissão & Validade */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                          Data de Emissão
                        </label>
                        <input
                          type="date"
                          value={formData.data_emissao || ''}
                          onChange={(e) => setFormData({ ...formData, data_emissao: e.target.value })}
                          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                          Data de Validade (Vazio = Permanente)
                        </label>
                        <input
                          type="date"
                          value={formData.data_validade || ''}
                          onChange={(e) => setFormData({ ...formData, data_validade: e.target.value })}
                          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Paleta de Cores */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text)] mb-1.5">
                        Paleta de Cores do Passe
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {WALLET_PALETTES.map((p) => (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => setFormData({ ...formData, cor_pass: p.id })}
                            className={`h-8 rounded-lg ${p.headerBg} border transition-all flex items-center justify-center text-white text-xs ${
                              formData.cor_pass === p.id ? 'ring-2 ring-[var(--color-primary)] scale-105 shadow-sm' : 'opacity-80 hover:opacity-100'
                            }`}
                            title={p.name}
                          >
                            {formData.cor_pass === p.id && <Check className="h-3.5 w-3.5" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Ícone */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text)] mb-1.5">
                        Ícone
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(ICON_MAP).map(([key, Icon]) => (
                          <button
                            type="button"
                            key={key}
                            onClick={() => setFormData({ ...formData, icone: key })}
                            className={`p-2 rounded-lg border transition ${
                              formData.icone === key
                                ? 'border-[var(--color-primary)] bg-teal-50 text-[var(--color-primary)]'
                                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tags */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                        Tags (separadas por vírgula)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: saúde, anual, renovação"
                        value={formData.tags || ''}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-hidden"
                      />
                    </div>

                    {/* Observações / Laudo */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                        Observações Clínicas / Detalhes
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Ex: Resultados clínicos, CRM do médico, dosagem, orientações..."
                        value={formData.outras_informacoes || ''}
                        onChange={(e) => setFormData({ ...formData, outras_informacoes: e.target.value })}
                        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-hidden resize-none"
                      />
                    </div>

                    {/* Anexos */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                        Anexar Arquivos (PDFs, Imagens)
                      </label>
                      <input
                        type="file"
                        multiple
                        ref={fileInputRef}
                        onChange={(e) => {
                          if (e.target.files) setPendingFiles(Array.from(e.target.files))
                        }}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)] flex flex-col items-center justify-center gap-1 text-xs text-[var(--color-muted)] transition"
                      >
                        <Upload className="h-4 w-4 text-[var(--color-primary)]" />
                        <span>Clique para anexar arquivos</span>
                        {pendingFiles.length > 0 && (
                          <span className="text-[var(--color-primary)] font-bold">
                            {pendingFiles.length} arquivo(s) selecionado(s)
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Live Pass Preview (5 cols) */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="sticky top-0 space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)] block">
                        Live Preview do Passe
                      </span>

                      {(() => {
                        const IconComp = getIconComponent(formData.icone)
                        const palette = getPalette(formData.cor_pass)
                        const status = getPassStatus(formData.data_validade)
                        const StatusIcon = status.icon
                        const tipoNome = tipos.find((t) => t.id === formData.tipo_documento_id)?.nome || 'Passe'

                        return (
                          <div className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-md overflow-hidden">
                            <div className={`${palette.headerBg} p-4 text-white`}>
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 border border-white/30">
                                  <IconComp className="h-4.5 w-4.5 text-white" />
                                </div>
                                <div>
                                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/80 block">
                                    {tipoNome}
                                  </span>
                                  <h4 className="text-sm font-bold text-white truncate max-w-[170px]">
                                    {formData.nome || 'Nome do Documento'}
                                  </h4>
                                </div>
                              </div>
                            </div>

                            <div className="p-4 space-y-2.5 text-xs bg-[var(--color-surface)]">
                              <div className="flex items-center justify-between">
                                <span className="text-[var(--color-muted)]">Titular:</span>
                                <span className="font-semibold text-[var(--color-text)] truncate max-w-[140px]">
                                  {formData.titular || 'Nome do Titular'}
                                </span>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-[var(--color-muted)]">Registro:</span>
                                <span className="font-mono font-bold text-[var(--color-text)] truncate max-w-[140px]">
                                  {formData.registro || '000.000.000'}
                                </span>
                              </div>

                              <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between">
                                <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${status.badge}`}>
                                  <StatusIcon className="h-3 w-3" />
                                  {status.label}
                                </span>

                                <div className="flex items-center gap-0.5 text-slate-300">
                                  <div className="h-3 w-1 bg-slate-400 rounded-full" />
                                  <div className="h-3 w-0.5 bg-slate-300 rounded-full" />
                                  <div className="h-3 w-1.5 bg-slate-400 rounded-full" />
                                  <div className="h-3 w-1 bg-slate-400 rounded-full" />
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg)] flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsFormModalOpen(false)}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-semibold text-[var(--color-text)] shadow-xs hover:bg-[var(--color-bg)] transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-90 transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Salvando...' : editingDoc ? 'Salvar Alterações' : 'Criar Passe'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  )
}
export default DocumentosPage
