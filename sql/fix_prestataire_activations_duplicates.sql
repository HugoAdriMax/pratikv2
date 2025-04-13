-- Script SQL pour examiner et corriger les contraintes d'unicité sur les activations
-- Vérifiez s'il existe des règles qui pourraient empêcher la suppression ou modification correcte

-- 1. Vérifiez la structure des tables impliquées
\echo 'Structure de la table prestataire_activations:'
\d prestataire_activations

-- 2. Recherchez des triggers qui pourraient remettre l'état précédent
\echo 'Triggers sur la table prestataire_activations:'
SELECT tgname, tgtype, tgenabled, tgrelid::regclass
FROM pg_trigger
WHERE tgrelid = 'prestataire_activations'::regclass;

-- 3. Ajoutez une contrainte d'unicité pour éviter les doublons sur user_id+status
-- Cette contrainte garantit qu'il ne peut y avoir qu'une seule entrée active pour chaque paire user_id/status
ALTER TABLE prestataire_activations 
DROP CONSTRAINT IF EXISTS unique_user_id_status_constraint;

ALTER TABLE prestataire_activations
ADD CONSTRAINT unique_user_id_status_constraint 
UNIQUE (user_id, status);

-- 4. Nettoyez les éventuels doublons existants (gardez seulement l'entrée la plus récente pour chaque user_id/status)
WITH duplicates AS (
  SELECT 
    id,
    user_id,
    status,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY user_id, status ORDER BY created_at DESC) as row_num
  FROM prestataire_activations
)
DELETE FROM prestataire_activations 
WHERE id IN (
  SELECT id FROM duplicates WHERE row_num > 1
);
