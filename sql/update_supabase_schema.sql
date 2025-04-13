-- Script de mise à jour du schéma Supabase pour ajouter les colonnes nécessaires
-- Exécuter ce script dans l'éditeur SQL de Supabase

-- Étape 1: Ajouter les colonnes pour les tokens de notification
ALTER TABLE public.user_notification_tokens 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE public.user_notification_tokens 
ADD COLUMN IF NOT EXISTS last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Étape 2: Ajouter la colonne prestataire_status à la table requests
ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS prestataire_status text DEFAULT 'not_started';

-- Étape 3: S'assurer des permissions correctes
GRANT SELECT, UPDATE on public.requests to anon, authenticated, service_role;

-- Étape 4: Mise à jour des politiques RLS pour les requêtes
ALTER TABLE public.requests DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow access to requests" ON public.requests;
CREATE POLICY "Allow access to requests"
ON public.requests
USING (true)
WITH CHECK (true);

-- Étape 5: Créer des politiques spécifiques pour user_notification_tokens si pas déjà fait
ALTER TABLE public.user_notification_tokens ENABLE ROW LEVEL SECURITY;

-- Politiques pour user_notification_tokens
DROP POLICY IF EXISTS "Users can CRUD their own tokens" ON public.user_notification_tokens;
CREATE POLICY "Users can CRUD their own tokens"
ON public.user_notification_tokens
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Étape 6: Mise à jour du schéma cache pour Supabase
NOTIFY pgrst, 'reload schema';

-- Vérification: Confirme que les colonnes ont été créées
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('user_notification_tokens', 'requests')
AND column_name IN ('is_active', 'last_used', 'prestataire_status');
