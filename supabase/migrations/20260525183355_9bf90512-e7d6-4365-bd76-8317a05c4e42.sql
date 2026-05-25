
-- =========================
-- 1. RBAC infrastructure
-- =========================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================
-- 2. Restrict movimentacoes_financeiras to admins
-- =========================
DROP POLICY IF EXISTS "Auth users can read movimentacoes" ON public.movimentacoes_financeiras;
DROP POLICY IF EXISTS "Auth users can insert movimentacoes" ON public.movimentacoes_financeiras;
DROP POLICY IF EXISTS "Auth users can update movimentacoes" ON public.movimentacoes_financeiras;
DROP POLICY IF EXISTS "Auth users can delete movimentacoes" ON public.movimentacoes_financeiras;

CREATE POLICY "Admins read movimentacoes" ON public.movimentacoes_financeiras
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert movimentacoes" ON public.movimentacoes_financeiras
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update movimentacoes" ON public.movimentacoes_financeiras
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete movimentacoes" ON public.movimentacoes_financeiras
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- 3. Add missing UPDATE/DELETE policies (match existing pattern)
-- =========================
CREATE POLICY "Auth users can update centros" ON public.centros_custos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users can delete centros" ON public.centros_custos
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth delete custo_fixo" ON public.custo_fixo_oficina
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can update escala_limpeza" ON public.escala_limpeza
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth update oc_grade" ON public.ordens_corte_grade
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth update oc_produtos" ON public.ordens_corte_produtos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth update oc_rolos" ON public.ordens_corte_rolos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- =========================
-- 4. Fix function search_path
-- =========================
CREATE OR REPLACE FUNCTION public.auto_pago_telegram()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.origem = 'telegram' THEN
    NEW.status_pagamento := 'pago';
    IF NEW.data_envio IS NULL THEN
      NEW.data_envio := CURRENT_DATE;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Revoke broad execute on trigger-only SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.atualizar_saldo_fatura() FROM PUBLIC, anon, authenticated;

-- =========================
-- 5. Recreate views with security_invoker
-- =========================
ALTER VIEW IF EXISTS public.v_tray_orders SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_tray_orders_detalhes SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_tray_products_variants SET (security_invoker = true);
ALTER VIEW IF EXISTS public.vw_revisao_mensal SET (security_invoker = true);
ALTER VIEW IF EXISTS public.vw_vendas_mes_atual SET (security_invoker = true);
ALTER VIEW IF EXISTS public.vw_dashboard_vendas SET (security_invoker = true);

-- =========================
-- 6. Make colaboradores-fotos bucket private + signed URL access
-- =========================
UPDATE storage.buckets SET public = false WHERE id = 'colaboradores-fotos';

DROP POLICY IF EXISTS "Public can view photos" ON storage.objects;

CREATE POLICY "Authenticated users can view colaboradores photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'colaboradores-fotos');
