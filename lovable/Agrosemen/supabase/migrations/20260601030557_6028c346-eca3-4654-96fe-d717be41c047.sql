-- Public catalog views. Use SECURITY DEFINER (default) so the view runs
-- with the owner's privileges and bypasses RLS on the base tables —
-- the base tables stay completely private; only these views are public.
CREATE OR REPLACE VIEW public.public_catalog_settings AS
  SELECT user_id, display_name, whatsapp_number
  FROM public.user_settings;

CREATE OR REPLACE VIEW public.public_catalog_bulls AS
  SELECT id, user_id, name, breed, code, photo, quantity, quantity_sexado
  FROM public.bulls;

-- Allow anonymous and authenticated visitors to read the public catalog views.
GRANT SELECT ON public.public_catalog_settings TO anon, authenticated;
GRANT SELECT ON public.public_catalog_bulls    TO anon, authenticated;