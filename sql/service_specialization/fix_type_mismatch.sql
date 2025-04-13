-- Script pour résoudre l'incompatibilité de types entre requests.service_id et services.id
BEGIN;

-- Vérifier les types des colonnes avant de commencer
DO $$
DECLARE
    service_id_type TEXT;
    services_id_type TEXT;
BEGIN
    -- Vérifier le type de la colonne service_id dans la table requests
    SELECT data_type INTO service_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'service_id';
    
    -- Vérifier le type de la colonne id dans la table services
    SELECT data_type INTO services_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'id';
    
    RAISE NOTICE 'Type de requests.service_id: %', service_id_type;
    RAISE NOTICE 'Type de services.id: %', services_id_type;
    
    -- Si service_id est de type uuid et services.id est de type text
    IF service_id_type = 'uuid' AND services_id_type = 'text' THEN
        -- Supprimer d'abord la contrainte de clé étrangère si elle existe
        ALTER TABLE public.requests
        DROP CONSTRAINT IF EXISTS requests_service_id_fkey;
        
        -- Supprimer l'index existant sur service_id si nécessaire
        DROP INDEX IF EXISTS idx_requests_service_id;
        
        -- Modifier le type de la colonne service_id dans requests
        ALTER TABLE public.requests
        ALTER COLUMN service_id TYPE TEXT USING service_id::TEXT;
        
        -- Recréer la contrainte de clé étrangère
        ALTER TABLE public.requests
        ADD CONSTRAINT requests_service_id_fkey
        FOREIGN KEY (service_id)
        REFERENCES public.services(id)
        ON DELETE SET NULL;
        
        -- Recréer l'index
        CREATE INDEX idx_requests_service_id ON public.requests(service_id);
        
        RAISE NOTICE 'Type de service_id modifié de UUID à TEXT et contrainte recréée';
    ELSIF service_id_type = 'text' AND services_id_type = 'uuid' THEN
        -- Si c'est l'inverse, on modifie services.id
        RAISE EXCEPTION 'Impossible de modifier le type de services.id car cela pourrait affecter d''autres tables';
    ELSIF service_id_type IS NULL THEN
        RAISE NOTICE 'La colonne service_id n''existe pas dans la table requests';
    ELSIF services_id_type IS NULL THEN
        RAISE NOTICE 'La table services ou la colonne id n''existe pas';
    ELSE
        RAISE NOTICE 'Aucune modification nécessaire, les types sont compatibles';
    END IF;
END $$;

-- Corriger la vue requests_with_services
DROP VIEW IF EXISTS public.requests_with_services;

CREATE OR REPLACE VIEW public.requests_with_services AS
SELECT 
    r.*,
    s.name AS service_name,
    s.category AS service_category,
    s.description AS service_description
FROM 
    public.requests r
LEFT JOIN 
    public.services s ON r.service_id = s.id;

-- Corriger la vue requests_by_service
DROP VIEW IF EXISTS requests_by_service;

CREATE OR REPLACE VIEW requests_by_service AS
SELECT 
  r.*,
  s.name AS service_name,
  s.category AS service_category
FROM 
  requests r
LEFT JOIN
  services s ON r.service_id = s.id
WHERE 
  r.status IN ('pending', 'offered');

-- Corriger la fonction RPC
DROP FUNCTION IF EXISTS get_requests_by_prestataire_services(UUID);

CREATE OR REPLACE FUNCTION get_requests_by_prestataire_services(p_prestataire_id UUID)
RETURNS SETOF requests_by_service AS $$
DECLARE
  v_service_ids TEXT[];
BEGIN
  -- Récupérer les IDs des services du prestataire
  SELECT array_agg(service_id) INTO v_service_ids
  FROM prestataire_services
  WHERE prestataire_id = p_prestataire_id;
  
  -- Si le prestataire n'a pas sélectionné de services, renvoyer toutes les demandes
  IF v_service_ids IS NULL OR array_length(v_service_ids, 1) = 0 THEN
    RETURN QUERY
    SELECT * FROM requests_by_service;
  ELSE
    -- Sinon, filtrer par services
    RETURN QUERY
    SELECT * FROM requests_by_service
    WHERE service_id = ANY(v_service_ids);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;