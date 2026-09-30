# Decisões técnicas

- Os blocos prioritários do painel da cliente ficam em `PerfilCliente`, inclusive o histórico de trocas consultado pela conversa; assim a ordem é idêntica no painel fixo e na gaveta móvel.
- A aba `ReembolsosTab` é compartilhada por `/trocas-site` e `/comercial/trocas-devolucoes`, com a query `trocas-reembolsos`; assim as ações e os dados permanecem iguais nas duas telas.