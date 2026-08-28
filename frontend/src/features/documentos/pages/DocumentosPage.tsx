import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'

import { useAuth } from '@/app/providers/AuthProvider'
import { documentosService } from '@/features/documentos/services/documentosService'
import type { Documento, DocumentoAnexo, DocumentoPayload, TipoDocumento } from '@/shared/types/documento'
import { getErrorMessage } from '@/shared/utils/error'

const EMPTY_FORM: DocumentoPayload = {
  tipo_documento_id: 0,
  nome: '',
  registro: null,
  outras_informacoes: null,
}

export function DocumentosPage() {
  const { token } = useAuth()

  const [tipos, setTipos] = useState<TipoDocumento[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [anexos, setAnexos] = useState<DocumentoAnexo[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [form, setForm] = useState<DocumentoPayload>(EMPTY_FORM)
  const [files, setFiles] = useState<File[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)

  const tituloFormulario = useMemo(() => (editingId ? 'Editar documento' : 'Novo documento'), [editingId])

  const carregarTudo = async () => {
    if (!token) return
    setLoading(true)
    setError(null)

    try {
      const [tiposData, docsData] = await Promise.all([documentosService.tipos(token), documentosService.list(token, 1, 50)])

      setTipos(tiposData)
      setDocumentos(docsData.items)

      const tipoDefault = tiposData[0]?.id ?? 0
      setForm((prev) => ({ ...prev, tipo_documento_id: prev.tipo_documento_id || tipoDefault }))

      if (!selectedId && docsData.items[0]) {
        setSelectedId(docsData.items[0].id)
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar documentos.'))
    } finally {
      setLoading(false)
    }
  }

  const carregarAnexos = async (docId: number) => {
    if (!token) return
    try {
      const data = await documentosService.listAnexos(token, docId)
      setAnexos(data)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar anexos.'))
    }
  }

  useEffect(() => {
    carregarTudo()
  }, [token])

  useEffect(() => {
    if (selectedId) carregarAnexos(selectedId)
    else setAnexos([])
  }, [selectedId, token])

  const resetForm = () => {
    setEditingId(null)
    setForm({
      ...EMPTY_FORM,
      tipo_documento_id: tipos[0]?.id ?? 0,
    })
  }

  const abrirNovoFormulario = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const cancelarFormulario = () => {
    resetForm()
    setIsFormOpen(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return

    if (!form.nome.trim() || !form.tipo_documento_id) {
      setError('Informe nome e tipo do documento.')
      return
    }

    const payload: DocumentoPayload = {
      tipo_documento_id: form.tipo_documento_id,
      nome: form.nome.trim(),
      registro: form.registro?.trim() || null,
      outras_informacoes: form.outras_informacoes?.trim() || null,
    }

    try {
      if (editingId) {
        await documentosService.update(token, editingId, payload)
      } else {
        await documentosService.create(token, payload)
      }

      resetForm()
      setIsFormOpen(false)
      await carregarTudo()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível salvar documento.'))
    }
  }

  const handleEdit = (item: Documento) => {
    setEditingId(item.id)
    setIsFormOpen(true)
    setForm({
      tipo_documento_id: item.tipo_documento_id,
      nome: item.nome,
      registro: item.registro,
      outras_informacoes: item.outras_informacoes,
    })
  }

  const handleDelete = async (id: number) => {
    if (!token) return
    if (!window.confirm('Confirma a exclusão deste documento?')) return

    try {
      await documentosService.remove(token, id)
      await carregarTudo()
      if (selectedId === id) setSelectedId(null)
      if (editingId === id) cancelarFormulario()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível excluir documento.'))
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(event.target.files || []))
  }

  const handleUpload = async () => {
    if (!token || !selectedId || files.length === 0) return
    try {
      await documentosService.uploadAnexos(token, selectedId, files)
      setFiles([])
      await carregarAnexos(selectedId)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível enviar anexos.'))
    }
  }

  const handleDownload = async (anexoId: number) => {
    if (!token || !selectedId) return
    try {
      await documentosService.downloadAnexo(token, selectedId, anexoId)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível baixar anexo.'))
    }
  }

  const handleDeleteAnexo = async (anexoId: number) => {
    if (!token || !selectedId) return
    if (!window.confirm('Excluir este anexo?')) return

    try {
      await documentosService.deleteAnexo(token, selectedId, anexoId)
      await carregarAnexos(selectedId)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível excluir anexo.'))
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-[var(--color-text)]">Documentos</h2>
        <p className="text-sm text-[var(--color-muted)]">Cadastre documentos e gerencie anexos.</p>
      </header>

      <article className="space-y-6">
        <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Lista de documentos</h3>
            <button
              type="button"
              onClick={abrirNovoFormulario}
              className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white"
            >
              Novo documento
            </button>
          </div>

          {isFormOpen ? (
            <div className="mb-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]/30 p-4">
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">{tituloFormulario}</h4>

              <form className="space-y-3" onSubmit={handleSubmit}>
            <Field label="Tipo">
              <select
                value={form.tipo_documento_id || ''}
                onChange={(event) => setForm((prev) => ({ ...prev, tipo_documento_id: Number(event.target.value) }))}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
              >
                {tipos.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nome}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Nome">
              <input
                value={form.nome}
                onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Registro">
              <input
                value={form.registro ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, registro: event.target.value || null }))}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Outras informações">
              <textarea
                rows={3}
                value={form.outras_informacoes ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, outras_informacoes: event.target.value || null }))}
                className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
              />
            </Field>

            <div className="flex items-center gap-2 pt-2">
              <button className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white">
                {editingId ? 'Salvar alterações' : 'Adicionar'}
              </button>
              <button
                type="button"
                onClick={cancelarFormulario}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
            </div>
          ) : null}

          {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

          {editingId ? null : loading ? (
            <p className="mb-3 text-sm text-[var(--color-muted)] md:hidden">Carregando...</p>
          ) : documentos.length === 0 ? (
            <p className="mb-3 text-sm text-[var(--color-muted)] md:hidden">Nenhum documento cadastrado.</p>
          ) : (
            <div className="mb-3 space-y-2 md:hidden">
              {documentos.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                >
                  <p className="text-sm font-semibold text-[var(--color-text)]">{item.nome}</p>
                  <div className="mt-1 space-y-0.5 text-xs text-[var(--color-muted)]">
                    <p>Tipo: {item.tipo_documento_nome ?? '-'}</p>
                    <p>Registro: {item.registro ?? '-'}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                    >
                      Anexos
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="rounded-[var(--radius-sm)] border border-rose-200 px-2 py-1 text-xs text-rose-600"
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {editingId ? null : <div className="overflow-x-auto">
            <table className="hidden min-w-full border-collapse text-sm md:table">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left">
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Registro</th>
                  <th className="py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-[var(--color-muted)]">
                      Carregando...
                    </td>
                  </tr>
                ) : documentos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-[var(--color-muted)]">
                      Nenhum documento cadastrado.
                    </td>
                  </tr>
                ) : (
                  documentos.map((item) => (
                    <tr key={item.id} className="border-b border-[var(--color-border)]/70">
                      <td className="py-2 pr-3">{item.nome}</td>
                      <td className="py-2 pr-3">{item.tipo_documento_nome ?? '-'}</td>
                      <td className="py-2 pr-3">{item.registro ?? '-'}</td>
                      <td className="py-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedId(item.id)}
                            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                          >
                            Anexos
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="rounded-[var(--radius-sm)] border border-rose-200 px-2 py-1 text-xs text-rose-600"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>}
        </section>

        {editingId ? null : <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Anexos</h3>
          {selectedId ? (
            <>
              <div className="mb-3 flex items-center gap-2">
                <input type="file" multiple onChange={handleFileChange} className="text-sm" />
                <button
                  type="button"
                  onClick={handleUpload}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-sm"
                >
                  Enviar
                </button>
              </div>

              <div className="overflow-x-auto">
                {anexos.length === 0 ? (
                  <p className="mb-3 text-sm text-[var(--color-muted)] md:hidden">Nenhum anexo para este documento.</p>
                ) : (
                  <div className="mb-3 space-y-2 md:hidden">
                    {anexos.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                      >
                        <p className="text-sm font-semibold text-[var(--color-text)]">{item.original_name}</p>
                        <div className="mt-1 space-y-0.5 text-xs text-[var(--color-muted)]">
                          <p>Tipo: {item.mime_type}</p>
                          <p>Tamanho: {Math.round(item.size_bytes / 1024)} KB</p>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDownload(item.id)}
                            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                          >
                            Baixar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAnexo(item.id)}
                            className="rounded-[var(--radius-sm)] border border-rose-200 px-2 py-1 text-xs text-rose-600"
                          >
                            Excluir
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                <table className="hidden min-w-full border-collapse text-sm md:table">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left">
                      <th className="py-2 pr-3">Arquivo</th>
                      <th className="py-2 pr-3">Tipo</th>
                      <th className="py-2 pr-3">Tamanho</th>
                      <th className="py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anexos.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-[var(--color-muted)]">
                          Nenhum anexo para este documento.
                        </td>
                      </tr>
                    ) : (
                      anexos.map((item) => (
                        <tr key={item.id} className="border-b border-[var(--color-border)]/70">
                          <td className="py-2 pr-3">{item.original_name}</td>
                          <td className="py-2 pr-3">{item.mime_type}</td>
                          <td className="py-2 pr-3">{Math.round(item.size_bytes / 1024)} KB</td>
                          <td className="py-2 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleDownload(item.id)}
                                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1 text-xs"
                              >
                                Baixar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAnexo(item.id)}
                                className="rounded-[var(--radius-sm)] border border-rose-200 px-2 py-1 text-xs text-rose-600"
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">Selecione um documento para ver os anexos.</p>
          )}
        </section>}
      </article>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  )
}
