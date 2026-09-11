## Objetivo

Adicionar confirmação manual dos pagamentos na tabela “Folha por funcionário”, com confirmação em massa do VA e cálculo consistente do valor exibido.

## Alterações

### 1. Confirmação por lançamento
- Adicionar à célula de cada tipo de pagamento (`adiantamento`, `saldo`, `vt`, `va` e `cesta`) a ação discreta “confirmar pago” quando o lançamento estiver `pendente` e fora de lote.
- Abrir um popover com data preenchida com hoje e observação opcional.
- Confirmar pela RPC `rh_folha_marcar_pago`, enviando sempre o id dentro de `p_ids`.
- Para pagamentos manuais já `pago` e sem `lote_id`, revelar “desfazer” ao passar o mouse e chamar `rh_folha_desmarcar_pago`.
- Preservar o estado “no lote” sem ações manuais quando o status for `em_lote`.
- Atualizar a folha após confirmar ou desfazer e exibir erros no padrão atual da área de RH.

### 2. Confirmação mensal do VA
- Adicionar “Confirmar VA do mês” no cabeçalho da tabela.
- A primeira ação chamará obrigatoriamente `rh_folha_confirmar_tipo` com `p_tipo: 'va'` e `p_simular: true`.
- Exibir um modal com quantidade, valor total, lista de funcionárias/valores/formas, aviso de itens em lote ignorados, data e observação.
- Somente o botão final do modal chamará a mesma RPC com `p_simular: false`.
- Desabilitar ações durante as chamadas e recarregar a folha após concluir.

### 3. Regra única de valor
- Usar em toda a tela o valor efetivo `valor_override ?? valor_liquido ?? valor_bruto ?? 0`.
- Corrigir células e somas locais, inclusive a preparação do lote PIX, para não subcontar lançamentos sem `valor_liquido`.
- Quando os totais agregados retornados pelo backend não refletirem essa regra, calcular os totais visíveis por tipo a partir dos lançamentos carregados.

### 4. Tipagem e validação
- Incluir `lote_id` no formato de pagamento recebido pela folha.
- Validar por checagem TypeScript e testes direcionados da interface/RPCs sem alterar o banco.
