
-- Script pour créer un job fictif pour une demande complétée sans job
DO $$
DECLARE
  req RECORD;
BEGIN
  -- Pour chaque demande complétée sans job associé
  FOR req IN 
    SELECT r.id, r.client_id, o.id as offer_id, o.prestataire_id, r.created_at
    FROM requests r
    JOIN offers o ON r.id = o.request_id
    WHERE r.status = 'completed'
    AND o.status = 'accepted'
    AND NOT EXISTS (
      SELECT 1 FROM jobs j WHERE j.offer_id = o.id
    )
  LOOP
    -- Insérer un job pour cette demande
    INSERT INTO jobs (
      id, offer_id, client_id, prestataire_id, tracking_status, 
      is_completed, created_at, completed_at
    ) VALUES (
      uuid_generate_v4(), -- ID unique
      req.offer_id,
      req.client_id,
      req.prestataire_id,
      'completed',
      TRUE,
      req.created_at,
      NOW()
    );
    
    RAISE NOTICE 'Créé un job pour la demande %', req.id;
  END LOOP;
END $$;

-- Vérifier les jobs créés
SELECT r.id as request_id, j.id as job_id, j.offer_id 
FROM requests r
JOIN offers o ON r.id = o.request_id
JOIN jobs j ON o.id = j.offer_id
WHERE r.status = 'completed'
ORDER BY r.created_at DESC
LIMIT 10;

