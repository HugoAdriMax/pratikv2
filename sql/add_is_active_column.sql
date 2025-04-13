-- Ajouter la colonne is_active à la table user_notification_tokens
ALTER TABLE public.user_notification_tokens 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Ajouter la colonne last_used à la table user_notification_tokens si elle n'existe pas
ALTER TABLE public.user_notification_tokens 
ADD COLUMN IF NOT EXISTS last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Mise à jour du schéma cache pour Supabase
NOTIFY pgrst, 'reload schema';