import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { PrivateLayout } from '@/app/layouts/PrivateLayout'
import { PublicLayout } from '@/app/layouts/PublicLayout'
import { PrivateRoute } from '@/app/router/PrivateRoute'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { CategoriasPage } from '@/features/categorias/pages/CategoriasPage'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { ConfiguracoesPage } from '@/features/configuracoes/pages/ConfiguracoesPage'
import { DocumentosPage } from '@/features/documentos/pages/DocumentosPage'
import { FormasPagamentoPage } from '@/features/formasPagamento/pages/FormasPagamentoPage'
import { IaPage } from '@/features/ia/pages/IaPage'
import { ImportacaoPage } from '@/features/importacao/pages/ImportacaoPage'
import { InvestimentosPage } from '@/features/investimentos/pages/InvestimentosPage'
import { InvestimentosMercadoPage } from '@/features/investimentos/pages/InvestimentosMercadoPage'
import { LembretesPage } from '@/features/lembretes/pages/LembretesPage'
import { MilhasPage } from '@/features/milhas/pages/MilhasPage'
import { RelatorioDetalhePage } from '@/features/relatorios/pages/RelatorioDetalhePage'
import { RelatoriosPage } from '@/features/relatorios/pages/RelatoriosPage'
import { TransacoesPage } from '@/features/transacoes/pages/TransacoesPage'
import { UsuariosPage } from '@/features/usuarios/pages/UsuariosPage'
import { ViagensPage } from '@/features/viagens/pages/ViagensPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<PrivateRoute />}>
          <Route element={<PrivateLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/categorias" element={<CategoriasPage />} />
            <Route path="/formas-pagamento" element={<FormasPagamentoPage />} />
            <Route path="/transacoes" element={<TransacoesPage />} />
            <Route path="/usuarios" element={<UsuariosPage />} />
            <Route path="/lembretes" element={<LembretesPage />} />
            <Route path="/milhas" element={<MilhasPage />} />
            <Route path="/investimentos" element={<InvestimentosPage />} />
            <Route path="/investimentos/mercado" element={<InvestimentosMercadoPage />} />
            <Route path="/relatorios" element={<RelatoriosPage />} />
            <Route path="/relatorios/:id" element={<RelatorioDetalhePage />} />
            <Route path="/documentos" element={<DocumentosPage />} />
            <Route path="/viagens" element={<ViagensPage />} />
            <Route path="/ia" element={<IaPage />} />
            <Route path="/importacao" element={<ImportacaoPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
