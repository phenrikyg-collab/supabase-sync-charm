

## Plano de Correção Completa — Fluxo de Cartão de Crédito

### Diagnóstico dos Problemas Encontrados

Após auditoria completa do código, identifiquei **7 problemas críticos**:

1. **Duas rotas de importação divergentes** — `/importar` (ImportarPage + ImportacaoLancamentos + RevisaoLancamentos) e `/importar-extrato` (ImportarExtrato). A rota do menu lateral (`/importar`) **não tem suporte a cartão de crédito** — salva tudo com `status_pagamento: "pago"`, sem `conta_tipo`, sem `fatura_id`, sem flags DRE/fluxo.

2. **RevisaoLancamentos.tsx** salva todos os registros com `status_pagamento: "pago"` e `origem: "importacao"` — **sem nenhum tratamento de cartão**.

3. **DashboardFinanceiro.tsx** busca cartão com `origem === "cartao_credito"` (linha 102), mas a importação salva como `origem: "extrato_cartao"` — **nunca exibe o valor de cartão**.

4. **ContasPagar.tsx** verifica `origem === "cartao_credito"` para badge (linha 873) — **nunca mostra o indicador visual**.

5. **ImportarExtrato.tsx** (`/importar-extrato`) tem a lógica de cartão correta, mas **não está vinculada ao menu lateral** — o menu aponta para `/importar`.

6. **Trigger `trg_atualizar_saldo_fatura` existe na migration mas não aparece em db-triggers** — precisa ser verificado se está ativo.

7. **Nenhuma validação pós-importação** garante que todas as movimentações de cartão tenham `fatura_id` preenchido.

---

### Plano de Implementação

#### 1. Unificar rota de importação no menu

**Arquivo:** `src/components/AppSidebar.tsx`
- Alterar a URL de "Importar Extrato" de `/importar` para `/importar-extrato`

**Arquivo:** `src/App.tsx`
- Manter ambas as rotas funcionando, mas o menu apontará para `/importar-extrato`

#### 2. Adicionar modo Cartão na rota `/importar` (ImportacaoLancamentos + RevisaoLancamentos)

**Arquivo:** `src/components/ImportacaoLancamentos.tsx`
- Adicionar toggle "Cartão de Crédito" com campos obrigatórios: nome do cartão e vencimento da fatura
- Passar esses dados junto com os lançamentos para o componente pai

**Arquivo:** `src/pages/ImportarPage.tsx`
- Propagar dados de cartão (cartaoNome, faturaVencimento) entre ImportacaoLancamentos e RevisaoLancamentos

**Arquivo:** `src/components/RevisaoLancamentos.tsx`
- Receber dados de cartão como props opcionais
- Se for cartão: ao salvar, criar/localizar fatura em `cartoes_faturas` antes de inserir
- Definir corretamente para cada movimentação:
  - `conta_tipo = 'cartao_fatura'`
  - `fatura_id = ID da fatura`
  - `impacta_dre = true`
  - `impacta_fluxo = false`
  - `status_pagamento = 'em_aberto'`
  - `tipo = 'saida'`
- Buscar/criar categoria padrão "não classificadas" como fallback para itens sem `categoria_id`

#### 3. Corrigir filtros de detecção de cartão em outras telas

**Arquivo:** `src/pages/DashboardFinanceiro.tsx`
- Linha 102: trocar `origem === "cartao_credito"` por `conta_tipo === "cartao_fatura"` para detectar corretamente o valor de cartão no mês

**Arquivo:** `src/pages/ContasPagar.tsx`
- Linha 873: trocar `origem === "cartao_credito"` por `conta_tipo === "cartao_fatura"` para o badge visual

#### 4. Garantir trigger ativo no banco

**Migration SQL:**
- Criar migration que faz `CREATE TRIGGER IF NOT EXISTS` (ou `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`) para garantir que `trg_atualizar_saldo_fatura` está ativo na tabela `movimentacoes_financeiras`

#### 5. Manter compatibilidade

- Importações antigas (sem cartão) continuam funcionando normalmente — `impacta_dre = true` e `impacta_fluxo = true` são os defaults da coluna
- A rota `/importar-extrato` permanece funcional como alternativa
- Nenhuma alteração em triggers existentes, DRE, ou fluxo de pagamento de fatura

---

### Resumo das alterações por arquivo

| Arquivo | Alteração |
|---------|-----------|
| `AppSidebar.tsx` | Menu → `/importar-extrato` |
| `ImportacaoLancamentos.tsx` | Adicionar modo cartão (nome + vencimento) |
| `ImportarPage.tsx` | Propagar dados cartão entre etapas |
| `RevisaoLancamentos.tsx` | Criar fatura + flags corretas ao salvar cartão |
| `DashboardFinanceiro.tsx` | Fix filtro cartão: `conta_tipo` em vez de `origem` |
| `ContasPagar.tsx` | Fix badge cartão: `conta_tipo` em vez de `origem` |
| Migration SQL | Garantir trigger ativo |

