-- Supprimer les policies existantes pour le bucket chat-media
DROP POLICY IF EXISTS "Enable chat image ph6blb_0" ON storage.objects;
DROP POLICY IF EXISTS "Enable chat image ph6blb_1" ON storage.objects;

-- Créer une policy pour la lecture (SELECT) qui accepte tous les formats d'image courants
CREATE POLICY "Enable chat image read" 
ON storage.objects FOR SELECT TO authenticated 
USING (
  bucket_id = 'chat-media' 
  AND storage.extension(name) IN ('jpg', 'jpeg', 'png', 'gif', 'webp', 'heic')
  AND auth.role() = 'authenticated'
);

-- Créer une policy pour l'upload (INSERT) qui accepte tous les formats d'image courants
CREATE POLICY "Enable chat image upload" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (
  bucket_id = 'chat-media' 
  AND storage.extension(name) IN ('jpg', 'jpeg', 'png', 'gif', 'webp', 'heic')
  AND auth.role() = 'authenticated'
);

-- Créer une policy pour permettre aux utilisateurs anonymes d'accéder aux images (important pour les URLs publiques)
CREATE POLICY "Allow public access to images" 
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'chat-media');
