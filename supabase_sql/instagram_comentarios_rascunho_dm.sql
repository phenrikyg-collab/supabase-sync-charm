-- Rascunho da Anna para o Direct + status de comentário apagado
-- Rodar no SQL Editor do Supabase externo (ezdtulcrqzmgocamjwwl).

-- A Anna passa a gerar DUAS respostas por comentário: a pública (curta, sem
-- preço nem link) fica em resposta_rascunho, e a mensagem do Direct (preço,
-- link, cupom) fica nesta coluna. O painel exibe cada uma no seu campo.
alter table public.instagram_comentarios
  add column if not exists resposta_rascunho_dm text;

comment on column public.instagram_comentarios.resposta_rascunho_dm is
  'Rascunho da Anna para a mensagem de Direct (preço, link e cupom). A resposta pública continua em resposta_rascunho.';

-- Status 'removido': o comentário não existe mais no Instagram (a cliente
-- apagou, ou editou o texto — editar troca o id do comentário). O backend
-- (instagram-enviar) marca automaticamente quando a Graph devolve
-- "Object with ID ... does not exist". O painel mostra esmaecido, com selo
-- "apagado no Instagram", sem botões de resposta.
