-- Script pour ajouter une relation entre requests et services
BEGIN;

-- Vérifier si la table requests existe
DO $$
DECLARE
    table_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'requests'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        -- Créer la table requests si elle n'existe pas
        CREATE TABLE public.requests (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            description TEXT,
            location_lat FLOAT,
            location_lng FLOAT,
            location_address TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            prestataire_status TEXT,
            is_reviewed BOOLEAN DEFAULT false,
            reviewed_user_id UUID
        );
        
        RAISE NOTICE 'Table requests créée';
    ELSE
        RAISE NOTICE 'Table requests existe déjà';
    END IF;
END $$;

-- Vérifier si la colonne service_id existe dans la table requests
DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'service_id'
    ) INTO column_exists;
    
    IF NOT column_exists THEN
        -- Ajouter la colonne service_id à la table requests
        ALTER TABLE public.requests 
        ADD COLUMN service_id TEXT;
        
        -- Mettre à jour les permissions RLS
        ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
        
        -- Créer une contrainte de clé étrangère vers la table services, mais seulement si la table services existe
        IF EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'services'
        ) THEN
            ALTER TABLE public.requests
            ADD CONSTRAINT requests_service_id_fkey
            FOREIGN KEY (service_id)
            REFERENCES public.services(id)
            ON DELETE SET NULL;
            
            RAISE NOTICE 'Contrainte de clé étrangère ajoutée pour service_id';
        ELSE
            RAISE NOTICE 'Table services n''existe pas, clé étrangère non ajoutée';
        END IF;
        
        RAISE NOTICE 'Colonne service_id ajoutée à la table requests';
    ELSE
        RAISE NOTICE 'Colonne service_id existe déjà dans la table requests';
    END IF;
END $$;

-- Créer un index pour améliorer les performances des requêtes par service_id
CREATE INDEX IF NOT EXISTS idx_requests_service_id ON public.requests(service_id);

-- Créer une vue pour faciliter les requêtes avec jointure
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

-- Accorder les permissions sur la table et la vue
GRANT ALL ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
GRANT SELECT ON public.requests_with_services TO authenticated;

-- Créer des politiques RLS pour la table requests
DO $$
BEGIN
    -- Politique de sélection - Tout le monde peut voir les demandes
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'requests' AND policyname = 'Everyone can view requests'
    ) THEN
        CREATE POLICY "Everyone can view requests"
        ON public.requests
        FOR SELECT
        USING (true);
        
        RAISE NOTICE 'Politique "Everyone can view requests" créée';
    END IF;
    
    -- Politique d'insertion - Seuls les clients peuvent créer des demandes
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'requests' AND policyname = 'Clients can create requests'
    ) THEN
        CREATE POLICY "Clients can create requests"
        ON public.requests
        FOR INSERT
        WITH CHECK (
            auth.uid() = client_id AND
            EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'client')
        );
        
        RAISE NOTICE 'Politique "Clients can create requests" créée';
    END IF;
    
    -- Politique de mise à jour - Les clients peuvent mettre à jour leurs propres demandes
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'requests' AND policyname = 'Clients can update their own requests'
    ) THEN
        CREATE POLICY "Clients can update their own requests"
        ON public.requests
        FOR UPDATE
        USING (auth.uid() = client_id);
        
        RAISE NOTICE 'Politique "Clients can update their own requests" créée';
    END IF;
    
    -- Politique de suppression - Les clients peuvent supprimer leurs propres demandes
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'requests' AND policyname = 'Clients can delete their own requests'
    ) THEN
        CREATE POLICY "Clients can delete their own requests"
        ON public.requests
        FOR DELETE
        USING (auth.uid() = client_id);
        
        RAISE NOTICE 'Politique "Clients can delete their own requests" créée';
    END IF;
END $$;

COMMIT;