# Système d'Évaluation et de Commentaires

Ce document détaille la structure et les fonctionnalités du système d'évaluation et de commentaires mis en place dans l'application Client-Prestation.

## Architecture

Le système d'évaluation permet aux clients d'évaluer les prestataires après l'achèvement d'une prestation. Il est composé des éléments suivants :

1. **Modèle de données**
   - Table `reviews` pour stocker les évaluations
   - Vue matérialisée `user_review_stats` pour les statistiques d'évaluation
   - Fonction SQL pour calculer les moyennes

2. **Interface utilisateur**
   - Écran de soumission d'évaluation (côté client)
   - Écran de consultation des évaluations reçues (côté prestataire)
   - Composant réutilisable d'affichage des notes

3. **Logique métier**
   - Création d'évaluations
   - Calcul automatique des statistiques
   - Affichage des évaluations par prestataire

## Structure de la Base de Données

### Table `reviews`

```sql
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
```

### Vue matérialisée `user_review_stats`

```sql
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
```

### Déclencheur pour mise à jour automatique

```sql
CREATE OR REPLACE FUNCTION public.refresh_user_review_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_review_stats;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refresh_user_review_stats
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_user_review_stats();
```

## Composants d'Interface Utilisateur

### 1. Composant `RatingDisplay`

Composant réutilisable pour afficher la note moyenne d'un utilisateur :

```typescript
<RatingDisplay userId="user-id" size="md" showCount={true} />
```

Options :
- `size` : 'sm', 'md', 'lg' - Taille des étoiles
- `showCount` : boolean - Afficher le nombre d'avis
- `horizontal` : boolean - Disposition horizontale ou verticale

### 2. Écran de soumission d'évaluation

L'écran `ReviewScreen` permet aux clients d'évaluer un prestataire après avoir reçu un service :

- Affichage des informations du prestataire
- Sélection d'une note de 1 à 5 étoiles
- Champ de commentaire optionnel
- Boutons pour valider ou ignorer l'évaluation

### 3. Écran de consultation des évaluations

L'écran `ReviewsScreen` permet aux prestataires de consulter les évaluations qu'ils ont reçues :

- Affichage des statistiques globales (note moyenne, répartition)
- Liste des évaluations avec notes et commentaires
- Information sur l'utilisateur ayant soumis l'évaluation
- Date de l'évaluation

## Flux de travail pour les évaluations

1. **Soumission d'une évaluation**
   - Le client complète une mission
   - Il est invité à laisser une évaluation
   - Il attribue une note et un commentaire optionnel
   - L'évaluation est enregistrée et liée au prestataire

2. **Affichage des statistiques**
   - Les statistiques sont automatiquement calculées
   - La vue matérialisée est mise à jour après chaque nouvelle évaluation
   - Les prestataires peuvent consulter leurs évaluations et statistiques

3. **Utilisation dans l'application**
   - Les notes moyennes sont affichées dans les listes de prestataires
   - Les statistiques influencent le classement des prestataires
   - Les notes contribuent à la confiance des utilisateurs

## API du système d'évaluation

### Création d'une évaluation

```typescript
createReview({
  job_id: "job-id",
  reviewer_id: "client-id",
  reviewed_user_id: "prestataire-id",
  rating: 5,
  comment: "Excellent service !"
});
```

### Récupération des évaluations d'un utilisateur

```typescript
const reviews = await supabase
  .from('reviews')
  .select('*')
  .eq('reviewed_user_id', userId)
  .order('created_at', { ascending: false });
```

### Récupération des statistiques d'un utilisateur

```typescript
const { data: stats } = await supabase
  .from('user_review_stats')
  .select('*')
  .eq('reviewed_user_id', userId)
  .single();
```

## Politiques de sécurité

Les politiques Row-Level Security (RLS) assurent que :

- Tout utilisateur peut voir les évaluations
- Seul l'auteur peut modifier ou supprimer son évaluation
- Les statistiques sont accessibles à tous

```sql
CREATE POLICY "Anyone can view reviews" 
  ON public.reviews FOR SELECT 
  USING (true);

CREATE POLICY "Users can create their own reviews" 
  ON public.reviews FOR INSERT 
  WITH CHECK (auth.uid() = reviewer_id);
```

## Amélioration futures

1. **Évaluations mutuelles**
   - Permettre aux prestataires d'évaluer les clients

2. **Filtres et tri**
   - Filtrer les avis par note et période
   - Trier par pertinence ou date

3. **Évaluation détaillée**
   - Plusieurs critères d'évaluation (ponctualité, qualité, etc.)
   - Questions spécifiques par type de service

4. **Modération**
   - Système de signalement des avis inappropriés
   - Validation des avis par un administrateur

5. **Système de réponse**
   - Permettre aux prestataires de répondre aux avis
   - Dialogue public entre client et prestataire