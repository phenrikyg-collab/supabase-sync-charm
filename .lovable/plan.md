# Editor completo do passo WhatsApp janela aberta

## Implementação
- Substituir o formulário simples do passo por um editor de mensagem com escolha explícita entre texto, botões, vídeo, link e vitrine.
- Preservar todas as chaves já existentes no `config`, mostrando somente os campos do formato escolhido e limpando apenas combinações que o motor ignoraria.
- Adicionar edição de até três botões, link, vídeo MP4/3GP até 16 MB, vitrine com até 30 `retailer_id`, figurinha e cupom único.
- Manter template reserva, descarte com janela fechada, nome alternativo e envio no fim de semana dentro de uma seção recolhida de Opções.
- Criar uma prévia de conversa com variáveis substituídas, formatação por asteriscos, vídeo, botões e vitrine conforme a precedência real do envio.
- Manter o remapeamento das saídas ligado a `botoes_resposta`, inclusive quando os textos forem adicionados, alterados ou removidos.

## Validação
- Mostrar contadores junto aos campos e bloquear o salvamento quando qualquer limite do WhatsApp for excedido.
- Validar extensões e tamanho no envio de vídeo, além dos limites de texto, botões e produtos.
- Rodar a verificação de tipos e testar a edição e a prévia no navegador.

## Limite encontrado
- `whatsapp_catalogo_ler()` informa o catálogo conectado, mas não devolve a lista de produtos. A vitrine terá campos ordenáveis de `retailer_id`, com aviso de que o primeiro item define a miniatura; nenhuma nova fonte de dados será criada.
