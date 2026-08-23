-- Resposta completa (pergunta de preço) e fallback sem Direct
-- Rodar no SQL Editor do Supabase externo (ezdtulcrqzmgocamjwwl).

-- 4.4 — Resposta completa: usada quando a cliente pergunta preço.
-- Guardar SEMPRE com marcadores ({PRODUTO} {PRECO} {PARCELAS} {PARCELA}
-- {PIX} {PIX_PCT} {BIO} {CUPOM_FRASE}), nunca com o valor cravado:
-- preço mudou na Tray, a resposta muda junto. Vazio = as 4 padrão da Anna.
alter table public.instagram_post_automacao
  add column if not exists respostas_publicas_compra text[],
  add column if not exists respostas_publicas_fallback text[];

alter table public.instagram_publicacoes
  add column if not exists respostas_publicas_compra text[],
  add column if not exists respostas_publicas_fallback text[];

comment on column public.instagram_post_automacao.respostas_publicas_compra is
  'Variações da resposta completa (pergunta de preço), com marcadores {PRODUTO} {PRECO} {PARCELAS} {PARCELA} {PIX} {PIX_PCT} {BIO} {CUPOM_FRASE}. Nulo = 4 padrão.';
comment on column public.instagram_post_automacao.respostas_publicas_fallback is
  'Variações usadas só quando a Meta recusa a mensagem privada. Sem promessa de Direct, sem preço/cupom/link. Nulo = 4 padrão.';
comment on column public.instagram_publicacoes.respostas_publicas_compra is
  'Variações da resposta completa (pergunta de preço), com marcadores {PRODUTO} {PRECO} {PARCELAS} {PARCELA} {PIX} {PIX_PCT} {BIO} {CUPOM_FRASE}. Nulo = 4 padrão.';
comment on column public.instagram_publicacoes.respostas_publicas_fallback is
  'Variações usadas só quando a Meta recusa a mensagem privada. Sem promessa de Direct, sem preço/cupom/link. Nulo = 4 padrão.';
