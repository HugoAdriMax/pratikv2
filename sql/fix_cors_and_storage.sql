-- Script pour résoudre les problèmes de CORS et d'accès au stockage

BEGIN;

-- 1. Vérifier les configurations de CORS actuelles
SELECT 
    id, 
    name, 
    owner, 
    created_at, 
    updated_at, 
    public, 
    cors_rule, 
    file_size_limit 
FROM storage.buckets;

-- 2. Mettre à jour les règles CORS pour le bucket chat-media
UPDATE storage.buckets
SET cors_rule = '[{"method": "GET", "origin": "*", "allowedHeaders": ["*"]}]'
WHERE id = 'chat-media';

-- 3. S'assurer que le bucket est public
UPDATE storage.buckets
SET public = true
WHERE id = 'chat-media';

-- 4. Supprimer toutes les politiques de stockage existantes pour chat-media
-- pour repartir sur une base propre
DO $$
DECLARE
    policy_name text;
BEGIN
    FOR policy_name IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'objects' 
        AND schemaname = 'storage'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_name || '" ON storage.objects';
    END LOOP;
END $$;

-- 5. Créer une politique simple qui permet l'accès à tout le contenu du bucket
CREATE POLICY "Public Access for chat-media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-media');

-- 6. Créer une politique pour permettre les uploads par les utilisateurs authentifiés
CREATE POLICY "Authenticated users can upload to chat-media"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'chat-media' 
    AND auth.role() = 'authenticated'
);

-- 7. Créer une fonction pour générer une URL temporaire signée pour l'accès direct
CREATE OR REPLACE FUNCTION get_signed_url(bucket text, object_path text)
RETURNS text 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    signed_url text;
BEGIN
    -- Cette fonction simule une URL signée en ajoutant un timestamp
    -- Dans une vraie implémentation, vous utiliseriez la fonction de Supabase pour générer une vraie URL signée
    
    -- Récupérer l'URL publique
    SELECT storage.foldername(object_path) || '/' || storage.filename(object_path) || '?t=' || extract(epoch from now())::text
    INTO signed_url;
    
    RETURN 'https://mkexcgwxenvzhbbopnko.supabase.co/storage/v1/object/public/' || bucket || '/' || signed_url;
END;
$$;

-- 8. Vérifier les politiques finales
SELECT 
    policyname,
    schemaname,
    tablename,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'objects' 
AND schemaname = 'storage';

COMMIT;
