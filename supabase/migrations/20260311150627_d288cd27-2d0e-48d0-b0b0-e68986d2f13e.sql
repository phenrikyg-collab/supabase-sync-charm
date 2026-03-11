
-- Produtos
CREATE TABLE IF NOT EXISTS public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_do_produto TEXT NOT NULL,
  codigo_sku TEXT,
  preco_venda NUMERIC,
  preco_custo NUMERIC,
  margem_real_percentual NUMERIC,
  ativo BOOLEAN DEFAULT true,
  consumo_de_tecido NUMERIC,
  tipo_do_produto TEXT,
  tecido_do_produto TEXT,
  bling_id TEXT,
  bling_produto_id BIGINT,
  custo_bling NUMERIC,
  origem_custo TEXT,
  atualizado_em TEXT,
  updated_from_bling TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read produtos" ON public.produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert produtos" ON public.produtos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update produtos" ON public.produtos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete produtos" ON public.produtos FOR DELETE TO authenticated USING (true);

-- Ordens de corte
CREATE TABLE IF NOT EXISTS public.ordens_corte (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_oc TEXT NOT NULL,
  grade_tamanhos TEXT[] DEFAULT '{}',
  metragem_risco NUMERIC DEFAULT 0,
  metragem_total_utilizada NUMERIC,
  quantidade_folhas INTEGER,
  status TEXT DEFAULT 'Planejada',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.ordens_corte ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read ordens_corte" ON public.ordens_corte FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert ordens_corte" ON public.ordens_corte FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update ordens_corte" ON public.ordens_corte FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete ordens_corte" ON public.ordens_corte FOR DELETE TO authenticated USING (true);

-- Ordens corte grade
CREATE TABLE IF NOT EXISTS public.ordens_corte_grade (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_corte_id UUID REFERENCES public.ordens_corte(id),
  cor_id UUID,
  tamanho TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.ordens_corte_grade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read oc_grade" ON public.ordens_corte_grade FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert oc_grade" ON public.ordens_corte_grade FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth delete oc_grade" ON public.ordens_corte_grade FOR DELETE TO authenticated USING (true);

-- Ordens corte produtos
CREATE TABLE IF NOT EXISTS public.ordens_corte_produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_corte_id UUID REFERENCES public.ordens_corte(id),
  produto_id UUID,
  nome_produto TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.ordens_corte_produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read oc_produtos" ON public.ordens_corte_produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert oc_produtos" ON public.ordens_corte_produtos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth delete oc_produtos" ON public.ordens_corte_produtos FOR DELETE TO authenticated USING (true);

-- Ordens corte rolos
CREATE TABLE IF NOT EXISTS public.ordens_corte_rolos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_corte_id UUID REFERENCES public.ordens_corte(id),
  rolo_id UUID REFERENCES public.rolos_tecido(id),
  metragem_utilizada NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.ordens_corte_rolos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read oc_rolos" ON public.ordens_corte_rolos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert oc_rolos" ON public.ordens_corte_rolos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth delete oc_rolos" ON public.ordens_corte_rolos FOR DELETE TO authenticated USING (true);
