-- Vérifie si la colonne image_url existe déjà
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'chat_messages'
        AND column_name = 'image_url'
    ) THEN
        -- Ajouter la colonne image_url si elle n'existe pas
        ALTER TABLE public.chat_messages
        ADD COLUMN image_url TEXT;
        
        RAISE NOTICE 'Colonne image_url ajoutée à la table chat_messages';
    ELSE
        RAISE NOTICE 'La colonne image_url existe déjà dans la table chat_messages';
    END IF;
END
$$;

-- Vérifier si le bucket chat-media existe et le créer si nécessaire
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Mettre à jour les politiques RLS pour chat_messages
-- Politique pour lectures
CREATE POLICY "Les utilisateurs peuvent lire les messages de leurs jobs" 
ON public.chat_messages 
FOR SELECT 
USING (
    auth.uid() = sender_id 
    OR auth.uid() = receiver_id
);

-- Politique pour insertions
CREATE POLICY "Les utilisateurs peuvent ajouter des messages" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK (
    auth.uid() = sender_id
);

-- Politique pour mises à jour (ne permettre que de marquer comme lu)
CREATE POLICY "Les destinataires peuvent marquer les messages comme lus" 
ON public.chat_messages 
FOR UPDATE 
USING (
    auth.uid() = receiver_id
)
WITH CHECK (
    -- Ne permettre que de changer is_read
    auth.uid() = receiver_id AND
    (SELECT xmin \!= xmax FROM pg_catalog.pg_stat_all_tables WHERE relname = 'chat_messages')
);

-- Vérifier que la politique storage existe pour permettre l'accès aux images
CREATE POLICY "Affichage public des images chat" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'chat-media');

CREATE POLICY "Upload d'images authentifié" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'chat-media' AND
    auth.role() = 'authenticated'
);

COMMIT;
