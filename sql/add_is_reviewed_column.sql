-- Ajouter la colonne is_reviewed à la table requests
ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS is_reviewed BOOLEAN DEFAULT FALSE;

-- Mise à jour du schéma cache pour Supabase
NOTIFY pgrst, 'reload schema';