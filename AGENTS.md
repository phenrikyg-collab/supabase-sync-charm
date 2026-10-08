# Decisões técnicas

- Os blocos prioritários do painel da cliente ficam em `PerfilCliente`, inclusive o histórico de trocas consultado pela conversa; assim a ordem é idêntica no painel fixo e na gaveta móvel.
- A aba `ReembolsosTab` é compartilhada por `/trocas-site` e `/comercial/trocas-devolucoes`, com a query `trocas-reembolsos`; assim as ações e os dados permanecem iguais nas duas telas.
- Atendimento banners belong inside a column or in the vertical tab layout, never beside the horizontal panel group; this prevents notices from consuming a conversation column.
- Evaluation date displays use the shared dataBr helpers, re-exported by evaluation libraries; this centralizes locale and timezone handling without changing queries.