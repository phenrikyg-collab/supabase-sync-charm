
-- Oficinas
CREATE TABLE IF NOT EXISTS public.oficinas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_oficina TEXT,
  tipo_oficina TEXT,
  custo_por_peca NUMERIC,
  contato TEXT,
  observacao TEXT,
  is_interna BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.oficinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read oficinas" ON public.oficinas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert oficinas" ON public.oficinas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update oficinas" ON public.oficinas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete oficinas" ON public.oficinas FOR DELETE TO authenticated USING (true);

-- Ordens de produção
CREATE TABLE IF NOT EXISTS public.ordens_producao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID,
  cor_id UUID,
  oficina_id UUID REFERENCES public.oficinas(id),
  ordem_corte_id UUID REFERENCES public.ordens_corte(id),
  nome_produto TEXT,
  quantidade INTEGER,
  quantidade_pecas_ordem INTEGER,
  status_ordem TEXT DEFAULT 'Corte',
  data_inicio DATE,
  data_fim DATE,
  data_previsao_termino DATE,
  metragem_consumida NUMERIC,
  metragem_tecido_utilizada NUMERIC,
  tecido_id UUID,
  entrada_tecido_id UUID,
  risco_id UUID,
  pagamento_oficina_status TEXT,
  custo_estimado_peca NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.ordens_producao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read ordens_producao" ON public.ordens_producao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert ordens_producao" ON public.ordens_producao FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update ordens_producao" ON public.ordens_producao FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete ordens_producao" ON public.ordens_producao FOR DELETE TO authenticated USING (true);

-- Consertos
CREATE TABLE IF NOT EXISTS public.consertos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_producao_id UUID NOT NULL REFERENCES public.ordens_producao(id),
  cor_id UUID,
  tamanho TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  oficina_id UUID,
  observacao TEXT,
  status TEXT DEFAULT 'Em Conserto',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.consertos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read consertos" ON public.consertos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert consertos" ON public.consertos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update consertos" ON public.consertos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete consertos" ON public.consertos FOR DELETE TO authenticated USING (true);

-- Custo fixo oficina
CREATE TABLE IF NOT EXISTS public.custo_fixo_oficina (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mes TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.custo_fixo_oficina ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read custo_fixo" ON public.custo_fixo_oficina FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert custo_fixo" ON public.custo_fixo_oficina FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update custo_fixo" ON public.custo_fixo_oficina FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
