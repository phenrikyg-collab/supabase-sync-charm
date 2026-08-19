DROP POLICY IF EXISTS "Authenticated can view vindi_transacoes" ON public.vindi_transacoes;
DROP POLICY IF EXISTS "Authenticated can insert vindi_transacoes" ON public.vindi_transacoes;
DROP POLICY IF EXISTS "Authenticated can update vindi_transacoes" ON public.vindi_transacoes;
DROP POLICY IF EXISTS "Authenticated can delete vindi_transacoes" ON public.vindi_transacoes;

ALTER TABLE public.vindi_transacoes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.vindi_transacoes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vindi_transacoes TO authenticated;
GRANT ALL ON public.vindi_transacoes TO service_role;

CREATE POLICY "Admins read vindi_transacoes"
ON public.vindi_transacoes FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert vindi_transacoes"
ON public.vindi_transacoes FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update vindi_transacoes"
ON public.vindi_transacoes FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete vindi_transacoes"
ON public.vindi_transacoes FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));