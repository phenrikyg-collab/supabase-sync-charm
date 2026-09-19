# Instalar o painel e ativar avisos da fila

## Resultado
- Tornar o painel instalável no celular, abrindo diretamente no Atendimento.
- Permitir que cada consultora ative ou desative avisos de novas clientes na fila.
- Abrir automaticamente a conversa indicada ao tocar em uma notificação.

## Implementação
1. Criar os três ícones MC e o manifesto com nome, cores, início em `/atendimento` e suporte adequado a Android e iPhone.
2. Adicionar os metadados de instalação ao cabeçalho e registrar um service worker exclusivo para push, sem qualquer cache ou interceptação de páginas.
3. Criar o controle de instalação para celular, com instalação direta no Android, instrução no iPhone e dispensa por 30 dias.
4. Criar o hook autenticado usando exatamente `app_push_equipe_situacao`, `app_push_equipe_inscrever` e `app_push_equipe_cancelar`, além da chave pública da função `app-push`.
5. Mostrar o card “Avisos no celular” no topo do Atendimento com estados de suporte, permissão, ativação, aparelhos, janela e automação do servidor.
6. Ler `?conversa=<id>`, abrir a conversa carregada ou consultá-la pelo recurso existente de conversa por ID, e limpar o endereço após a seleção.
7. Validar tipos, manifesto, ícones e confirmar que o service worker não contém cache nem tratamento de `fetch`.

## Limites
- Nenhuma alteração no banco ou criação de RPC, tabela ou função.
- Nenhuma mudança no restante do layout do Atendimento.
- O service worker não armazenará arquivos nem páginas para uso offline.
