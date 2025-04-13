-- Ajouter une colonne JSONB pour les métadonnées si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'chat_messages'
        AND column_name = 'meta'
    ) THEN
        -- Ajouter la colonne meta de type JSONB
        ALTER TABLE public.chat_messages
        ADD COLUMN meta JSONB;
        
        RAISE NOTICE 'Colonne meta ajoutée à la table chat_messages';
    ELSE
        RAISE NOTICE 'La colonne meta existe déjà dans la table chat_messages';
    END IF;
END
$$;
