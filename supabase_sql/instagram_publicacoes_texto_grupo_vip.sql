-- Coluna para a mensagem do grupo VIP gerada pela IA junto da legenda.
-- Rodar no SQL Editor do Supabase (backend externo) se o app acusar que a coluna falta.
alter table public.instagram_publicacoes
  add column if not exists texto_grupo_vip text;
