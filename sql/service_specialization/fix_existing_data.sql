-- Script pour gérer les données existantes avant de créer la contrainte de clé étrangère
BEGIN;

-- 1. Identifier les valeurs service_id orphelines dans requests
CREATE TEMP TABLE orphaned_service_ids AS
SELECT DISTINCT r.service_id
FROM public.requests r
LEFT JOIN public.services s ON r.service_id::TEXT = s.id
WHERE r.service_id IS NOT NULL AND s.id IS NULL;

-- 2. Afficher les IDs orphelins pour information
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count FROM orphaned_service_ids;
    RAISE NOTICE 'Nombre de service_id orphelins dans la table requests: %', orphan_count;
    
    -- Afficher les IDs orphelins
    IF orphan_count > 0 THEN
        RAISE NOTICE 'Liste des service_id orphelins:';
        FOR orphan_id IN SELECT service_id FROM orphaned_service_ids LOOP
            RAISE NOTICE '%', orphan_id;
        END LOOP;
    END IF;
END $$;

-- 3. Option 1: Créer des entrées correspondantes dans la table services (si approprié)
DO $$
DECLARE
    orphan_id UUID;
    service_name TEXT;
    new_service_id TEXT;
BEGIN
    -- Parcourir chaque service_id orphelin
    FOR orphan_id IN SELECT service_id FROM orphaned_service_ids LOOP
        -- Générer un nom unique et un nouvel ID (une version texte de l'UUID)
        service_name := 'Service généré ' || orphan_id;
        new_service_id := orphan_id::TEXT;
        
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

-- 4. Option 2: Mettre à NULL les service_id orphelins (si Option 1 échoue)
UPDATE public.requests
SET service_id = NULL
WHERE service_id IN (SELECT service_id FROM orphaned_service_ids)
AND NOT EXISTS (
    SELECT 1 FROM public.services s WHERE s.id = public.requests.service_id::TEXT
);

-- Vérifier qu'il ne reste plus de service_id orphelins
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM public.requests r
    LEFT JOIN public.services s ON r.service_id::TEXT = s.id
    WHERE r.service_id IS NOT NULL AND s.id IS NULL;
    
    IF orphan_count > 0 THEN
        RAISE EXCEPTION 'Il reste % service_id orphelins', orphan_count;
    ELSE
        RAISE NOTICE 'Tous les service_id orphelins ont été traités';
    END IF;
END $$;

-- 5. Supprimer la contrainte existante si elle existe
ALTER TABLE public.requests
DROP CONSTRAINT IF EXISTS requests_service_id_fkey;

-- 6. S'assurer que service_id est bien de type TEXT 
DO $$
DECLARE
    service_id_type TEXT;
BEGIN
    SELECT data_type INTO service_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'service_id';
    
    IF service_id_type <> 'text' THEN
        -- Convertir service_id en TEXT
        ALTER TABLE public.requests
        ALTER COLUMN service_id TYPE TEXT USING service_id::TEXT;
        
        RAISE NOTICE 'Type de service_id converti en TEXT';
    ELSE
        RAISE NOTICE 'Type de service_id déjà en TEXT';
    END IF;
END $$;

-- 7. Recréer la contrainte de clé étrangère
ALTER TABLE public.requests
ADD CONSTRAINT requests_service_id_fkey
FOREIGN KEY (service_id)
REFERENCES public.services(id)
ON DELETE SET NULL;

RAISE NOTICE 'Contrainte de clé étrangère recréée avec succès';

-- 8. Recréer l'index
DROP INDEX IF EXISTS idx_requests_service_id;
CREATE INDEX idx_requests_service_id ON public.requests(service_id);

COMMIT;