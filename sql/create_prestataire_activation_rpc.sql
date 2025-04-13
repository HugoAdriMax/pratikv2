-- Créer une fonction RPC sécurisée pour contourner les restrictions RLS
-- lors de la création des activations de prestataire

CREATE OR REPLACE FUNCTION public.create_prestataire_activation(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.prestataire_activations (user_id, status)
  VALUES (p_user_id, 'pending');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ajouter les permissions nécessaires
GRANT EXECUTE ON FUNCTION public.create_prestataire_activation TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_prestataire_activation TO anon;
GRANT EXECUTE ON FUNCTION public.create_prestataire_activation TO service_role;

-- Actualiser le schéma pour Supabase
NOTIFY pgrst, 'reload schema';
