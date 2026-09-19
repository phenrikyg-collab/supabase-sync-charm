# Atendimento móvel para uso com uma mão

## Objetivo
Adaptar apenas a apresentação de `/atendimento` em telas abaixo de 768 px, mantendo o desktop, as consultas, mutações, envio otimista, busca e paginação exatamente compartilhados.

## Implementação
1. **Estrutura móvel e navegação**
   - Usar `useIsMobile` para alternar somente o arranjo visual.
   - Em Conversas, mostrar lista ou chat conforme a conversa selecionada, nunca as duas ao mesmo tempo.
   - Ao abrir um chat no celular, inserir uma entrada no histórico; voltar/gesto limpa a seleção e retorna à lista.
   - Preservar o acesso direto por `?conversa=<id>` e a busca da conversa fora da lista.

2. **Abas compactas**
   - Exibir Conversas e Oportunidades no topo.
   - Colocar as outras dez opções em um Sheet inferior com os mesmos contadores e troca de aba já existentes.

3. **Lista de conversas**
   - Reorganizar busca e filtros no topo fixo da lista.
   - Adaptar `ItemConversa` por propriedade visual móvel, sem duplicar ações ou filtros.
   - Garantir itens de pelo menos 64 px, prévia em uma linha, horário e não lida à direita, no máximo dois selos compactos.
   - Priorizar conversas esperando na fila e mostrar o tempo de espera.
   - Manter uma única área de rolagem.

4. **Chat móvel**
   - Cabeçalho de 56 px com voltar, nome/status e menu de ferramentas.
   - Reutilizar a área de mensagens, paginação e âncora atuais.
   - Manter o mesmo `Composer`, adaptando-o por propriedade móvel: botão `+`, campo de até quatro linhas e envio redondo de 44 px.
   - O `+` abre Sheet com os controles existentes de figurinhas, imagem, template e respostas rápidas.
   - Exibir “Assumir conversa” acima do composer quando necessário; deixar “Resolver” somente na gaveta.

5. **Gaveta de ferramentas**
   - Reutilizar perfil, tags, conferir número, frete, Pix, catálogo, carrinho, provador e links de pagamento em Sheet inferior de 85% da tela.
   - Incluir no topo as ações já existentes da conversa, sem criar lógica paralela.

6. **Altura, teclado e segurança visual**
   - Ajustar o contêiner móvel com `100dvh`, descontando cabeçalho e barra de instalação conforme o espaço real disponível.
   - Composer sticky, com `env(safe-area-inset-bottom)` e sem rolagem horizontal.
   - Alvos móveis de pelo menos 44 px.

7. **Validação**
   - Rodar o typecheck.
   - Conferir em Playwright celular: lista, abertura/voltar, abas/mais, gaveta e estrutura do chat.
   - Conferir em desktop que as três colunas redimensionáveis permanecem iguais.
   - Confirmar por código e interação que busca ampla e paginação de 80 mensagens continuam no mesmo fluxo.

## Limites
- Nenhuma alteração no banco, RPCs, funções ou service worker.
- Nenhuma biblioteca nova.
- Nenhuma duplicação da lógica de mensagens, queries ou ações.
- Nenhuma mudança visual ou comportamental no desktop.
