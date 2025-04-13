-- Script pour corriger les identifiants de service dans les demandes existantes

-- Afficher les demandes avec leurs service_id actuels
SELECT id, service_id, created_at, status FROM requests ORDER BY created_at DESC;

-- Solution 1: Mettre à jour toutes les demandes pour utiliser un service standard
-- (adapté si vous voulez juste que toutes les demandes soient visibles)
UPDATE requests 
SET service_id = 'electricite' 
WHERE status IN ('pending', 'offered')
AND service_id != 'electricite'
AND service_id != 'carrelage';

-- Solution 2: Associer chaque demande à un service existant spécifique 
-- en fonction d'un mappage personnalisé
DO $$
DECLARE
    req RECORD;
BEGIN
    -- Pour chaque demande avec un service_id non reconnu
    FOR req IN 
        SELECT id, service_id FROM requests 
        WHERE status IN ('pending', 'offered')
        AND service_id NOT IN (
            SELECT service_id FROM prestataire_services
        )
    LOOP
        -- Convertir les anciens identifiants de service en nouveaux
        -- Adaptez cette partie en fonction de vos identifiants existants
        CASE 
            WHEN req.service_id = '1' THEN 
                UPDATE requests SET service_id = 'plomberie' WHERE id = req.id;
            WHEN req.service_id = '2' THEN
                UPDATE requests SET service_id = 'electricite' WHERE id = req.id;
            WHEN req.service_id = '3' THEN
                UPDATE requests SET service_id = 'jardinage' WHERE id = req.id;
            WHEN req.service_id = '4' THEN
                UPDATE requests SET service_id = 'nettoyage' WHERE id = req.id;
            WHEN req.service_id = '5' THEN
                UPDATE requests SET service_id = 'menuiserie' WHERE id = req.id;
            WHEN req.service_id = '6' THEN
                UPDATE requests SET service_id = 'peinture' WHERE id = req.id;
            WHEN req.service_id = '7' THEN
                UPDATE requests SET service_id = 'demenagement' WHERE id = req.id;
            ELSE
                -- Par défaut, assigner un service aléatoire parmi ceux qui sont activés
                UPDATE requests 
                SET service_id = (
                    SELECT service_id FROM prestataire_services 
                    ORDER BY random() LIMIT 1
                )
                WHERE id = req.id;
        END CASE;
        
        RAISE NOTICE 'Mise à jour de la demande %: % -> %', 
            req.id, 
            req.service_id, 
            (SELECT service_id FROM requests WHERE id = req.id);
    END LOOP;
END
$$;

-- Vérifier les demandes après mise à jour
SELECT id, service_id, created_at, status FROM requests ORDER BY created_at DESC;