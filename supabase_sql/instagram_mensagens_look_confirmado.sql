-- Confirmação manual da peça em menções a story com confiança média/baixa.
-- O painel (Social Commerce > Atendimento) grava aqui quando a equipe escolhe
-- o produto na mão; a view vw_ig_mensagens_painel pode dar COALESCE com a
-- resolução automática do sticker/análise.

alter table public.instagram_mensagens
  add column if not exists look_produto_confirmado_id uuid references public.produtos(id);

comment on column public.instagram_mensagens.look_produto_confirmado_id is
  'Produto confirmado manualmente pela equipe para mensagens de menção a story em que a análise de imagem teve confiança média/baixa.';

-- Sugestão: na view, priorizar a confirmação manual:
--   coalesce(m.look_produto_confirmado_id, <resolucao_automatica>) as story_produto_id
