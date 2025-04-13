-- Script pour ajouter la colonne prestataire_status à la table requests

-- Ajoute directement la colonne avec IF NOT EXISTS (syntaxe PostgreSQL 9.6+)
ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS prestataire_status text DEFAULT 'not_started';

-- Ajoute les permissions pour accéder à la nouvelle colonne
GRANT SELECT, UPDATE on public.requests to anon, authenticated, service_role;

-- Mise à jour des RLS pour permettre la mise à jour du statut
ALTER TABLE public.requests DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow access to requests" ON public.requests;
CREATE POLICY "Allow access to requests"
ON public.requests
USING (true)
WITH CHECK (true);

-- Confirme que la colonne a été créée ou existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'requests'
AND column_name = 'prestataire_status';