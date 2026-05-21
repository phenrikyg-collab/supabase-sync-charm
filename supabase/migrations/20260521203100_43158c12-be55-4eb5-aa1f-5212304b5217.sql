-- Force PostgREST schema cache reload
COMMENT ON COLUMN public.ordens_corte_grade.produto_id IS 'Produto associado à linha da grade (multi-modelo por OC)';
NOTIFY pgrst, 'reload schema';