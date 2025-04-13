-- Ce script s'assure que la colonne job_id existe dans la table notifications
-- Il corrige également le problème de contrainte NOT NULL sur title
-- Corrige l'erreur: {"code": "23502", "details": "Failing row contains (e962689b-9984-4346-beb6-00e62c61d013, 7f9de0ca-5061-41be-8e56-bb96fd74605d, null, null, null, f, 2025-04-12 11:48:51.279305+00, eeea15cb-fc9b-410a-943f-872d8fa1ef90, a6147807-4489-47cb-82d1-eff83c019762, arrived, ezekielmsc : lukeuzan+7 est arrivé à votre adresse.).", "hint": null, "message": "null value in column \"title\" of relation \"notifications\" violates not-null constraint"}

-- Vérifier si la table notifications existe déjà
DO $$ 
BEGIN
  -- Ajouter la colonne job_id si elle n'existe pas
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications'
  ) AND NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications' 
    AND column_name = 'job_id'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN job_id TEXT;
    RAISE NOTICE 'Colonne job_id ajoutée à la table notifications';
  ELSE
    RAISE NOTICE 'La colonne job_id existe déjà dans la table notifications ou la table n''existe pas';
  END IF;
END $$;

-- Modifier le type de la colonne job_id si elle existe mais n'est pas de type TEXT
DO $$ 
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications' 
    AND column_name = 'job_id'
    AND data_type != 'text'
  ) THEN
    ALTER TABLE public.notifications ALTER COLUMN job_id TYPE TEXT;
    RAISE NOTICE 'Type de la colonne job_id modifié en TEXT';
  END IF;
END $$;

-- Ajouter et corriger les colonnes potentiellement manquantes qui sont utilisées dans le code
DO $$ 
BEGIN
  -- Ajouter la colonne sender_id si elle n'existe pas
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications'
  ) AND NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications' 
    AND column_name = 'sender_id'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    RAISE NOTICE 'Colonne sender_id ajoutée à la table notifications';
  END IF;
  
  -- Ajouter la colonne type si elle n'existe pas
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications'
  ) AND NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications' 
    AND column_name = 'type'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN type TEXT;
    RAISE NOTICE 'Colonne type ajoutée à la table notifications';
  END IF;
  
  -- Vérifier et modifier la contrainte NOT NULL sur la colonne title
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications' 
    AND column_name = 'title'
    AND is_nullable = 'NO'
  ) THEN
    -- Modifier la colonne title pour permettre les valeurs NULL
    ALTER TABLE public.notifications ALTER COLUMN title DROP NOT NULL;
    RAISE NOTICE 'Contrainte NOT NULL supprimée de la colonne title';
  END IF;
  
  -- Vérifier et modifier la contrainte NOT NULL sur la colonne body
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications' 
    AND column_name = 'body'
    AND is_nullable = 'NO'
  ) THEN
    -- Modifier la colonne body pour permettre les valeurs NULL
    ALTER TABLE public.notifications ALTER COLUMN body DROP NOT NULL;
    RAISE NOTICE 'Contrainte NOT NULL supprimée de la colonne body';
  END IF;
  
  -- S'assurer que la colonne message existe et n'est pas NULL
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications'
  ) AND NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications' 
    AND column_name = 'message'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN message TEXT NOT NULL DEFAULT 'Notification du système';
    RAISE NOTICE 'Colonne message ajoutée à la table notifications';
  END IF;
END $$;

-- Mise à jour du schéma pour Supabase
NOTIFY pgrst, 'reload schema';