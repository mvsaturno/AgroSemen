CREATE POLICY "own mov delete" ON public.stock_movements
  FOR DELETE USING (auth.uid() = user_id);