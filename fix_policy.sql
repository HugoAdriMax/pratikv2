CREATE POLICY "Permettre CRUD sur jobs pour tous" ON public.jobs FOR ALL USING (true) WITH CHECK (true);
