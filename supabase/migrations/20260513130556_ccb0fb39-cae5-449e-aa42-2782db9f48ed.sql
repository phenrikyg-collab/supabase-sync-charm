CREATE SCHEMA IF NOT EXISTS kondado;

CREATE TABLE IF NOT EXISTS kondado.tray_orders (
  id              bigint PRIMARY KEY,
  date            date,
  total           numeric,
  discount        numeric,
  shipping        numeric,
  payment_form    text,
  payment_method  text,
  orderstatus_status text,
  orderstatus_type   text,
  customer_name   text,
  customer_email  text,
  store_id        bigint,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kondado.tray_products_variants (
  variant_id              bigint PRIMARY KEY,
  variant_product_id      bigint,
  variant_sku             text,
  variant_stock           integer DEFAULT 0,
  variant_quantity_sold   integer DEFAULT 0,
  variant_price           numeric,
  variant_promotional_price numeric,
  variant_cost            numeric,
  variant_reference       text,
  created_at              timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kondado.tray_orders_detalhes (
  id           bigserial PRIMARY KEY,
  order_id     bigint,
  product_id   bigint,
  variant_id   bigint,
  product_name text,
  quantity     integer,
  price        numeric,
  discount     numeric,
  cost_price   numeric,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tray_orders_date         ON kondado.tray_orders(date);
CREATE INDEX IF NOT EXISTS idx_tray_orders_status_type  ON kondado.tray_orders(orderstatus_type);
CREATE INDEX IF NOT EXISTS idx_tray_pv_product          ON kondado.tray_products_variants(variant_product_id);
CREATE INDEX IF NOT EXISTS idx_tray_det_order           ON kondado.tray_orders_detalhes(order_id);
CREATE INDEX IF NOT EXISTS idx_tray_det_product         ON kondado.tray_orders_detalhes(product_id);

ALTER TABLE kondado.tray_orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE kondado.tray_products_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE kondado.tray_orders_detalhes   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth read tray_orders" ON kondado.tray_orders FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "auth read tray_products_variants" ON kondado.tray_products_variants FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "auth read tray_orders_detalhes" ON kondado.tray_orders_detalhes FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE VIEW public.v_tray_orders            WITH (security_invoker = true) AS SELECT * FROM kondado.tray_orders;
CREATE OR REPLACE VIEW public.v_tray_products_variants WITH (security_invoker = true) AS SELECT * FROM kondado.tray_products_variants;
CREATE OR REPLACE VIEW public.v_tray_orders_detalhes   WITH (security_invoker = true) AS SELECT * FROM kondado.tray_orders_detalhes;

GRANT USAGE ON SCHEMA kondado TO anon, authenticated;
GRANT SELECT ON kondado.tray_orders, kondado.tray_products_variants, kondado.tray_orders_detalhes TO authenticated;
GRANT SELECT ON public.v_tray_orders, public.v_tray_products_variants, public.v_tray_orders_detalhes TO anon, authenticated;