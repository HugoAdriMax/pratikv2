-- Corrige les problèmes de permission entre les buckets
-- Le problème identifié est que les documents KYC sont stockés dans chat-media/kyc-documents
-- mais les policies recherchent un bucket kyc-documents qui n'est pas utilisé

BEGIN;

-- Vérifier les buckets existants
SELECT id, name, owner, created_at, updated_at, public
FROM storage.buckets;

-- Ajouter une policy pour permettre la lecture des documents KYC dans chat-media
DROP POLICY IF EXISTS "Allow KYC document access" ON storage.objects;

CREATE POLICY "Allow KYC document access"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-media' AND
  (storage.foldername(name))[1] = 'kyc-documents' AND
  (
    -- L'utilisateur peut voir ses propres documents
    (storage.foldername(name))[2] = auth.uid()::text
    OR
    -- Les admins peuvent voir tous les documents
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- Supprimer le bucket kyc-documents s'il existe car il n'est pas utilisé
-- et peut prêter à confusion
DELETE FROM storage.buckets WHERE id = 'kyc-documents';

-- Vérifier les objects dans chat-media pour les documents KYC
SELECT name FROM storage.objects 
WHERE bucket_id = 'chat-media' 
AND name LIKE 'kyc-documents/%'
LIMIT 10;

COMMIT;
