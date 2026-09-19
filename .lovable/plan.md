# Unificar fluxos e desempenho em uma lista

## Resultado
- Remover os cards de fluxo das abas Campanhas e Automações.
- Exibir todos os fluxos em uma única tabela de desempenho, inclusive os que ainda não rodaram.
- Adicionar Pessoas aos indicadores, à tabela e ao detalhamento lateral.

## Implementação
1. Juntar a lista de fluxos com os dados de `crm_painel` pela chave `fluxo:{id}`, preservando fluxos sem métricas e itens analíticos sem fluxo associado.
2. Levar descrição, canais, status e todas as ações de gestão para cada linha da tabela.
3. Manter busca, filtros de status, ordenação, gaveta de indicadores e botão Novo na área acima da tabela.
4. Adicionar Pessoas antes de Enviados nos indicadores e na tabela, com explicação da conversão no cabeçalho.
5. Mostrar “ainda não rodou” quando não houver período e “X pessoas · Y mensagens enviadas” na gaveta.
6. Validar tipos e o resultado visual em desktop e celular, sem alterar o backend.
