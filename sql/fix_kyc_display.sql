-- Script complet pour résoudre les problèmes d'affichage des documents KYC
-- Ce script combine les correctifs pour les autorisations de stockage et accès aux documents

BEGIN;

-- Partie 1: S'assurer que le bucket 'chat-media' est public et accessible
UPDATE storage.buckets
SET public = true
WHERE id = 'chat-media';

-- Partie 2: Nettoyer toutes les politiques existantes pour le bucket 'chat-media'
-- Suppression des anciennes politiques qui pourraient être incomplètes ou mal configurées
DO $$
DECLARE 
  r RECORD;
BEGIN
    -- Suppression de toutes les politiques existantes pour le bucket chat-media
    -- Cela nous permet de partir d'une configuration propre
    FOR r IN (
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
        AND (policyname LIKE '%chat%' OR policyname LIKE '%media%' OR policyname LIKE '%image%')
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON storage.objects';
        RAISE NOTICE 'Suppression de la politique: %', r.policyname;
    END LOOP;
END $$;

-- Partie 3: Créer des politiques claires pour le bucket 'chat-media'
-- Ces politiques permettent un accès complet pour les utilisateurs authentifiés et un accès en lecture pour tout le monde

-- Politique d'accès en lecture pour tous (y compris anonymes)
-- Cruciale pour permettre le chargement des images via des URL publiques
CREATE POLICY "Public Access to chat-media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-media');

-- Politique d'upload pour les utilisateurs authentifiés
CREATE POLICY "Authenticated Upload to chat-media"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-media');

-- Partie 4: Créer une vue pour faciliter l'accès aux documents KYC
-- Cette vue expose les données KYC avec les URL nettoyées des caractères d'échappement
CREATE OR REPLACE VIEW public.kyc_documents AS
SELECT 
    k.id,
    k.user_id,
    k.status,
    k.created_at,
    u.email as user_email,
    u.name as business_name,
    CASE 
        WHEN k.doc_url IS NULL THEN NULL
        WHEN jsonb_typeof(CAST(k.doc_url AS jsonb)) = 'object' THEN
            jsonb_build_object(
                'idCardUrl', REPLACE(CAST(k.doc_url->'idCardUrl' AS text), '\', ''),
                'businessDocUrl', REPLACE(CAST(k.doc_url->'businessDocUrl' AS text), '\', '')
            )
        WHEN k.doc_url::text LIKE '{%}' THEN
            CAST(REPLACE(CAST(k.doc_url AS text), '\', '') AS jsonb)
        ELSE 
            jsonb_build_object('idCardUrl', REPLACE(CAST(k.doc_url AS text), '\', ''))
    END AS clean_doc_url
FROM 
    public.kyc k
JOIN 
    public.users u ON k.user_id = u.id;

-- Partie 5: S'assurer que les administrateurs ont accès à la vue
GRANT SELECT ON public.kyc_documents TO authenticated;

-- Partie 6: Mettre à jour les URL de documents déjà stockées pour supprimer les caractères d'échappement
UPDATE public.kyc
SET doc_url = REPLACE(CAST(doc_url AS text), '\', '')
WHERE doc_url::text LIKE '%\\%';

COMMIT;

-- Notes d'utilisation:
-- 1. Après avoir exécuté ce script, redémarrez votre application
-- 2. Si vous continuez à avoir des problèmes, vérifiez les journaux pour voir si des erreurs apparaissent
-- 3. Utilisez la vue 'kyc_documents' pour obtenir des données avec des URLs nettoyées: 
--    SELECT * FROM public.kyc_documents WHERE status = 'pending';