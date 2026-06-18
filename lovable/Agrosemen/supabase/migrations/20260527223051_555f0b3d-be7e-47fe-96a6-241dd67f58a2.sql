ALTER TABLE public.bulls REPLICA IDENTITY FULL;
ALTER TABLE public.inseminations REPLICA IDENTITY FULL;
ALTER TABLE public.clients REPLICA IDENTITY FULL;
ALTER TABLE public.stock_movements REPLICA IDENTITY FULL;
ALTER TABLE public.user_settings REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.bulls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inseminations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_settings;