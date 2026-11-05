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

import { MetasVisaoGeralPage } from '@/features/metas/pages/MetasVisaoGeralPage'
import { MinhasMetasPage } from '@/features/metas/pages/MinhasMetasPage'
import { MetaFormPage } from '@/features/metas/pages/MetaFormPage'
import { MetaDetalhePage } from '@/features/metas/pages/MetaDetalhePage'
import { MetasAnalisesPage } from '@/features/metas/pages/MetasAnalisesPage'
import { MetasAlertasPage } from '@/features/metas/pages/MetasAlertasPage'

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

            {/* Módulo Metas de Gastos (6 Telas) */}
            <Route path="/metas" element={<MetasVisaoGeralPage />} />
            <Route path="/metas/lista" element={<MinhasMetasPage />} />
            <Route path="/metas/nova" element={<MetaFormPage />} />
            <Route path="/metas/:id" element={<MetaDetalhePage />} />
            <Route path="/metas/:id/editar" element={<MetaFormPage />} />
            <Route path="/metas/analises" element={<MetasAnalisesPage />} />
            <Route path="/metas/alertas" element={<MetasAlertasPage />} />

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
