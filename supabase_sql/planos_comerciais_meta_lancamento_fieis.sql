-- Meta de lançamento para fiéis (Plano Comercial)
alter table public.planos_comerciais
  add column if not exists meta_lancamento_fieis_pedidos integer,
  add column if not exists meta_lancamento_fieis_ticket numeric;
