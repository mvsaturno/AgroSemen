ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS default_price_convencional numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_price_sexado numeric NOT NULL DEFAULT 0;

UPDATE public.user_settings
  SET default_price_convencional = default_price
  WHERE default_price_convencional = 0 AND default_price > 0;