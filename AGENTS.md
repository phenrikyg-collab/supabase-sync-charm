# Decisões técnicas

- WhatsApp client fichas use a conversation-keyed component above the message scroller, with manual generation and no automatic refetch; this isolates conversation state and keeps messages accessible.

- Request closure uses the existing Reversa RPC wrappers inside the shared PainelSolicitacao; this keeps closure actions and refresh behavior identical wherever the panel appears.

- Os blocos prioritários do painel da cliente ficam em `PerfilCliente`, inclusive o histórico de trocas consultado pela conversa; assim a ordem é idêntica no painel fixo e na gaveta móvel.
- A aba `ReembolsosTab` é compartilhada por `/trocas-site` e `/comercial/trocas-devolucoes`, com a query `trocas-reembolsos`; assim as ações e os dados permanecem iguais nas duas telas.
- Atendimento banners belong inside a column or in the vertical tab layout, never beside the horizontal panel group; this prevents notices from consuming a conversation column.
- Evaluation date displays use the shared dataBr helpers, re-exported by evaluation libraries; this centralizes locale and timezone handling without changing queries.
- STORIES batches in the publication modal reuse story validation and ordering, upload through a three-worker queue, and save sequentially through fn_publicacao_salvar with a stable key per media; this preserves one publication per story and safe save retries.