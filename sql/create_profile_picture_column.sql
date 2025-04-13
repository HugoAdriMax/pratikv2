-- Ajouter des colonnes pour stocker les photos de profil
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- Ajouter une colonne pour stocker la version base64 (pour affichage direct)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS profile_picture_base64 TEXT;