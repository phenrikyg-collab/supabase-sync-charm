CREATE OR REPLACE VIEW public.vw_dashboard_vendas AS
SELECT
  date_trunc('month', date)::date AS mes,
  COUNT(*)::bigint AS total_pedidos,
  COALESCE(SUM(total), 0)::numeric AS receita_bruta,
  COALESCE(SUM(discount), 0)::numeric AS total_desconto,
  COALESCE(AVG(discount), 0)::numeric AS desconto_medio,
  CASE WHEN SUM(total) > 0
    THEN (SUM(discount) / SUM(total) * 100)::numeric
    ELSE 0 END AS desconto_percentual,
  CASE WHEN COUNT(*) > 0
    THEN (SUM(total) / COUNT(*))::numeric
    ELSE 0 END AS ticket_medio
FROM public.v_tray_orders
WHERE orderstatus_type IS DISTINCT FROM 'canceled'
GROUP BY date_trunc('month', date)
ORDER BY mes DESC;

CREATE OR REPLACE VIEW public.vw_vendas_mes_atual AS
SELECT
  date,
  id,
  total,
  discount,
  payment_form,
  orderstatus_status,
  orderstatus_type,
  customer_name,
  customer_email,
  shipping AS shipment_value
FROM public.v_tray_orders
WHERE date_trunc('month', date) = date_trunc('month', CURRENT_DATE)
  AND orderstatus_type IS DISTINCT FROM 'canceled'
ORDER BY date DESC;

NOTIFY pgrst, 'reload schema';