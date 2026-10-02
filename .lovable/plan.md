# Fluxos de Direct por post e para anúncios

## Objetivo
Permitir escolher os fluxos de Direct existentes nos posts e no padrão de anúncios, mantendo o texto fixo como alternativa e sem alterar o banco.

## Implementação
- Centralizar a leitura dos fluxos disponíveis usando `ig_dm_fluxos_listar`, excluindo apenas `arquivado` e `rascunho`.
- No bloco de automação de Produtos do Post:
  - adicionar o seletor **Direct do comentário** com **Texto fixo** e os fluxos permitidos;
  - salvar `fluxo_id` junto da automação existente;
  - exibir a explicação do carrossel, o aviso quando o fluxo 9 estiver sem produtos, o botão **Ver fluxo** e o selo **Carrossel** no cartão.
- Refletir o selo **Carrossel** também nos cartões publicados exibidos em Publicações.
- Adicionar à configuração atual do Instagram o seletor **Fluxo para anúncio e reels sem automação**, lendo e atualizando `instagram_config.fluxo_sem_automacao_id` na linha `id = 1`.
- Fazer **Ver fluxo** abrir diretamente o fluxo escolhido no editor já existente dentro da aba Live, usando parâmetros da própria URL para preservar a navegação.
- Na aba Comentários, trocar o selo técnico `fluxo:<id>` por **Fluxo de Direct**; os demais selos permanecem iguais.

## Validação
- Conferir seleção, salvamento e reabertura do fluxo por post.
- Conferir fluxo 9 com e sem produto vinculado, além do selo Carrossel.
- Conferir o fluxo padrão de anúncios, inclusive a opção sem fluxo.
- Conferir o link para o editor e o selo nos comentários.
- Rodar os testes relevantes e a verificação de tipos, sem mudanças no banco.

## Detalhes técnicos
- Nenhuma tabela, função ou migração será criada.
- As escritas ficam limitadas a `instagram_post_automacao.fluxo_id` e `instagram_config.fluxo_sem_automacao_id`.
- O editor da Live aceitará os parâmetros de navegação necessários para abrir um fluxo existente, sem duplicar o construtor.
