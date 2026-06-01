
-- Restrict cartoes_credito to admins
DROP POLICY IF EXISTS "Auth delete cartoes_credito" ON public.cartoes_credito;
DROP POLICY IF EXISTS "Auth insert cartoes_credito" ON public.cartoes_credito;
DROP POLICY IF EXISTS "Auth read cartoes_credito" ON public.cartoes_credito;
DROP POLICY IF EXISTS "Auth update cartoes_credito" ON public.cartoes_credito;
CREATE POLICY "Admins read cartoes_credito" ON public.cartoes_credito FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins insert cartoes_credito" ON public.cartoes_credito FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins update cartoes_credito" ON public.cartoes_credito FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins delete cartoes_credito" ON public.cartoes_credito FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- Restrict cartoes_faturas to admins
DROP POLICY IF EXISTS "Auth delete cartoes_faturas" ON public.cartoes_faturas;
DROP POLICY IF EXISTS "Auth insert cartoes_faturas" ON public.cartoes_faturas;
DROP POLICY IF EXISTS "Auth read cartoes_faturas" ON public.cartoes_faturas;
DROP POLICY IF EXISTS "Auth update cartoes_faturas" ON public.cartoes_faturas;
CREATE POLICY "Admins read cartoes_faturas" ON public.cartoes_faturas FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins insert cartoes_faturas" ON public.cartoes_faturas FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins update cartoes_faturas" ON public.cartoes_faturas FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins delete cartoes_faturas" ON public.cartoes_faturas FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- Restrict orcamentos to admins
DROP POLICY IF EXISTS "Auth delete orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Auth insert orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Auth read orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Auth update orcamentos" ON public.orcamentos;
CREATE POLICY "Admins read orcamentos" ON public.orcamentos FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins insert orcamentos" ON public.orcamentos FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins update orcamentos" ON public.orcamentos FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins delete orcamentos" ON public.orcamentos FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- Restrict writes on categorias_financeiras to admins (keep read open to authenticated)
DROP POLICY IF EXISTS "Auth users can delete categorias" ON public.categorias_financeiras;
DROP POLICY IF EXISTS "Auth users can insert categorias" ON public.categorias_financeiras;
DROP POLICY IF EXISTS "Auth users can update categorias" ON public.categorias_financeiras;
CREATE POLICY "Admins insert categorias" ON public.categorias_financeiras FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins update categorias" ON public.categorias_financeiras FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins delete categorias" ON public.categorias_financeiras FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));

-- Restrict writes on centros_custos to admins (keep read open to authenticated)
DROP POLICY IF EXISTS "Auth users can delete centros" ON public.centros_custos;
DROP POLICY IF EXISTS "Auth users can insert centros" ON public.centros_custos;
DROP POLICY IF EXISTS "Auth users can update centros" ON public.centros_custos;
CREATE POLICY "Admins insert centros" ON public.centros_custos FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins update centros" ON public.centros_custos FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins delete centros" ON public.centros_custos FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
