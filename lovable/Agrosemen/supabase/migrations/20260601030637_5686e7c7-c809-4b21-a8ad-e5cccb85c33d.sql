-- Remove the previous views in favor of a single, safer RPC.
DROP VIEW IF EXISTS public.public_catalog_settings;
DROP VIEW IF EXISTS public.public_catalog_bulls;

CREATE OR REPLACE FUNCTION public.get_public_catalog(_user_id uuid)
RETURNS TABLE (
  farm_name        text,
  whatsapp_number  text,
  bull_id          uuid,
  bull_name        text,
  bull_breed       text,
  bull_code        text,
  bull_photo       text,
  bull_quantity    integer,
  bull_quantity_sexado integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.display_name        AS farm_name,
    s.whatsapp_number     AS whatsapp_number,
    b.id                  AS bull_id,
    b.name                AS bull_name,
    b.breed               AS bull_breed,
    b.code                AS bull_code,
    b.photo               AS bull_photo,
    b.quantity            AS bull_quantity,
    b.quantity_sexado     AS bull_quantity_sexado
  FROM public.user_settings s
  LEFT JOIN public.bulls b
    ON b.user_id = s.user_id
   AND (b.quantity > 0 OR b.quantity_sexado > 0)
  WHERE s.user_id = _user_id;
$$;

REVOKE ALL ON FUNCTION public.get_public_catalog(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_catalog(uuid) TO anon, authenticated;