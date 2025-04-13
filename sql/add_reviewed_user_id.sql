-- Ce script ajoute la colonne reviewed_user_id à la table reviews existante
-- et met à jour les données existantes

-- 1. Ajouter la colonne reviewed_user_id
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reviewed_user_id UUID REFERENCES auth.users(id);

-- 2. Mettre à jour les évaluations existantes en déduisant le reviewed_user_id à partir des informations du job
-- Pour chaque évaluation existante, nous supposons que le client évalue le prestataire
UPDATE public.reviews r
SET reviewed_user_id = j.prestataire_id
FROM public.jobs j
WHERE r.job_id = j.id AND r.reviewed_user_id IS NULL;

-- 3. Rendre la colonne NOT NULL après sa mise à jour
ALTER TABLE public.reviews ALTER COLUMN reviewed_user_id SET NOT NULL;

-- 4. Ajouter la contrainte unique
ALTER TABLE public.reviews 
DROP CONSTRAINT IF EXISTS unique_job_reviewer_reviewed;

ALTER TABLE public.reviews 
ADD CONSTRAINT unique_job_reviewer_reviewed UNIQUE(job_id, reviewer_id, reviewed_user_id);

-- 5. Créer la vue matérialisée pour les statistiques si elle n'existe pas
CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_review_stats AS
SELECT 
  reviewed_user_id,
  COUNT(*) as review_count,
  AVG(rating)::FLOAT as average_rating,
  COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star_count,
  COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star_count,
  COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star_count,
  COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star_count,
  COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star_count
FROM public.reviews
GROUP BY reviewed_user_id;

-- 6. Créer l'index sur la vue matérialisée
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_review_stats_user_id ON public.user_review_stats(reviewed_user_id);

-- 7. Fonction pour rafraîchir automatiquement la vue matérialisée
CREATE OR REPLACE FUNCTION public.refresh_user_review_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_review_stats;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 8. Déclencheur pour rafraîchir la vue matérialisée
DROP TRIGGER IF EXISTS trigger_refresh_user_review_stats ON public.reviews;
CREATE TRIGGER trigger_refresh_user_review_stats
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_user_review_stats();

-- 9. Rafraîchir la vue matérialisée pour les données existantes
REFRESH MATERIALIZED VIEW public.user_review_stats;