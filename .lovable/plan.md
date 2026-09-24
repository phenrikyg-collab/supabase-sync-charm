# Corte -> Produção -> Oficina -> Pagamento

## O que já existe (vai ser reaproveitado, não duplicado)
- **Nova Ordem de Corte** (`/ordens-corte/nova`): já seleciona produtos, cor pelos rolos, grade, risco, rolos com metragem disponível e grava nas 4 tabelas de corte. Hoje o número sai como `OC-0001` (não `OC-YYYY-NNN`) e não gera Ordem de Produção.
- **Ordens de Corte** (`/ordens-corte`): lista, edita, imprime e devolve metragem ao rolo quando exclui.
- **Ordens de Produção** (`/ordens-producao`) e **Pagamento de Oficinas** (`/pagamento-oficinas`): marca pago uma OP por vez e lança saída no financeiro.
- O Avise-me e a Expedição só leem/criam OC por RPCs próprias; ficam como estão.
- Não existe regra de alocação automática entre oficinas, então `oficina_id` fica vazio para o responsável escolher.

## Etapa 1 - Nova Ordem de Corte (melhorar a tela atual)
- Layout para celular/tablet: passos empilhados, campos grandes, barra fixa no rodapé com totais e "Salvar".
- Busca de rolo por **código ou lote**, mostrando metragem disponível antes de escolher; metragem usada por rolo, sem passar do disponível.
- Grade por tamanho x folhas = **peças cortadas por tamanho**, mostrada ao vivo.
- `metragem_total_utilizada` = soma dos rolos, gravada na OC.
- Status inicial à escolha: "Planejada" ou "Cortada".
- Numeração passa a ser `OC-2026-001` (sequência por ano); números antigos continuam válidos.
- Débito do rolo feito no servidor, junto com o salvamento (tudo ou nada).

## Etapa 2 - Geração automática das OPs
- Uma OP por **produto + cor** (o schema de `ordens_producao` não tem tamanho; a grade fica ligada pela `ordem_corte_id`).
- Preenche `produto_id`, `cor_id`, `ordem_corte_id`, `nome_produto`, quantidade = soma da grade x folhas, `status_ordem = 'Corte'`, `oficina_id` vazio.
- Na lista de Ordens de Produção, filtro "Sem oficina" para atribuir rápido.

## Etapa 3 - Portal da oficina
- Novo papel `oficina` e vínculo usuário -> oficina.
- Admin cria o acesso da oficina pela tela de usuários existente, escolhendo a oficina.
- Rota `/portal-oficina`: a oficina vê só as próprias OPs (produto, cor, grade por tamanho, prazo) e dá baixa com quantidade entregue e data. A baixa muda `status_ordem` para "Entregue" e `pagamento_oficina_status` para "A pagar".
- Usuário de oficina entra direto no portal e não vê o resto do sistema.

## Etapa 4 - Fechamento de pagamento (admin)
- Evolução da tela de Pagamento de Oficinas: filtro por período (data de entrega), total por oficina = peças entregues x `custo_por_peca`, detalhe por OP.
- "Marcar como pago" por oficina/período (todas as OPs do grupo) ou por OP, mantendo o lançamento no financeiro que já existe hoje.

## Mudanças no banco (precisam de sua confirmação)
O app usa o banco externo, então as mudanças vão num arquivo SQL em `supabase_sql/`, no mesmo padrão dos anteriores, para você rodar lá:
- `ALTER TYPE app_role ADD VALUE 'oficina'`.
- Tabela `oficina_usuarios (user_id, oficina_id)` com GRANT e RLS.
- Colunas novas em `ordens_producao`: `quantidade_entregue`, `data_entrega`, `data_pagamento`.
- Função `minha_oficina_id()` (security definer) e RLS em `ordens_producao`: admin vê tudo; oficina só lê/atualiza linhas com `oficina_id = minha_oficina_id()`. Leitura da grade e dos produtos/cores liberada só para as OCs dessas OPs.
- RPC `criar_ordem_corte(...)`: numera `OC-YYYY-NNN`, grava OC/grade/produtos/rolos, debita rolos e cria as OPs numa única transação.
- RPC `oficina_dar_baixa(op_id, qtd, data)` e `pagamento_oficinas_marcar_pago(ids[])`.

Isso vai contra a regra antiga de "não alterar o banco"; entendo que este pedido abre a exceção. Até você rodar o SQL, as telas novas mostram um aviso de "configuração pendente".

## Verificação
Testes automáticos do cálculo (peças por tamanho, metragem, agrupamento das OPs, total a pagar) e conferência visual em 390 e 1280 px. O fluxo de ponta a ponta com login real depende de uma conta no banco externo.
