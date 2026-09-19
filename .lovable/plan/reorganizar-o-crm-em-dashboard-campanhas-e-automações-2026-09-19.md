# Reorganizar o CRM em Dashboard, Campanhas e Automações

## Resultado
- Transformar `/automacoes` em uma visão de CRM com três abas no topo: **Dashboard** como padrão, **Campanhas** e **Automações**.
- Manter a gestão atual dos fluxos dentro das duas abas operacionais, sem alterar banco, rotas de edição ou comportamento existente.
- Compartilhar o período entre todas as abas e persistir a escolha na URL.

## Implementação
1. **Dados e período**
   - Consumir `crm_painel` com 7, 30, 90 dias ou intervalo personalizado em `YYYY-MM-DD`.
   - Ler e atualizar `?dias=` ou `?de=&ate=` sem perder a aba atual.
   - Adicionar carregamento com skeleton e erro com ação de tentar novamente.

2. **Dashboard**
   - Criar os seis indicadores principais, os resumos de Campanhas e Automações com troca direta de aba, gráfico diário de receita e custo, tabela por canal, Top 5 por receita e o texto do modelo de atribuição.
   - Aplicar formatação brasileira e cores semânticas de ROAS: vermelho abaixo de 1, âmbar de 1 a 3 e verde acima de 3.

3. **Campanhas e Automações**
   - Exibir os indicadores agregados de cada grupo.
   - Preservar acima da tabela a gestão atual de fluxos, filtrando campanhas por gatilho manual/agendado e automações pelos demais gatilhos.
   - Na aba Campanhas, abrir “Novo” com o gatilho manual já selecionado.
   - Criar tabela pesquisável e ordenável por todas as colunas, com taxas nulas exibidas como “–”.
   - Abrir uma gaveta lateral ao clicar em uma linha, com todos os indicadores, custos por categoria e acesso ao fluxo quando houver.

4. **Custos e atribuição**
   - Consumir `crm_custos_listar` no diálogo de engrenagem.
   - Permitir editar cotação, janelas e custos por canal/categoria.
   - Salvar por `crm_custos_salvar` e recarregar o painel após sucesso.

## Detalhes técnicos
- Reutilizar os componentes atuais de botão, abas, tabela, diálogo, gaveta, skeleton e gráficos.
- Separar a nova página em componentes focados para manter a gestão de fluxos isolada das visões analíticas.
- Não criar SQL, função, tabela, migration ou dependência nova.
- Validar tipos e o carregamento visual da página em desktop e mobile.
