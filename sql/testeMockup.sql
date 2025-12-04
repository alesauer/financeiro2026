-- limparMockup.sql
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE transacoes;
TRUNCATE TABLE categorias;
SET FOREIGN_KEY_CHECKS = 1;

-- ===============================
-- MOCKUP DE CATEGORIAS (IDs fixos)
-- ===============================

INSERT INTO categorias (id, nome, tipo) VALUES
-- Receitas
(1, 'Salário', 'Receita'),
(2, 'Venda', 'Receita'),
(3, 'Reembolso', 'Receita'),
(4, 'Outros', 'Receita'),

-- Despesas
(5, 'Alimentação', 'Despesa'),
(6, 'Transporte', 'Despesa'),
(7, 'Moradia', 'Despesa'),
(8, 'Saúde', 'Despesa'),
(9, 'Lazer', 'Despesa'),
(10, 'Educação', 'Despesa'),
(11, 'Outros', 'Despesa'),

-- Investimentos
(12, 'Renda Fixa', 'Investimento'),
(13, 'Ações', 'Investimento'),
(14, 'Fundos Imobiliários', 'Investimento'),
(15, 'Criptomoedas', 'Investimento'),
(16, 'Tesouro Direto', 'Investimento'),
(17, 'Outros', 'Investimento');

-- ===============================
-- MOCKUP DE TRANSAÇÕES
-- ===============================
INSERT INTO transacoes (
    tipo, categoria_id, descricao, valor, data_transacao,
    forma_pagamento, status, recorrente, parcelado, parcela_atual, total_parcelas
) VALUES
-- Receitas
('Receita', 1, 'Salário de Setembro', 5000.00, '2025-09-01', 'Transferência', 'Pago', 1, 0, 1, NULL),
('Receita', 2, 'Venda de produto online', 750.00, '2025-09-05', 'Pix', 'Pago', 0, 0, 1, NULL),

-- Despesas
('Despesa', 5, 'Supermercado', 320.00, '2025-09-02', 'Cartão de Débito', 'Pago', 0, 0, 1, NULL),
('Despesa', 6, 'Uber para reunião', 45.00, '2025-09-03', 'Pix', 'Pago', 0, 0, 1, NULL),
('Despesa', 7, 'Aluguel Setembro', 1500.00, '2025-09-01', 'Transferência', 'Pago', 1, 0, 1, NULL),
('Despesa', 8, 'Consulta médica', 250.00, '2025-09-07', 'Cartão de Crédito', 'Pago', 0, 1, 1, 3),

-- Investimentos
('Investimento', 13, 'Compra de ações Petrobras', 1000.00, '2025-09-10', 'Boleto', 'Pago', 0, 0, 1, NULL),
('Investimento', 16, 'Tesouro Selic 2029', 500.00, '2025-09-12', 'Transferência', 'Pago', 0, 0, 1, NULL);
