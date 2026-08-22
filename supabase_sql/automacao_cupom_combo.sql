-- Automação de resposta: link de combo e cupom
-- Rodar no SQL Editor do Supabase externo (ezdtulcrqzmgocamjwwl).
-- Os 4 campos alimentam a Edge Function instagram-gerar-respostas e são
-- persistidos na tabela de cada modal.

-- Modal "Produtos e automação do post" (post já publicado)
alter table public.instagram_post_automacao
  add column if not exists link_combo text,
  add column if not exists cupom text,
  add column if not exists cupom_beneficio text,
  add column if not exists cupom_validade text;

-- Modal "Nova publicação" (agendamento/rascunho)
alter table public.instagram_publicacoes
  add column if not exists link_combo text,
  add column if not exists cupom text,
  add column if not exists cupom_beneficio text,
  add column if not exists cupom_validade text;
