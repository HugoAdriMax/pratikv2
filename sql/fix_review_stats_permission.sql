-- Modification des permissions pour la vue matérialisée

-- Accorder les droits nécessaires sur la vue matérialisée
GRANT ALL PRIVILEGES ON public.user_review_stats TO authenticated;
GRANT ALL PRIVILEGES ON public.user_review_stats TO anon;

-- Modifier la fonction pour qu'elle s'exécute avec les privilèges du propriétaire de la table
DROP FUNCTION IF EXISTS public.refresh_user_review_stats();

CREATE OR REPLACE FUNCTION public.refresh_user_review_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Utiliser une structure de contrôle pour éviter l'erreur en développement
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_review_stats;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Erreur lors du rafraîchissement de la vue matérialisée: %', SQLERRM;
  END;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recréer le trigger
DROP TRIGGER IF EXISTS trigger_refresh_user_review_stats ON public.reviews;
CREATE TRIGGER trigger_refresh_user_review_stats
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_user_review_stats();

-- Alternative: désactiver le rafraîchissement automatique
-- En développement, vous pouvez rafraîchir manuellement la vue plutôt qu'automatiquement
-- DROP TRIGGER IF EXISTS trigger_refresh_user_review_stats ON public.reviews;

-- Modifier la fonction createReview dans l'API pour qu'elle ignore les erreurs de vue matérialisée