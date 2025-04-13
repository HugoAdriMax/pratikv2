-- Ajouter les colonnes nécessaires à la table users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS kyc_submitted BOOLEAN DEFAULT FALSE;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS business_reg_number TEXT;

-- Pour les utilisateurs qui ne sont pas des prestataires, mettre is_active à TRUE par défaut
UPDATE public.users
SET is_active = TRUE
WHERE role != 'prestataire';

-- Pour les prestataires existants déjà vérifiés, les activer également
UPDATE public.users
SET is_active = TRUE
WHERE role = 'prestataire' AND is_verified = TRUE;

-- Ajouter la table des demandes d'activation pour les prestataires
CREATE TABLE IF NOT EXISTS public.prestataire_activations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  admin_id UUID REFERENCES public.users(id)
);

-- Ajouter les RLS et les permissions
ALTER TABLE public.prestataire_activations ENABLE ROW LEVEL SECURITY;

-- Politiques pour la table prestataire_activations
DROP POLICY IF EXISTS "Prestataires can view their own activation requests" ON public.prestataire_activations;
CREATE POLICY "Prestataires can view their own activation requests"
ON public.prestataire_activations
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all activation requests" ON public.prestataire_activations;
CREATE POLICY "Admins can manage all activation requests"
ON public.prestataire_activations
TO authenticated
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Mise à jour des permissions pour la table users
-- Version corrigée sans utiliser OLD qui cause l'erreur
DROP POLICY IF EXISTS "Users can update their own profiles" ON public.users;
CREATE POLICY "Users can update their own profiles"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Permissions pour les administrateurs
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
CREATE POLICY "Admins can update all users"
ON public.users
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Accorder les permissions sur la nouvelle table
GRANT ALL ON public.prestataire_activations TO authenticated;
GRANT ALL ON public.prestataire_activations TO service_role;

-- Mise à jour du schéma cache pour Supabase
NOTIFY pgrst, 'reload schema';