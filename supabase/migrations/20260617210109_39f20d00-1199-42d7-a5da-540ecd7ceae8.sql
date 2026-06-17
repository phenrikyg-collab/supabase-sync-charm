
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.atualizar_saldo_fatura() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_vindi_taxa_to_financeiro() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.media_historica(integer, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.media_historica(integer, integer) TO authenticated, service_role;
-- trigger functions only need to be callable by the system; keep service_role for completeness
GRANT EXECUTE ON FUNCTION public.atualizar_saldo_fatura() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_vindi_taxa_to_financeiro() TO service_role;
