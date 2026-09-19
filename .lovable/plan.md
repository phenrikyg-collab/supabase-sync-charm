# Encerrar e recolher cobranças no Atendimento

## Implementação
- Adicionar ação discreta de encerramento aos cards Pix e links ainda não pagos.
- Confirmar em diálogo com valor e aviso de que a operação não cancela no banco nem no gateway.
- Chamar as RPCs existentes, exibir o erro retornado e atualizar imediatamente as duas listas da conversa.
- No celular, reunir Pix e links em uma única linha recolhida por padrão, com contagens e expansão limitada a 40% da tela.
- Manter no desktop os dois blocos e sua apresentação atual.

## Validação
- Rodar o typecheck.
- Conferir no navegador celular o estado recolhido, a expansão rolável e a ausência da linha quando não há cobranças.
- Conferir que o desktop mantém os dois blocos separados.
