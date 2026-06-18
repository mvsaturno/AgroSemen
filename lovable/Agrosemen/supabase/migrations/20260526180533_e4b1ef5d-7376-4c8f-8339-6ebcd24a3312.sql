
ALTER TABLE public.bulls
  ADD COLUMN IF NOT EXISTS quantity_sexado integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_convencional numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_sexado numeric NOT NULL DEFAULT 0;

ALTER TABLE public.inseminations
  ADD COLUMN IF NOT EXISTS semen_type text NOT NULL DEFAULT 'convencional',
  ADD COLUMN IF NOT EXISTS client_id uuid;

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS semen_type text NOT NULL DEFAULT 'convencional';

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS default_price numeric NOT NULL DEFAULT 0;

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own clients select" ON public.clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own clients insert" ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own clients update" ON public.clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own clients delete" ON public.clients FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER clients_touch_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
