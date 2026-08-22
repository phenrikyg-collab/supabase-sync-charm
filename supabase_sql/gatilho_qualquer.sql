-- Adiciona a flag "Responder qualquer comentário" nos dois lugares onde
-- a automação de resposta é salva:
--   instagram_post_automacao (modal do post já publicado)
--   instagram_publicacoes   (modal de nova publicação / agendamento)
-- Rode este script no SQL Editor do Supabase (banco externo).

ALTER TABLE public.instagram_post_automacao
  ADD COLUMN IF NOT EXISTS gatilho_qualquer boolean NOT NULL DEFAULT false;

ALTER TABLE public.instagram_publicacoes
  ADD COLUMN IF NOT EXISTS gatilho_qualquer boolean NOT NULL DEFAULT false;
