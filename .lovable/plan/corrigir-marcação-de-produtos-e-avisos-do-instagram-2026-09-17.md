# Corrigir marcação de produtos e avisos do Instagram

## Objetivo
Evitar marcação de produto sem peça vinculada e diferenciar visualmente avisos de falhas reais nas publicações e nos stories.

## Alterações
1. **Formulário de publicação**
   - Iniciar `marcar_produtos` desligado quando não houver produtos.
   - Desabilitar o interruptor sem produto vinculado e exibir a orientação solicitada.
   - Ao remover o último produto, desligar a marcação imediatamente e mostrar o aviso em toast.
   - Enviar `marcar_produtos: false` quando a lista estiver vazia.
   - Após salvar, recarregar a publicação salva e sincronizar o formulário com o valor confirmado pelo banco.

2. **Publicações do Instagram**
   - Centralizar a classificação do campo `erro`: vermelho apenas quando `status = falhou`; âmbar nos demais status.
   - Aplicar o critério na lista, nos cards/calendário e no detalhe do formulário.
   - Exibir rótulos claros: “Falhou” para erro real e “Aviso” / “Publicado com um aviso” quando o post já está no ar.
   - Garantir bolinha vermelha somente para falha e âmbar para aviso.

3. **Roteiro de Stories**
   - Tornar a validação de mídia independente de avisos operacionais já gravados.
   - Nos cards, painel do slide e resumo do roteiro, usar vermelho apenas para slide com status `falhou`; usar âmbar para texto em `erro` nos demais status.
   - Manter bloqueios de agendamento somente para mídia realmente inválida ou ausente, sem bloquear por aviso de publicação.

4. **Validação**
   - Conferir os estados sem produto, com produto e após remover o último produto.
   - Conferir publicação publicada/agendada com aviso e publicação falhada.
   - Rodar a checagem de tipos.

## Premissa técnica
O valor devolvido pela releitura da linha após salvar é a fonte final para `marcar_produtos`, pois a trigger pode corrigi-lo no banco.
