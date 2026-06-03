DROP POLICY IF EXISTS planejamento_mensal_all ON public.planejamento_mensal;
DROP POLICY IF EXISTS planejamento_simulacoes_all ON public.planejamento_simulacoes;

CREATE POLICY planejamento_mensal_all ON public.planejamento_mensal
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY planejamento_simulacoes_all ON public.planejamento_simulacoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE ALL ON public.planejamento_mensal FROM anon;
REVOKE ALL ON public.planejamento_simulacoes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planejamento_mensal TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planejamento_simulacoes TO authenticated;