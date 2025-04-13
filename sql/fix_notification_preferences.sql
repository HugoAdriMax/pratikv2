-- Ce script corrige les problèmes de structure de la table user_notification_preferences

-- Vérifie si la table existe et la crée sinon
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  new_offers BOOLEAN DEFAULT TRUE,
  status_updates BOOLEAN DEFAULT TRUE,
  messages BOOLEAN DEFAULT TRUE,
  account_updates BOOLEAN DEFAULT TRUE,
  marketing BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Ajoute les colonnes manquantes si elles n'existent pas
DO $$ 
BEGIN
  -- Ajoute new_offers si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_notification_preferences' AND column_name = 'new_offers') THEN
    ALTER TABLE public.user_notification_preferences ADD COLUMN new_offers BOOLEAN DEFAULT TRUE;
  END IF;
  
  -- Ajoute status_updates si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_notification_preferences' AND column_name = 'status_updates') THEN
    ALTER TABLE public.user_notification_preferences ADD COLUMN status_updates BOOLEAN DEFAULT TRUE;
  END IF;
  
  -- Ajoute messages si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_notification_preferences' AND column_name = 'messages') THEN
    ALTER TABLE public.user_notification_preferences ADD COLUMN messages BOOLEAN DEFAULT TRUE;
  END IF;
  
  -- Ajoute account_updates si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_notification_preferences' AND column_name = 'account_updates') THEN
    ALTER TABLE public.user_notification_preferences ADD COLUMN account_updates BOOLEAN DEFAULT TRUE;
  END IF;
  
  -- Ajoute marketing si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_notification_preferences' AND column_name = 'marketing') THEN
    ALTER TABLE public.user_notification_preferences ADD COLUMN marketing BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- Ajoute created_at si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_notification_preferences' AND column_name = 'created_at') THEN
    ALTER TABLE public.user_notification_preferences ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
  
  -- Ajoute updated_at si elle n'existe pas
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_notification_preferences' AND column_name = 'updated_at') THEN
    ALTER TABLE public.user_notification_preferences ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Remplace job_status_updates par status_updates si nécessaire
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_notification_preferences' AND column_name = 'job_status_updates') THEN
    -- Crée status_updates si elle n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_notification_preferences' AND column_name = 'status_updates') THEN
      ALTER TABLE public.user_notification_preferences ADD COLUMN status_updates BOOLEAN DEFAULT TRUE;
    END IF;
    
    -- Copie les valeurs de job_status_updates vers status_updates
    UPDATE public.user_notification_preferences 
    SET status_updates = job_status_updates;
    
    -- Supprime l'ancienne colonne
    ALTER TABLE public.user_notification_preferences DROP COLUMN job_status_updates;
  END IF;
END $$;

-- Ajoute les politiques RLS
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notification preferences" ON public.user_notification_preferences;
CREATE POLICY "Users can view their own notification preferences" 
  ON public.user_notification_preferences FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notification preferences" ON public.user_notification_preferences;
CREATE POLICY "Users can update their own notification preferences" 
  ON public.user_notification_preferences FOR UPDATE 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own notification preferences" ON public.user_notification_preferences;
CREATE POLICY "Users can insert their own notification preferences" 
  ON public.user_notification_preferences FOR INSERT 
  WITH CHECK (auth.uid() = user_id);