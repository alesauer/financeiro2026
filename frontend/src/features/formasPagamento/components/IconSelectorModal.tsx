import { useState, useRef } from 'react'
import {
  X,
  Upload,
  Sparkles,
  Check,
  Palette,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react'
import {
  BankCardIcon,
  PRESET_ICONS,
  type PresetIconDef,
} from '@/shared/components/BankCardIcon'

interface IconSelectorModalProps {
  isOpen: boolean
  currentIcon?: string | null
  currentColor?: string | null
  nomeForma?: string
  onClose: () => void
  onSelect: (icone: string | null, cor: string | null) => void
}

const COLOR_PALETTE = [
  '#820AD1', // Nubank Purple
  '#242424', // C6 Carbon Black
  '#FF7A00', // Inter Orange
  '#EC7000', // Itaú Orange
  '#CC092F', // Bradesco Red
  '#EA1D25', // Santander Red
  '#003882', // BB Blue
  '#0066B3', // Caixa Blue
  '#111111', // XP Black
  '#0B1D3A', // BTG Navy
  '#32BCAD', // Pix Teal
  '#10B981', // Emerald Green
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#EC4899', // Pink
  '#64748B', // Slate
]

export function IconSelectorModal({
  isOpen,
  currentIcon,
  currentColor,
  nomeForma,
  onClose,
  onSelect,
}: IconSelectorModalProps) {
  const [selectedIcon, setSelectedIcon] = useState<string | null>(currentIcon || null)
  const [selectedColor, setSelectedColor] = useState<string | null>(currentColor || null)
  const [activeTab, setActiveTab] = useState<'presets' | 'upload'>('presets')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('Todos')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  if (!isOpen) return null

  const handleSelectPreset = (preset: PresetIconDef) => {
    setSelectedIcon(preset.id)
    setSelectedColor(preset.corPadrao)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null)
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setUploadError('Selecione um arquivo de imagem válido (PNG, JPG, SVG, WebP).')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('A imagem deve ter no máximo 2MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        // Redimensionar para tamanho leve (máximo 128x128) mantendo proporção
        const canvas = document.createElement('canvas')
        const maxDim = 128
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          const dataUrl = canvas.toDataURL('image/png', 0.9)
          setSelectedIcon(dataUrl)
        }
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleConfirm = () => {
    onSelect(selectedIcon, selectedColor)
    onClose()
  }

  const handleRemoveIcon = () => {
    setSelectedIcon(null)
    setSelectedColor(null)
  }

  const categorias = ['Todos', 'Bancos Digitais', 'Grandes Bancos', 'Bandeiras', 'Geral']

  const presetsFiltrados = PRESET_ICONS.filter((p) => {
    if (categoriaFiltro === 'Todos') return true
    return p.categoria === categoriaFiltro
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
      />

      <div className="relative w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4 bg-[var(--color-bg)]/40">
          <div>
            <h3 className="text-base font-bold text-[var(--color-text)] flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-teal-600" />
              Ícone da Forma de Pagamento
            </h3>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              {nomeForma ? `Personalize o ícone para "${nomeForma}"` : 'Escolha um ícone oficial ou envie uma foto'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)] transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Preview do Ícone Atual */}
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <BankCardIcon
              icone={selectedIcon}
              cor={selectedColor}
              nome={nomeForma || 'Cartão'}
              size="lg"
            />
            <div>
              <p className="text-xs font-semibold text-[var(--color-text)]">
                {selectedIcon?.startsWith('data:image')
                  ? 'Ícone Personalizado (Upload)'
                  : PRESET_ICONS.find((p) => p.id === selectedIcon)?.nome || 'Ícone Padrão'}
              </p>
              <p className="text-[11px] text-[var(--color-muted)]">Prévia de exibição</p>
            </div>
          </div>

          {selectedIcon && (
            <button
              type="button"
              onClick={handleRemoveIcon}
              className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-medium"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Restaurar padrão
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-border)] px-5">
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 transition ${
              activeTab === 'presets'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Ícones Oficiais de Bancos & Cartões
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            Fazer Upload de Ícone
          </button>
        </div>

        {/* Conteúdo da Tab */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'presets' ? (
            <div>
              {/* Filtro por Categoria */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 text-xs no-scrollbar">
                {categorias.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoriaFiltro(cat)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 transition ${
                      categoriaFiltro === cat
                        ? 'bg-[var(--color-primary)] text-white shadow-xs'
                        : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Grid de Presets */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-3">
                {presetsFiltrados.map((preset) => {
                  const isSelected = selectedIcon === preset.id

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition relative ${
                        isSelected
                          ? 'border-teal-500 bg-teal-50/50 shadow-xs ring-2 ring-teal-500/20'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-teal-400 hover:bg-slate-50/50'
                      }`}
                    >
                      <BankCardIcon
                        icone={preset.id}
                        cor={preset.corPadrao}
                        nome={preset.nome}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[var(--color-text)] truncate">
                          {preset.nome}
                        </p>
                        <p className="text-[10px] text-[var(--color-muted)] truncate">
                          {preset.categoria}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="h-4 w-4 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-[var(--color-border)] hover:border-teal-500 rounded-xl p-6 text-center transition bg-[var(--color-bg)]/30 hover:bg-teal-50/20"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-teal-700 mb-3">
                  <ImageIcon className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-[var(--color-text)]">
                  Clique para selecionar uma imagem do seu computador
                </p>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Suporta PNG, JPG, SVG ou WebP (máx. 2MB)
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml, image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {uploadError && (
                <p className="text-xs font-semibold text-rose-600">{uploadError}</p>
              )}

              {selectedIcon?.startsWith('data:image') && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedIcon}
                      alt="Upload"
                      className="h-10 w-10 rounded-lg object-contain bg-white border border-emerald-200 p-0.5 shadow-xs"
                    />
                    <div>
                      <p className="text-xs font-bold text-emerald-950">Imagem carregada com sucesso!</p>
                      <p className="text-[11px] text-emerald-800">Otimizada para exibição nos lançamentos e faturas</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedIcon(null)}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Paleta de Cores de Destaque */}
          <div className="border-t border-[var(--color-border)] pt-4">
            <label className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5 mb-2">
              <Palette className="h-3.5 w-3.5 text-teal-600" />
              Cor de Destaque / Fundo
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`h-7 w-7 rounded-full transition-transform flex items-center justify-center ${
                    selectedColor === color ? 'scale-110 ring-2 ring-offset-2 ring-slate-800' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                >
                  {selectedColor === color && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
                </button>
              ))}

              {/* Input customizado de cor */}
              <label
                className="h-7 w-7 rounded-full border border-[var(--color-border)] flex items-center justify-center cursor-pointer bg-white hover:scale-105 transition"
                title="Escolher outra cor personalizada"
              >
                <input
                  type="color"
                  value={selectedColor || '#242424'}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="opacity-0 absolute w-0 h-0"
                />
                <span className="text-xs font-bold text-slate-700">+</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3.5 bg-[var(--color-bg)]/30">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-border)]/50 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg bg-[var(--color-primary)] text-white px-5 py-2 text-xs font-semibold shadow-xs hover:opacity-95 transition"
          >
            Aplicar Ícone
          </button>
        </div>
      </div>
    </div>
  )
}
