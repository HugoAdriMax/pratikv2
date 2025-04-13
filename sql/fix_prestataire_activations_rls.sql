-- Script pour corriger les politiques RLS sur la table prestataire_activations
-- Version améliorée pour résoudre les problèmes persistants de permissions

-- Désactiver temporairement RLS pour la table
ALTER TABLE public.prestataire_activations DISABLE ROW LEVEL SECURITY;

-- Supprimer toutes les politiques existantes qui pourraient causer des problèmes
DROP POLICY IF EXISTS "Prestataires can view their own activation requests" ON public.prestataire_activations;
DROP POLICY IF EXISTS "Prestataires can insert their own activation requests" ON public.prestataire_activations;
DROP POLICY IF EXISTS "Admins can manage all activation requests" ON public.prestataire_activations;
DROP POLICY IF EXISTS "Service role can manage all activation requests" ON public.prestataire_activations;
DROP POLICY IF EXISTS "Users can access activation requests based on role" ON public.prestataire_activations;
DROP POLICY IF EXISTS "Select activation requests" ON public.prestataire_activations;
DROP POLICY IF EXISTS "Insert activation requests" ON public.prestataire_activations;
DROP POLICY IF EXISTS "Update activation requests" ON public.prestataire_activations;
DROP POLICY IF EXISTS "Delete activation requests" ON public.prestataire_activations;

-- Approche 1: Politique séparée pour chaque opération
-- SELECT: Prestataires peuvent voir leurs demandes, admins peuvent voir toutes les demandes
CREATE POLICY "Select activation requests"
ON public.prestataire_activations
FOR SELECT 
TO authenticated
USING (
    auth.uid() = user_id 
    OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- INSERT: Prestataires peuvent créer leurs demandes, admins peuvent créer n'importe quelle demande
CREATE POLICY "Insert activation requests"
ON public.prestataire_activations
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id 
    OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- UPDATE: Prestataires peuvent mettre à jour leurs demandes, admins peuvent mettre à jour n'importe quelle demande
CREATE POLICY "Update activation requests"
ON public.prestataire_activations
FOR UPDATE
TO authenticated
USING (
    auth.uid() = user_id 
    OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- DELETE: Seulement les admins peuvent supprimer des demandes
CREATE POLICY "Delete activation requests"
ON public.prestataire_activations
FOR DELETE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Politique pour le rôle de service (pour le backend)
CREATE POLICY "Service role can manage all activation requests"
ON public.prestataire_activations
FOR ALL
TO service_role
USING (true);

-- Réactiver RLS pour la table
ALTER TABLE public.prestataire_activations ENABLE ROW LEVEL SECURITY;

-- Révoquer et réaccorder les permissions pour s'assurer qu'elles sont correctement appliquées
REVOKE ALL ON public.prestataire_activations FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.prestataire_activations TO authenticated;
GRANT ALL ON public.prestataire_activations TO service_role;
REVOKE ALL ON public.prestataire_activations FROM anon;

-- Vérifier si la colonne admin_id existe, sinon l'ajouter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'prestataire_activations'
    AND column_name = 'admin_id'
  ) THEN
    ALTER TABLE public.prestataire_activations ADD COLUMN admin_id UUID REFERENCES public.users(id);
  END IF;
END $$;

-- Commentaire: La fonction set_updated_at doit exister avant d'exécuter ce script
-- Si vous rencontrez une erreur, exécutez d'abord create_updated_at_function.sql

-- Ajouter un trigger pour gérer automatiquement les dates de mise à jour
DROP TRIGGER IF EXISTS update_prestataire_activations_updated_at ON public.prestataire_activations;
CREATE TRIGGER update_prestataire_activations_updated_at
BEFORE UPDATE ON public.prestataire_activations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Rafraîchir le cache de schéma pour que les changements soient pris en compte
NOTIFY pgrst, 'reload schema';