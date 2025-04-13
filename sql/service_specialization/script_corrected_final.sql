-- Script pour gérer les données existantes et créer une structure correcte
BEGIN;

-- Étape 1: Identifier les valeurs service_id orphelines dans requests
CREATE TEMP TABLE orphaned_service_ids AS
SELECT DISTINCT r.service_id
FROM public.requests r
LEFT JOIN public.services s ON r.service_id::TEXT = s.id
WHERE r.service_id IS NOT NULL AND s.id IS NULL;

-- Étape 2: Afficher les IDs orphelins pour information
DO $$
DECLARE
    orphan_count INTEGER;
    orphan_record RECORD;
BEGIN
    SELECT COUNT(*) INTO orphan_count FROM orphaned_service_ids;
    RAISE NOTICE 'Nombre de service_id orphelins dans la table requests: %', orphan_count;
    
    -- Afficher les IDs orphelins
    IF orphan_count > 0 THEN
        RAISE NOTICE 'Liste des service_id orphelins:';
        FOR orphan_record IN SELECT * FROM orphaned_service_ids LOOP
            RAISE NOTICE '%', orphan_record.service_id;
        END LOOP;
    END IF;
END $$;

-- Étape 3: Créer des entrées correspondantes dans la table services
DO $$
DECLARE
    orphan_record RECORD;
    service_name TEXT;
    new_service_id TEXT;
BEGIN
    -- Parcourir chaque service_id orphelin
    FOR orphan_record IN SELECT * FROM orphaned_service_ids LOOP
        -- Générer un nom unique et un nouvel ID (une version texte de l'UUID)
        service_name := 'Service généré ' || orphan_record.service_id;
        new_service_id := orphan_record.service_id::TEXT;
        
        -- Insérer un nouveau service
        BEGIN
            INSERT INTO public.services (id, name, category, description)
            VALUES (new_service_id, service_name, 'Autre', 'Service généré automatiquement');
            
            RAISE NOTICE 'Service créé avec ID: %', new_service_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Impossible de créer le service pour ID: % (erreur: %)', new_service_id, SQLERRM;
        END;
    END LOOP;
END $$;

-- Étape 4: Mettre à NULL les service_id orphelins restants
UPDATE public.requests
SET service_id = NULL
WHERE service_id IN (SELECT service_id FROM orphaned_service_ids)
AND NOT EXISTS (
    SELECT 1 FROM public.services s WHERE s.id = public.requests.service_id::TEXT
);

-- Étape 5: Vérifier qu'il ne reste plus de service_id orphelins
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM public.requests r
    LEFT JOIN public.services s ON r.service_id::TEXT = s.id
    WHERE r.service_id IS NOT NULL AND s.id IS NULL;
    
    IF orphan_count > 0 THEN
        RAISE NOTICE 'Attention: Il reste % service_id orphelins', orphan_count;
    ELSE
        RAISE NOTICE 'Tous les service_id orphelins ont été traités';
    END IF;
END $$;

-- Étape 6: Supprimer la contrainte existante si elle existe
ALTER TABLE public.requests
DROP CONSTRAINT IF EXISTS requests_service_id_fkey;

-- Étape 7: S'assurer que service_id est bien de type TEXT 
DO $$
DECLARE
    service_id_type TEXT;
BEGIN
    SELECT data_type INTO service_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'service_id';
    
    IF service_id_type IS NOT NULL AND service_id_type <> 'text' THEN
        -- Convertir service_id en TEXT
        ALTER TABLE public.requests
        ALTER COLUMN service_id TYPE TEXT USING service_id::TEXT;
        
        RAISE NOTICE 'Type de service_id converti en TEXT';
    ELSIF service_id_type IS NULL THEN
        RAISE NOTICE 'La colonne service_id n''existe pas dans la table requests';
        
        -- Si la colonne n'existe pas, l'ajouter
        ALTER TABLE public.requests
        ADD COLUMN service_id TEXT;
        
        RAISE NOTICE 'Colonne service_id ajoutée';
    ELSE
        RAISE NOTICE 'Type de service_id déjà en TEXT';
    END IF;
END $$;

-- Étape 8: Recréer la contrainte de clé étrangère
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.requests
        ADD CONSTRAINT requests_service_id_fkey
        FOREIGN KEY (service_id)
        REFERENCES public.services(id)
        ON DELETE SET NULL;
        
        RAISE NOTICE 'Contrainte de clé étrangère recréée avec succès';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erreur lors de la création de la contrainte: %', SQLERRM;
        
        -- Vérifier s'il reste des orphelins
        DECLARE
            orphan_count INTEGER;
        BEGIN
            SELECT COUNT(*) INTO orphan_count
            FROM public.requests r
            LEFT JOIN public.services s ON r.service_id::TEXT = s.id
            WHERE r.service_id IS NOT NULL AND s.id IS NULL;
            
            IF orphan_count > 0 THEN
                RAISE NOTICE 'Il reste % service_id orphelins. Les mettre à NULL...', orphan_count;
                
                -- Dernière tentative: mettre tous les orphelins à NULL
                UPDATE public.requests r
                SET service_id = NULL
                WHERE r.service_id IS NOT NULL 
                AND NOT EXISTS (SELECT 1 FROM public.services s WHERE s.id = r.service_id::TEXT);
                
                -- Réessayer de créer la contrainte
                ALTER TABLE public.requests
                ADD CONSTRAINT requests_service_id_fkey
                FOREIGN KEY (service_id)
                REFERENCES public.services(id)
                ON DELETE SET NULL;
                
                RAISE NOTICE 'Contrainte créée après avoir mis les orphelins à NULL';
            END IF;
        END;
    END;
END $$;

-- Étape 9: Recréer l'index
DROP INDEX IF EXISTS idx_requests_service_id;
CREATE INDEX idx_requests_service_id ON public.requests(service_id);

-- Étape 10: Créer/corriger les vues

-- Vue pour faciliter les requêtes avec jointure
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

-- Vue pour les demandes avec statut spécifique
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

-- Étape 11: Créer/corriger les fonctions RPC

-- Fonction pour obtenir les demandes par service de prestataire
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

-- Étape 12: Accorder les permissions
GRANT ALL ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
GRANT SELECT ON public.requests_with_services TO authenticated;
GRANT SELECT ON public.requests_by_service TO authenticated;

COMMIT;