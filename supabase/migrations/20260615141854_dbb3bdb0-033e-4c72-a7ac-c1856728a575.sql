
-- Revoke public/anon execute on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.media_historica(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.media_historica(integer, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.atualizar_saldo_fatura() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atualizar_saldo_fatura() TO service_role;
