# Corrigir o Desfazer sem trocar a destinatária

## Implementação
- Criar um objeto de envio congelado no clique, contendo texto, conversa, telefone, canal, autora e cópia completa da citação.
- Alterar `enviar` para receber esse objeto e usar somente seus campos no envio, no balão temporário, nas falhas e nas atualizações da conversa correta.
- Limpar a citação no clique e restaurá-la, junto ao texto, quando a atendente usar Desfazer.
- Fazer os auxiliares de balão e falha receberem explicitamente a conversa de destino.
- Aplicar o mesmo congelamento a imagem, vídeo, produto e reenvio.

## Validação
- Verificar os tipos do projeto.
- Simular envio e citação na conversa A, trocar imediatamente para B e confirmar que nenhum balão ou envio é associado a B.

## Detalhes técnicos
A nova assinatura será baseada em `enviar.mutate({ conteudo, conversaId, telefone, site, citacao, autor })`, sem leitura tardia da conversa ou citação exibida.
