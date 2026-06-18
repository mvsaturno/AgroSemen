
-- Bulls
CREATE TABLE public.bulls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  breed TEXT NOT NULL DEFAULT 'Nelore',
  code TEXT NOT NULL DEFAULT '',
  supplier TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  photo TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bulls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bulls select" ON public.bulls FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own bulls insert" ON public.bulls FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own bulls update" ON public.bulls FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own bulls delete" ON public.bulls FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX bulls_user_idx ON public.bulls(user_id);

-- Inseminations
CREATE TABLE public.inseminations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  bull_id UUID REFERENCES public.bulls(id) ON DELETE SET NULL,
  bull_name TEXT NOT NULL,
  cow_id TEXT NOT NULL,
  client TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  user_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inseminations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ins select" ON public.inseminations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own ins insert" ON public.inseminations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own ins update" ON public.inseminations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own ins delete" ON public.inseminations FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX ins_user_date_idx ON public.inseminations(user_id, date DESC);

-- Stock movements
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL CHECK (type IN ('entry','exit','adjust')),
  bull_id UUID REFERENCES public.bulls(id) ON DELETE SET NULL,
  bull_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  user_name TEXT NOT NULL DEFAULT ''
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mov select" ON public.stock_movements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own mov insert" ON public.stock_movements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX mov_user_date_idx ON public.stock_movements(user_id, date DESC);

-- Settings (one row per user)
CREATE TABLE public.user_settings (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  min_stock INTEGER NOT NULL DEFAULT 3,
  display_name TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings select" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own settings insert" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own settings update" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER bulls_touch BEFORE UPDATE ON public.bulls
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER settings_touch BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
