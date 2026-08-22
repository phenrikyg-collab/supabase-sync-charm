-- Capa própria para Reels/vídeo de feed: imagem enviada (vira cover_url) ou
-- frame do vídeo em milissegundos (vira thumb_offset). Se os dois estiverem
-- preenchidos, a imagem é a que vale. Stories não usa — o bloco nem aparece.
-- Rodar no SQL Editor do Supabase (backend externo) se o app acusar que as colunas faltam.
alter table public.instagram_publicacoes
  add column if not exists capa_url text,
  add column if not exists capa_offset_ms integer;
