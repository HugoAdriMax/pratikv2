-- Script pour créer ou mettre à jour la table prestataire_services

-- Vérifier si la table existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'prestataire_services'
    ) THEN
        -- Créer la table prestataire_services si elle n'existe pas
        CREATE TABLE public.prestataire_services (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            prestataire_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
            is_selected BOOLEAN DEFAULT true,
            experience_years INTEGER,
            hourly_rate DECIMAL(10, 2),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(prestataire_id, service_id)
        );
        
        -- Ajouter des commentaires
        COMMENT ON TABLE public.prestataire_services IS 'Services sélectionnés par les prestataires';
        COMMENT ON COLUMN public.prestataire_services.prestataire_id IS 'ID du prestataire';
        COMMENT ON COLUMN public.prestataire_services.service_id IS 'ID du service';
        COMMENT ON COLUMN public.prestataire_services.is_selected IS 'Service sélectionné ou non';
        COMMENT ON COLUMN public.prestataire_services.experience_years IS 'Années d''expérience pour ce service';
        COMMENT ON COLUMN public.prestataire_services.hourly_rate IS 'Tarif horaire pour ce service';
    ELSE
        -- Si la table existe, vérifier si la colonne is_selected existe
        IF NOT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'prestataire_services'
            AND column_name = 'is_selected'
        ) THEN
            -- Ajouter la colonne is_selected si elle n'existe pas
            ALTER TABLE public.prestataire_services
            ADD COLUMN is_selected BOOLEAN DEFAULT true;
            
            COMMENT ON COLUMN public.prestataire_services.is_selected IS 'Service sélectionné ou non';
        END IF;
    END IF;
END
$$;

-- Configurer les permissions RLS
ALTER TABLE public.prestataire_services ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Les prestataires peuvent voir leurs services" ON public.prestataire_services;
DROP POLICY IF EXISTS "Les prestataires peuvent manipuler leurs services" ON public.prestataire_services;
DROP POLICY IF EXISTS "Les admins peuvent tout voir" ON public.prestataire_services;
DROP POLICY IF EXISTS "Service role peut tout faire" ON public.prestataire_services;

-- Créer des politiques RLS
CREATE POLICY "Les prestataires peuvent voir leurs services"
ON public.prestataire_services
FOR SELECT
TO authenticated
USING (
    auth.uid() = prestataire_id OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Les prestataires peuvent manipuler leurs services"
ON public.prestataire_services
FOR ALL
TO authenticated
USING (
    auth.uid() = prestataire_id
)
WITH CHECK (
    auth.uid() = prestataire_id
);

CREATE POLICY "Les admins peuvent tout faire"
ON public.prestataire_services
FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Service role peut tout faire"
ON public.prestataire_services
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Ajouter des permissions sur la table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestataire_services TO authenticated;
GRANT ALL ON public.prestataire_services TO service_role;

-- Ajouter un trigger pour mise à jour auto de updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_prestataire_services_updated_at ON public.prestataire_services;
CREATE TRIGGER update_prestataire_services_updated_at
BEFORE UPDATE ON public.prestataire_services
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Rafraîchir le schéma
NOTIFY pgrst, 'reload schema';