-- SQL pour corriger les permissions RLS
-- Désactiver la politique RLS sur les tables problématiques
ALTER TABLE public.jobs DISABLE ROW LEVEL SECURITY;

-- Créer une politique qui permet à tous les utilisateurs de manipuler les jobs
CREATE POLICY "Allow full access to jobs" ON public.jobs
    USING (true)
    WITH CHECK (true);

-- S'assurer que la table est visible pour les utilisateurs anonymes
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO anon;

-- Faire de même pour la table des offres
ALTER TABLE public.offers DISABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow full access to offers" ON public.offers
    USING (true)
    WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO anon;

-- Assurer que les requêtes sont accessibles
ALTER TABLE public.requests DISABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow access to requests" ON public.requests
    USING (true)
    WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requests TO anon;

-- Ajouter la colonne prestataire_status à la table requests
ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS prestataire_status text DEFAULT 'not_started';