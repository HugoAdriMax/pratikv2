-- Une approche plus sûre: d'abord lister les policies existantes
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM
  pg_policies
WHERE
  tablename = 'objects' AND
  schemaname = 'storage';

-- Puis les supprimer une par une avec leurs noms exacts (à exécuter après avoir vu la liste)
-- DROP POLICY IF EXISTS "nom_exact_de_la_policy" ON storage.objects;

-- Ensuite créer une policy complète qui accepte tous les formats d'image
CREATE POLICY "Allow all image operations" 
ON storage.objects FOR ALL TO authenticated 
USING (
  bucket_id = 'chat-media' 
  AND storage.extension(name) IN ('jpg', 'jpeg', 'png', 'gif', 'webp', 'heic')
);

-- Créer une policy pour permettre aux utilisateurs anonymes d'accéder aux images
CREATE POLICY "Public images access" 
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'chat-media');
