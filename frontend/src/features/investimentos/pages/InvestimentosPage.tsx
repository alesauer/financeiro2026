import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { useAuth } from '@/app/providers/AuthProvider'
import { investimentosService } from '@/features/investimentos/services/investimentosService'
import type {
  InvestmentAsset,
  InvestmentAssetPayload,
  InvestmentAssetType,
  InvestmentDashboard,
  InvestmentTransaction,
  InvestmentTransactionPayload,
  InvestmentTransactionType,
  InvestmentWallet,
  InvestmentWalletPayload,
} from '@/shared/types/investimento'
import { formatCurrency, formatDateBr } from '@/shared/utils/date'
import { getErrorMessage } from '@/shared/utils/error'

const ASSET_TYPES: InvestmentAssetType[] = [
  'Ações','FIIs','ETFs','BDRs','Tesouro Direto','CDB','LCI','LCA','Debêntures','Fundos','Criptomoedas','Previdência',
]
const TX_TYPES: InvestmentTransactionType[] = [
  'Compra','Venda','Dividendos','JCP','Bonificação','Split','Grupamento','Aporte','Resgate',
]
const EMPTY_WALLET: InvestmentWalletPayload = { nome:'', cor:'#2563eb', moeda:'BRL', observacoes:null, ativo:true }
const mkEmptyAsset = (wid: number): InvestmentAssetPayload => ({ wallet_id:wid, codigo:'', nome:'', tipo:'Ações', setor:null, bolsa:null, moeda:'BRL', ativo:true })
const mkEmptyTx = (wid: number): InvestmentTransactionPayload => ({ wallet_id:wid, asset_id:null, tipo:'Compra', data_movimentacao: new Date().toISOString().slice(0,10), quantidade:'', preco:'', taxas:'0', valor_total:'0', corretora:null, observacoes:null })

const btn = 'rounded-md px-3 py-2 text-xs font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40'
const btnP = btn + ' bg-[var(--color-primary)] text-white'
const btnS = btn + ' border border-[var(--color-border)] hover:bg-gray-50'
const inp = 'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]'
const sel = inp

function Toast({ msg, type }: { msg: string; type: 'ok'|'err' }) {
  return <div className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-lg px-4 py-3 text-sm text-white shadow-xl ${type==='ok'?'bg-emerald-600':'bg-rose-600'}`}>{msg}</div>
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{title}</h3>
      {children}
    </article>
  )
}
function Kpi({ title, value, pct, hi, cor }: { title:string; value?:number; pct?:number; hi?:boolean; cor?:string }) {
  return (
    <article className={`rounded-lg border p-3 ${hi?'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5':'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">{title}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${cor??'text-[var(--color-text)]'}`}>
        {typeof pct==='number' ? `${pct.toFixed(2).replace('.',',')}%` : formatCurrency(value??0)}
      </p>
    </article>
  )
}

export function InvestimentosPage() {
  const { token } = useAuth()
  const [wallets, setWallets] = useState<InvestmentWallet[]>([])
  const [assets,  setAssets]  = useState<InvestmentAsset[]>([])
  const [txs,     setTxs]     = useState<InvestmentTransaction[]>([])
  const [dash,    setDash]     = useState<InvestmentDashboard|null>(null)
  const [selWid,  setSelWid]   = useState<number|null>(null)
  const [loading, setLoading]  = useState(false)
  const [refQ,    setRefQ]     = useState(false)
  const [toast,   setToast]    = useState<{msg:string;type:'ok'|'err'}|null>(null)

  const [wForm, setWForm] = useState<InvestmentWalletPayload>(EMPTY_WALLET)
  const [aForm, setAForm] = useState<InvestmentAssetPayload>(mkEmptyAsset(0))
  const [tForm, setTForm] = useState<InvestmentTransactionPayload>(mkEmptyTx(0))
  const [editWid, setEditWid] = useState<number|null>(null)
  const [editAid, setEditAid] = useState<number|null>(null)
  const [editTid, setEditTid] = useState<number|null>(null)

  const reqRef = useRef<number>(0)

  const notify = useCallback((msg: string, type: 'ok'|'err'='ok') => {
    setToast({msg,type}); setTimeout(()=>setToast(null),3500)
  },[])

  const load = useCallback(async (wid: number|null) => {
    if (!token) return
    const seq = ++reqRef.current
    setLoading(true)
    try {
      const [ws, as, ts, ds] = await Promise.all([
        investimentosService.listWallets(token),
        investimentosService.listAssets(token, wid??undefined),
        investimentosService.listTransactions(token, wid??undefined),
        investimentosService.dashboard(token, wid??undefined),
      ])
      if (seq !== reqRef.current) return
      setWallets(ws); setAssets(as); setTxs(ts); setDash(ds)
    } catch (e) {
      notify(getErrorMessage(e,'Erro ao carregar dados.'),'err')
    } finally {
      setLoading(false)
    }
  },[token, notify])

  useEffect(()=>{ load(null) },[token]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (wid: number|null) => {
    setSelWid(wid)
    setAForm(mkEmptyAsset(wid??0))
    setTForm(mkEmptyTx(wid??0))
    load(wid)
  }

  const selWallet = useMemo(()=>wallets.find(w=>w.id===selWid)??null,[wallets,selWid])
  const aOpts     = useMemo(()=>assets.filter(a=>!selWid||a.wallet_id===selWid),[assets,selWid])

  /* ---- Wallets ---- */
  const resetW = ()=>{ setWForm(EMPTY_WALLET); setEditWid(null) }
  const saveW  = async (e:FormEvent) => {
    e.preventDefault(); if(!token||!wForm.nome.trim()) return
    try {
      if (editWid) {
        await investimentosService.updateWallet(token,editWid,wForm); notify('Carteira atualizada.')
        resetW(); await load(selWid)
      } else {
        const nova = await investimentosService.createWallet(token,wForm)
        notify('Carteira criada!')
        resetW(); pick(nova.id)
      }
    } catch(e){ notify(getErrorMessage(e,'Erro ao salvar carteira.'),'err') }
  }
  const editW = (w:InvestmentWallet)=>{ setEditWid(w.id); setWForm({nome:w.nome,cor:w.cor,moeda:w.moeda,observacoes:w.observacoes,ativo:w.ativo}) }
  const delW  = async (id:number)=>{ if(!token||!confirm('Excluir carteira e todos os dados?')) return
    try { await investimentosService.deleteWallet(token,id); notify('Carteira excluída.'); pick(selWid===id?null:selWid) }
    catch(e){ notify(getErrorMessage(e,'Erro.'),'err') }
  }

  /* ---- Assets ---- */
  const resetA = ()=>{ setAForm(mkEmptyAsset(selWid??0)); setEditAid(null) }
  const saveA  = async (e:FormEvent) => {
    e.preventDefault(); if(!token) return
    const wid = aForm.wallet_id||selWid
    if(!wid){ notify('Selecione uma carteira.','err'); return }
    try {
      if (editAid) { await investimentosService.updateAsset(token,editAid,{...aForm,wallet_id:wid}); notify('Ativo atualizado.') }
      else         { await investimentosService.createAsset(token,{...aForm,wallet_id:wid}); notify('Ativo adicionado!') }
      resetA(); await load(selWid)
    } catch(e){ notify(getErrorMessage(e,'Erro ao salvar ativo.'),'err') }
  }
  const editA = (a:InvestmentAsset)=>{ setEditAid(a.id); setAForm({wallet_id:a.wallet_id,codigo:a.codigo,nome:a.nome,tipo:a.tipo,setor:a.setor,bolsa:a.bolsa,moeda:a.moeda,ativo:a.ativo}) }
  const delA  = async (id:number)=>{ if(!token||!confirm('Excluir ativo?')) return
    try { await investimentosService.deleteAsset(token,id); notify('Ativo excluído.'); await load(selWid) }
    catch(e){ notify(getErrorMessage(e,'Erro.'),'err') }
  }

  /* ---- Transactions ---- */
  const resetT = ()=>{ setTForm(mkEmptyTx(selWid??0)); setEditTid(null) }
  const saveT  = async (e:FormEvent) => {
    e.preventDefault(); if(!token) return
    const wid = tForm.wallet_id||selWid
    if(!wid){ notify('Selecione uma carteira.','err'); return }
    try {
      if (editTid) { await investimentosService.updateTransaction(token,editTid,{...tForm,wallet_id:wid}); notify('Movimentação atualizada.') }
      else         { await investimentosService.createTransaction(token,{...tForm,wallet_id:wid}); notify('Movimentação registrada!') }
      resetT(); await load(selWid)
    } catch(e){ notify(getErrorMessage(e,'Erro ao salvar movimentação.'),'err') }
  }
  const editT = (t:InvestmentTransaction)=>{ setEditTid(t.id); setTForm({wallet_id:t.wallet_id,asset_id:t.asset_id,tipo:t.tipo,data_movimentacao:t.data_movimentacao,quantidade:t.quantidade??'',preco:t.preco??'',taxas:t.taxas,valor_total:t.valor_total,corretora:t.corretora,observacoes:t.observacoes}) }
  const delT  = async (id:number)=>{ if(!token||!confirm('Excluir movimentação?')) return
    try { await investimentosService.deleteTransaction(token,id); notify('Movimentação excluída.'); await load(selWid) }
    catch(e){ notify(getErrorMessage(e,'Erro.'),'err') }
  }

  /* ---- Cotações ---- */
  const updQ = async ()=>{ if(!token||!selWid) return; setRefQ(true)
    try { const r=await investimentosService.refreshQuotes(token,selWid,10); notify(`Cotações: ${r.updated} atualizado(s).`); await load(selWid) }
    catch(e){ notify(getErrorMessage(e,'Erro ao atualizar cotações.'),'err') }
    finally { setRefQ(false) }
  }

  /* ---- RENDER ---- */
  return (
    <section className="space-y-6">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Header */}
      <header className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--color-text)]">Investimentos</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Carteiras, ativos, movimentações e cotações com dashboard consolidado.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={selWid??''} onChange={e=>pick(e.target.value?Number(e.target.value):null)} className={sel+' min-w-[160px]'}>
              <option value="">{wallets.length===0?'Sem carteiras':'Todas as carteiras'}</option>
              {wallets.map(w=><option key={w.id} value={w.id}>{w.nome}</option>)}
            </select>
            <button type="button" onClick={updQ} disabled={refQ||loading||!selWid} className={btnP}>
              {refQ?'Atualizando…':'Atualizar cotações'}
            </button>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi title="PATRIMÔNIO"    value={dash?.patrimonio_total??0} hi />
        <Kpi title="INVESTIDO"     value={dash?.valor_investido??0} />
        <Kpi title="LUCRO/PREJUÍZO" value={dash?.lucro_prejuizo??0} cor={dash&&dash.lucro_prejuizo>=0?'text-emerald-600':'text-rose-600'} />
        <Kpi title="RENTABILIDADE" pct={dash?.rentabilidade_percentual??0} />
        <Kpi title="DIVIDENDOS MÊS" value={dash?.dividendos_mes??0} />
        <Kpi title="APORTE MÊS"   value={dash?.aporte_mes??0} />
      </div>

      {/* Aviso sem carteira */}
      {wallets.length===0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Comece criando uma carteira</strong> no painel abaixo. Depois adicione ativos e registre movimentações.
        </div>
      )}

      {/* Formulários */}
      <div className="grid gap-4 xl:grid-cols-3">

        {/* Carteiras */}
        <Card title="Carteiras">
          <form onSubmit={saveW} className="space-y-2">
            <input required placeholder="Nome da carteira *" value={wForm.nome} onChange={e=>setWForm(p=>({...p,nome:e.target.value}))} className={inp} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-[var(--color-muted)]">Cor</label>
                <input type="color" value={wForm.cor??'#2563eb'} onChange={e=>setWForm(p=>({...p,cor:e.target.value}))} className="h-9 w-full rounded-md border border-[var(--color-border)] cursor-pointer" />
              </div>
              <input placeholder="Moeda (BRL)" value={wForm.moeda??'BRL'} onChange={e=>setWForm(p=>({...p,moeda:e.target.value}))} className={inp} />
            </div>
            <textarea rows={2} placeholder="Observações" value={wForm.observacoes??''} onChange={e=>setWForm(p=>({...p,observacoes:e.target.value||null}))} className={inp} />
            <div className="flex gap-2">
              <button type="submit" className={btnP}>{editWid?'Salvar':'Adicionar'}</button>
              {editWid && <button type="button" className={btnS} onClick={resetW}>Cancelar</button>}
            </div>
          </form>
          <div className="mt-4 space-y-2">
            {wallets.length===0 && <p className="text-xs text-[var(--color-muted)]">Nenhuma carteira cadastrada.</p>}
            {wallets.map(w=>(
              <div key={w.id} onClick={()=>pick(w.id)} className={`flex cursor-pointer items-center justify-between gap-2 rounded-md border p-2 text-sm transition-colors ${selWid===w.id?'border-[var(--color-primary)] bg-[var(--color-primary)]/5':'border-[var(--color-border)] hover:bg-gray-50'}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{background:w.cor}} />
                  <span className="truncate font-medium">{w.nome}</span>
                  <span className="text-xs text-[var(--color-muted)]">{w.moeda}</span>
                </div>
                <div className="flex shrink-0 gap-3 text-xs">
                  <button type="button" className="text-[var(--color-primary)] hover:underline" onClick={e=>{e.stopPropagation();editW(w)}}>Editar</button>
                  <button type="button" className="text-rose-600 hover:underline" onClick={e=>{e.stopPropagation();delW(w.id)}}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Ativos */}
        <Card title="Ativos">
          {!selWallet && <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">Selecione ou crie uma carteira para gerenciar ativos.</p>}
          <form onSubmit={saveA} className="space-y-2">
            <select value={aForm.wallet_id||selWid||''} onChange={e=>setAForm(p=>({...p,wallet_id:Number(e.target.value)}))} className={sel} required>
              <option value="">Carteira *</option>
              {wallets.map(w=><option key={w.id} value={w.id}>{w.nome}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input required placeholder="Código (ex: ITSA4) *" value={aForm.codigo} onChange={e=>setAForm(p=>({...p,codigo:e.target.value.toUpperCase()}))} className={inp} />
              <input required placeholder="Nome *" value={aForm.nome} onChange={e=>setAForm(p=>({...p,nome:e.target.value}))} className={inp} />
            </div>
            <select value={aForm.tipo} onChange={e=>setAForm(p=>({...p,tipo:e.target.value as InvestmentAssetType}))} className={sel}>
              {ASSET_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Setor" value={aForm.setor??''} onChange={e=>setAForm(p=>({...p,setor:e.target.value||null}))} className={inp} />
              <input placeholder="Bolsa" value={aForm.bolsa??''} onChange={e=>setAForm(p=>({...p,bolsa:e.target.value||null}))} className={inp} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className={btnP}>{editAid?'Salvar ativo':'Adicionar ativo'}</button>
              {editAid && <button type="button" className={btnS} onClick={resetA}>Cancelar</button>}
            </div>
          </form>
          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
            {aOpts.length===0 && <p className="text-xs text-[var(--color-muted)]">Nenhum ativo cadastrado.</p>}
            {aOpts.map(a=>(
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] p-2 text-sm">
                <div>
                  <p className="font-semibold">{a.codigo} <span className="font-normal text-xs text-[var(--color-muted)]">{a.tipo}</span></p>
                  <p className="text-xs text-[var(--color-muted)]">{a.nome}</p>
                </div>
                <div className="flex gap-3 text-xs shrink-0">
                  <button type="button" className="text-[var(--color-primary)] hover:underline" onClick={()=>editA(a)}>Editar</button>
                  <button type="button" className="text-rose-600 hover:underline" onClick={()=>delA(a.id)}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Movimentações */}
        <Card title="Movimentações">
          {!selWallet && <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">Selecione ou crie uma carteira para registrar movimentações.</p>}
          <form onSubmit={saveT} className="space-y-2">
            <select value={tForm.wallet_id||selWid||''} onChange={e=>setTForm(p=>({...p,wallet_id:Number(e.target.value),asset_id:null}))} className={sel} required>
              <option value="">Carteira *</option>
              {wallets.map(w=><option key={w.id} value={w.id}>{w.nome}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select value={tForm.tipo} onChange={e=>setTForm(p=>({...p,tipo:e.target.value as InvestmentTransactionType}))} className={sel}>
                {TX_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <select value={tForm.asset_id??''} onChange={e=>setTForm(p=>({...p,asset_id:e.target.value?Number(e.target.value):null}))} className={sel}>
                <option value="">Sem ativo (aporte/resgate…)</option>
                {aOpts.map(a=><option key={a.id} value={a.id}>{a.codigo} — {a.nome}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" required value={tForm.data_movimentacao??''} onChange={e=>setTForm(p=>({...p,data_movimentacao:e.target.value}))} className={inp} />
              <input placeholder="Corretora" value={tForm.corretora??''} onChange={e=>setTForm(p=>({...p,corretora:e.target.value||null}))} className={inp} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" step="0.000001" placeholder="Quantidade" value={tForm.quantidade??''} onChange={e=>setTForm(p=>({...p,quantidade:e.target.value}))} className={inp} />
              <input type="number" step="0.000001" placeholder="Preço" value={tForm.preco??''} onChange={e=>setTForm(p=>({...p,preco:e.target.value}))} className={inp} />
              <input type="number" step="0.01" placeholder="Taxas" value={tForm.taxas??''} onChange={e=>setTForm(p=>({...p,taxas:e.target.value}))} className={inp} />
            </div>
            <input type="number" step="0.01" placeholder="Valor total" value={tForm.valor_total??''} onChange={e=>setTForm(p=>({...p,valor_total:e.target.value}))} className={inp} />
            <div className="flex gap-2">
              <button type="submit" className={btnP}>{editTid?'Salvar movimentação':'Adicionar movimentação'}</button>
              {editTid && <button type="button" className={btnS} onClick={resetT}>Cancelar</button>}
            </div>
          </form>
        </Card>
      </div>

      {/* Alocação */}
      {dash && dash.alocacao_por_tipo.length>0 && (
        <Card title="Alocação por tipo">
          <div className="space-y-3">
            {dash.alocacao_por_tipo.map(item=>(
              <div key={item.tipo}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{item.tipo}</span>
                  <span className="tabular-nums font-medium">{formatCurrency(item.valor)} · {item.percentual.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-[var(--color-primary)] transition-all" style={{width:`${Math.min(item.percentual,100)}%`}} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Posição consolidada */}
      <Card title="Posição consolidada">
        {loading ? (
          <p className="text-sm text-[var(--color-muted)]">Carregando…</p>
        ) : dash?.ativos?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-muted)]">
                  {['Ativo','Tipo','Qtd','Preço atual','Valor atual','Investido','P/L'].map(h=>(
                    <th key={h} className={`px-3 py-2 ${['Qtd','Preço atual','Valor atual','Investido','P/L'].includes(h)?'text-right':''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dash.ativos.map(item=>(
                  <tr key={item.asset_id} className="border-b border-[var(--color-border)]/50 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{item.codigo}<span className="ml-1 text-xs font-normal text-[var(--color-muted)]">— {item.nome}</span></td>
                    <td className="px-3 py-2 text-xs text-[var(--color-muted)]">{item.tipo}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.quantidade.toFixed(4)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(item.preco_atual)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(item.valor_atual)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(item.valor_investido)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${item.p_l>=0?'text-emerald-600':'text-rose-600'}`}>{formatCurrency(item.p_l)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">Sem posição consolidada. Adicione ativos e registre movimentações de compra.</p>
        )}
      </Card>

      {/* Histórico */}
      <Card title="Histórico de movimentações">
        {txs.length===0 ? (
          <p className="text-sm text-[var(--color-muted)]">Nenhuma movimentação cadastrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-muted)]">
                  {['Data','Tipo','Ativo','Qtd','Preço','Taxas','Total','Corretora',''].map((h,i)=>(
                    <th key={i} className={`px-3 py-2 ${['Qtd','Preço','Taxas','Total'].includes(h)?'text-right':''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txs.map(item=>(
                  <tr key={item.id} className="border-b border-[var(--color-border)]/50 hover:bg-gray-50">
                    <td className="px-3 py-2 text-[var(--color-muted)]">{formatDateBr(item.data_movimentacao)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${item.tipo==='Compra'?'bg-emerald-50 text-emerald-700':item.tipo==='Venda'?'bg-rose-50 text-rose-700':item.tipo==='Dividendos'||item.tipo==='JCP'?'bg-amber-50 text-amber-700':'bg-blue-50 text-blue-700'}`}>{item.tipo}</span>
                    </td>
                    <td className="px-3 py-2">{item.ativo_codigo?`${item.ativo_codigo} — ${item.ativo_nome}`:'—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.quantidade??'—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.preco?formatCurrency(Number(item.preco)):'—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(item.taxas??0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{formatCurrency(Number(item.valor_total??0))}</td>
                    <td className="px-3 py-2 text-[var(--color-muted)]">{item.corretora??'—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-3 text-xs">
                        <button type="button" className="text-[var(--color-primary)] hover:underline" onClick={()=>editT(item)}>Editar</button>
                        <button type="button" className="text-rose-600 hover:underline" onClick={()=>delT(item.id)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  )
}
