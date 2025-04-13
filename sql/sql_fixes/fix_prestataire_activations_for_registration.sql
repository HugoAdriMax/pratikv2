-- Script pour créer une fonction RPC qui permettra aux prestataires de s'inscrire et créer leurs activations
-- Le problème actuel est une violation de la politique RLS lors de l'inscription

-- 1. Créer une fonction RPC avec SECURITY DEFINER pour contourner les restrictions RLS
CREATE OR REPLACE FUNCTION public.create_prestataire_activation(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  INSERT INTO public.prestataire_activations (user_id, status)
  VALUES (p_user_id, 'pending')
  RETURNING to_jsonb(prestataire_activations.*) INTO result;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Définir des permissions d'accès à cette fonction
GRANT EXECUTE ON FUNCTION public.create_prestataire_activation TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_prestataire_activation TO anon;
GRANT EXECUTE ON FUNCTION public.create_prestataire_activation TO service_role;

-- 3. Modifier les politiques RLS de la table pour autoriser l'insertion
DROP POLICY IF EXISTS "Insert activation requests" ON public.prestataire_activations;
CREATE POLICY "Insert activation requests"
ON public.prestataire_activations
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id  -- Un utilisateur peut créer sa propre activation
    OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'  -- Les admins peuvent créer des activations pour d'autres
);

-- 4. Autoriser le rôle de service à tout faire sur cette table
DROP POLICY IF EXISTS "Service role can manage all activations" ON public.prestataire_activations;
CREATE POLICY "Service role can manage all activations"
ON public.prestataire_activations
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. Accorder des permissions explicites sur la table
GRANT SELECT, INSERT, UPDATE ON public.prestataire_activations TO authenticated;
GRANT ALL ON public.prestataire_activations TO service_role;

-- 6. Rafraîchir le schéma pour Supabase
NOTIFY pgrst, 'reload schema';