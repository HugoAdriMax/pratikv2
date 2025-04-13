-- Table pour les évaluations (reviews)
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(job_id, reviewer_id, reviewed_user_id)
);

-- Index pour accélérer les recherches
CREATE INDEX IF NOT EXISTS idx_reviews_job_id ON public.reviews(job_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON public.reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed_user_id ON public.reviews(reviewed_user_id);

-- Fonction pour calculer la note moyenne d'un utilisateur
CREATE OR REPLACE FUNCTION public.calculate_user_rating(user_id UUID)
RETURNS FLOAT AS $$
DECLARE
  avg_rating FLOAT;
BEGIN
  SELECT AVG(rating)::FLOAT 
  INTO avg_rating
  FROM public.reviews
  WHERE reviewed_user_id = user_id;
  
  RETURN COALESCE(avg_rating, 0);
END;
$$ LANGUAGE plpgsql;

-- Vue matérialisée pour stocker les statistiques des évaluations par utilisateur
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

-- Index sur la vue matérialisée
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_review_stats_user_id ON public.user_review_stats(reviewed_user_id);

-- Fonction pour rafraîchir automatiquement la vue matérialisée
CREATE OR REPLACE FUNCTION public.refresh_user_review_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_review_stats;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Déclencheur pour rafraîchir la vue matérialisée après une insertion/mise à jour/suppression
DROP TRIGGER IF EXISTS trigger_refresh_user_review_stats ON public.reviews;
CREATE TRIGGER trigger_refresh_user_review_stats
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_user_review_stats();

-- Politiques RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les évaluations
CREATE POLICY "Anyone can view reviews" 
  ON public.reviews FOR SELECT 
  USING (true);

-- Les utilisateurs peuvent créer leurs propres évaluations
CREATE POLICY "Users can create their own reviews" 
  ON public.reviews FOR INSERT 
  WITH CHECK (auth.uid() = reviewer_id);

-- Les utilisateurs peuvent mettre à jour leurs propres évaluations
CREATE POLICY "Users can update their own reviews" 
  ON public.reviews FOR UPDATE 
  USING (auth.uid() = reviewer_id);

-- Les utilisateurs peuvent supprimer leurs propres évaluations
CREATE POLICY "Users can delete their own reviews" 
  ON public.reviews FOR DELETE 
  USING (auth.uid() = reviewer_id);