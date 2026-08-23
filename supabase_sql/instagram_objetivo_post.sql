-- Objetivo do post na automação de resposta:
--   venda    → comentário vira lead, a Anna chama no Direct (usa card/cupom/link de combo)
--   conversa → dica/bastidor/relacionamento, a Anna responde só no comentário
-- Padrão "conversa": mais fácil corrigir para venda do que desfazer abordagem comercial errada.
-- Rodar no SQL Editor do Supabase (backend externo) se o app acusar que a coluna falta.
alter table public.instagram_publicacoes
  add column if not exists objetivo text not null default 'conversa'
  check (objetivo in ('venda', 'conversa'));

alter table public.instagram_post_automacao
  add column if not exists objetivo text not null default 'conversa'
  check (objetivo in ('venda', 'conversa'));
