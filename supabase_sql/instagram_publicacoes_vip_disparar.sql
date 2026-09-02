-- Integração Publicações → Grupo VIP.
-- Rodar no SQL Editor do Supabase (backend externo) se o app acusar que a coluna falta.

-- Decisão tomada na tela de agendamento: disparar sozinho ou deixar como rascunho no VIP.
alter table public.instagram_publicacoes
  add column if not exists vip_disparar boolean not null default false;

-- Preenchido pelo backend depois que o post vai ao ar (somente leitura no app).
alter table public.instagram_publicacoes
  add column if not exists vip_mensagem_id uuid;
