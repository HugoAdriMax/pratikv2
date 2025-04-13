-- Version simplifiée du script pour résoudre les problèmes d'affichage des documents KYC
-- Utilisez cette version si vous rencontrez des erreurs avec la version complète

BEGIN;

-- 1. S'assurer que le bucket 'chat-media' est public
UPDATE storage.buckets
SET public = true
WHERE id = 'chat-media';

-- 2. Supprimer les anciennes politiques problématiques (si elles existent)
DROP POLICY IF EXISTS "Enable chat image ph6blb_0" ON storage.objects;
DROP POLICY IF EXISTS "Enable chat image ph6blb_1" ON storage.objects;
DROP POLICY IF EXISTS "Affichage public des images chat" ON storage.objects;
DROP POLICY IF EXISTS "Upload d'images authentifié" ON storage.objects;

-- 3. Créer une politique simple d'accès public au bucket chat-media
CREATE POLICY "Public Access to chat-media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-media');

-- 4. Créer une politique pour permettre l'upload par les utilisateurs authentifiés
CREATE POLICY "Authenticated Upload to chat-media"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-media');

-- 5. Nettoyer les caractères d'échappement dans les données existantes
UPDATE public.kyc
SET doc_url = REPLACE(CAST(doc_url AS text), '\', '')
WHERE doc_url::text LIKE '%\\%';

COMMIT;

-- Note: Après avoir exécuté ce script, redémarrez votre application pour voir les changements.