-- Variações da resposta pública (anti-spam): a cada comentário o sistema
-- sorteia uma variação. resposta_gatilho_publica continua sendo gravada
-- com a primeira variação, para compatibilidade com o que já consome o campo.
-- Rodar no SQL Editor do Supabase externo (ezdtulcrqzmgocamjwwl).

-- Modal "Produtos e automação do post" (post já publicado)
alter table public.instagram_post_automacao
  add column if not exists respostas_publicas text[];

-- Modal "Nova publicação" (agendamento/rascunho)
alter table public.instagram_publicacoes
  add column if not exists respostas_publicas text[];
