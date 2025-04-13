-- Créer le bucket profiles pour les photos de profil
INSERT INTO storage.buckets (id, name)
VALUES ('profiles', 'Profile Pictures')
ON CONFLICT (id) DO NOTHING;

-- Activer l'accès public au bucket profiles
UPDATE storage.buckets
SET public = true
WHERE id = 'profiles';

-- Permettre aux utilisateurs authentifiés de lire les images de profil
CREATE POLICY "Profile pictures are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'profiles'
);

-- Permettre aux utilisateurs authentifiés d'uploader leurs propres images de profil
CREATE POLICY "Authenticated users can upload profile pictures" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'profiles' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Permettre aux utilisateurs de mettre à jour ou de supprimer leurs propres images
CREATE POLICY "Users can update or delete their own profile pictures" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'profiles' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own profile pictures" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'profiles' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);