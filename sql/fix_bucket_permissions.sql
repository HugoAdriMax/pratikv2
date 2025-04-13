-- Vérifier si les politiques existent
SELECT policyname, tablename, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';

-- Supprimer les politiques existantes pour nettoyer
DROP POLICY IF EXISTS "Affichage public des images chat" ON storage.objects;
DROP POLICY IF EXISTS "Upload d'images authentifié" ON storage.objects;

-- Re-créer les politiques avec des noms et formats optimaux
CREATE POLICY "storage_chat_media_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media');

CREATE POLICY "storage_chat_media_insert" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'chat-media' AND
    auth.role() = 'authenticated'
);

-- S'assurer que le bucket chat-media existe et est public
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Vérifier les buckets existants pour déboguer
SELECT id, name, public, created_at
FROM storage.buckets;
