
-- Tabela de cores
CREATE TABLE IF NOT EXISTS public.cores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_cor TEXT,
  cor_hex TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.cores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read cores" ON public.cores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert cores" ON public.cores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update cores" ON public.cores FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users can delete cores" ON public.cores FOR DELETE TO authenticated USING (true);

-- Tabela de tecidos
CREATE TABLE IF NOT EXISTS public.tecidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_tecido TEXT,
  custo_por_metro NUMERIC,
  fornecedor TEXT,
  metragem_estoque NUMERIC,
  rendimento_metro_por_kg NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.tecidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read tecidos" ON public.tecidos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert tecidos" ON public.tecidos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update tecidos" ON public.tecidos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users can delete tecidos" ON public.tecidos FOR DELETE TO authenticated USING (true);

-- Tabela de entradas de tecido (NF)
CREATE TABLE IF NOT EXISTS public.entradas_tecido (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_nf INTEGER,
  fornecedor TEXT,
  data_entrada DATE,
  valor_total NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.entradas_tecido ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read entradas_tecido" ON public.entradas_tecido FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert entradas_tecido" ON public.entradas_tecido FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update entradas_tecido" ON public.entradas_tecido FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users can delete entradas_tecido" ON public.entradas_tecido FOR DELETE TO authenticated USING (true);

-- Tabela de rolos de tecido
CREATE TABLE IF NOT EXISTS public.rolos_tecido (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tecido_id UUID REFERENCES public.tecidos(id),
  cor_id UUID REFERENCES public.cores(id),
  cor_nome TEXT,
  cor_hex TEXT,
  codigo_rolo TEXT,
  metragem_inicial NUMERIC,
  metragem_disponivel NUMERIC,
  peso_kg NUMERIC,
  custo_por_metro NUMERIC,
  fornecedor TEXT,
  status_rolo TEXT DEFAULT 'disponivel',
  entrada_id UUID,
  entrada_tecido_id UUID REFERENCES public.entradas_tecido(id),
  lote TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.rolos_tecido ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read rolos_tecido" ON public.rolos_tecido FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert rolos_tecido" ON public.rolos_tecido FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update rolos_tecido" ON public.rolos_tecido FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users can delete rolos_tecido" ON public.rolos_tecido FOR DELETE TO authenticated USING (true);

-- Categorias financeiras
CREATE TABLE IF NOT EXISTS public.categorias_financeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_categoria TEXT,
  descricao_categoria TEXT,
  tipo TEXT,
  codigo TEXT,
  grupo_dre TEXT,
  ordem_exibicao INTEGER,
  categoria_pai_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read categorias" ON public.categorias_financeiras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert categorias" ON public.categorias_financeiras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update categorias" ON public.categorias_financeiras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users can delete categorias" ON public.categorias_financeiras FOR DELETE TO authenticated USING (true);

-- Centros de custo
CREATE TABLE IF NOT EXISTS public.centros_custos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_centro TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.centros_custos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read centros" ON public.centros_custos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert centros" ON public.centros_custos FOR INSERT TO authenticated WITH CHECK (true);

-- Movimentações financeiras
CREATE TABLE IF NOT EXISTS public.movimentacoes_financeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT,
  descricao TEXT,
  valor NUMERIC NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  categoria_id UUID REFERENCES public.categorias_financeiras(id),
  centro_custo_id UUID REFERENCES public.centros_custos(id),
  origem TEXT,
  cliente TEXT,
  bling_pedido_id TEXT,
  status_bling TEXT,
  valor_bruto NUMERIC,
  valor_desconto NUMERIC,
  valor_frete NUMERIC,
  valor_liquido NUMERIC,
  valor_produtos_bruto NUMERIC,
  valor_total_pago NUMERIC,
  data_envio DATE,
  codigo_rastreamento TEXT,
  entrada_tecido_id UUID REFERENCES public.entradas_tecido(id),
  parcela_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.movimentacoes_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read movimentacoes" ON public.movimentacoes_financeiras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert movimentacoes" ON public.movimentacoes_financeiras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update movimentacoes" ON public.movimentacoes_financeiras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users can delete movimentacoes" ON public.movimentacoes_financeiras FOR DELETE TO authenticated USING (true);
