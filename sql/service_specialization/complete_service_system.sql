-- Complete service selection system SQL script

-- 1. Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create services table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Create a table to store the services offered by each prestataire
CREATE TABLE IF NOT EXISTS prestataire_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prestataire_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    experience_years INT,
    hourly_rate DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(prestataire_id, service_id)
);

-- 4. Add RLS policies for the services table
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Check if policy exists before creating
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'services' 
        AND policyname = 'services_select'
    ) THEN
        EXECUTE 'CREATE POLICY services_select ON services
                FOR SELECT USING (true)';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'services' 
        AND policyname = 'services_insert'
    ) THEN
        EXECUTE 'CREATE POLICY services_insert ON services
                FOR INSERT WITH CHECK (
                    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = ''admin'')
                )';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'services' 
        AND policyname = 'services_update'
    ) THEN
        EXECUTE 'CREATE POLICY services_update ON services
                FOR UPDATE USING (
                    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = ''admin'')
                )';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'services' 
        AND policyname = 'services_delete'
    ) THEN
        EXECUTE 'CREATE POLICY services_delete ON services
                FOR DELETE USING (
                    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = ''admin'')
                )';
    END IF;
END $$;

-- 5. Add RLS policies for the prestataire_services table
ALTER TABLE prestataire_services ENABLE ROW LEVEL SECURITY;

-- Check if policy exists before creating
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'prestataire_services' 
        AND policyname = 'prestataire_services_select'
    ) THEN
        EXECUTE 'CREATE POLICY prestataire_services_select ON prestataire_services
                FOR SELECT USING (
                    auth.uid() = prestataire_id OR
                    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = ''admin'')
                )';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'prestataire_services' 
        AND policyname = 'prestataire_services_insert'
    ) THEN
        EXECUTE 'CREATE POLICY prestataire_services_insert ON prestataire_services
                FOR INSERT WITH CHECK (
                    auth.uid() = prestataire_id OR
                    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = ''admin'')
                )';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'prestataire_services' 
        AND policyname = 'prestataire_services_update'
    ) THEN
        EXECUTE 'CREATE POLICY prestataire_services_update ON prestataire_services
                FOR UPDATE USING (
                    auth.uid() = prestataire_id OR
                    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = ''admin'')
                )';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'prestataire_services' 
        AND policyname = 'prestataire_services_delete'
    ) THEN
        EXECUTE 'CREATE POLICY prestataire_services_delete ON prestataire_services
                FOR DELETE USING (
                    auth.uid() = prestataire_id OR
                    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = ''admin'')
                )';
    END IF;
END $$;

-- 6. Create a view to show prestataires with their services
CREATE OR REPLACE VIEW prestataire_services_view AS
SELECT 
    ps.id,
    ps.prestataire_id,
    ps.service_id,
    s.name AS service_name,
    s.category AS service_category,
    ps.experience_years,
    ps.hourly_rate,
    u.name AS prestataire_name,
    u.email AS prestataire_email,
    u.is_verified,
    u.is_active
FROM 
    prestataire_services ps
JOIN 
    services s ON ps.service_id = s.id
JOIN 
    users u ON ps.prestataire_id = u.id;

-- Allow all authenticated users to select from the view
GRANT SELECT ON prestataire_services_view TO authenticated;

-- 7. Add function to get available services for a prestataire with selection status
CREATE OR REPLACE FUNCTION get_prestataire_services(prestataire_id UUID)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    category TEXT,
    description TEXT,
    is_selected BOOLEAN,
    experience_years INT,
    hourly_rate DECIMAL(10, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.category,
        s.description,
        CASE WHEN ps.prestataire_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_selected,
        ps.experience_years,
        ps.hourly_rate
    FROM 
        services s
    LEFT JOIN 
        prestataire_services ps ON s.id = ps.service_id AND ps.prestataire_id = get_prestataire_services.prestataire_id
    ORDER BY 
        s.category, s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Add/update prestataire service selection function
CREATE OR REPLACE FUNCTION update_prestataire_service(
    p_prestataire_id UUID,
    p_service_id TEXT,
    p_selected BOOLEAN,
    p_experience_years INT DEFAULT NULL,
    p_hourly_rate DECIMAL(10, 2) DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- If service should be selected
    IF p_selected THEN
        -- Insert or update the service selection
        INSERT INTO prestataire_services (
            prestataire_id, 
            service_id, 
            experience_years, 
            hourly_rate
        ) 
        VALUES (
            p_prestataire_id, 
            p_service_id, 
            p_experience_years, 
            p_hourly_rate
        )
        ON CONFLICT (prestataire_id, service_id) 
        DO UPDATE SET
            experience_years = COALESCE(p_experience_years, prestataire_services.experience_years),
            hourly_rate = COALESCE(p_hourly_rate, prestataire_services.hourly_rate),
            updated_at = now()
        RETURNING jsonb_build_object('id', id) INTO result;
    ELSE
        -- If service should be deselected, remove it
        DELETE FROM prestataire_services 
        WHERE prestataire_id = p_prestataire_id AND service_id = p_service_id
        RETURNING jsonb_build_object('id', id, 'removed', true) INTO result;
        
        -- If no row was deleted, set a default result
        IF result IS NULL THEN
            result := jsonb_build_object('removed', false, 'message', 'Service was not selected');
        END IF;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'service_id', p_service_id,
        'selected', p_selected,
        'result', result
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'service_id', p_service_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function to get requests filtered by prestataire's services
CREATE OR REPLACE FUNCTION get_requests_by_prestataire_services(p_prestataire_id UUID)
RETURNS SETOF requests AS $$
BEGIN
    RETURN QUERY
    SELECT r.*
    FROM requests r
    WHERE r.service_id IN (
        SELECT ps.service_id
        FROM prestataire_services ps
        WHERE ps.prestataire_id = p_prestataire_id
    )
    AND (r.status = 'pending' OR r.status = 'offered')
    ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Add some basic services if they don't exist
INSERT INTO services (id, name, category, description)
VALUES 
('plomberie', 'Plomberie', 'Artisanat', 'Services de plomberie pour réparations et installations'),
('electricite', 'Électricité', 'Artisanat', 'Services électriques pour installations et dépannages'),
('menuiserie', 'Menuiserie', 'Artisanat', 'Travaux de menuiserie et charpente'),
('peinture', 'Peinture', 'Artisanat', 'Services de peinture intérieure et extérieure'),
('jardinage', 'Jardinage', 'Extérieur', 'Services d''entretien de jardin et d''aménagement paysager'),
('nettoyage', 'Nettoyage', 'Entretien', 'Services de nettoyage professionnel'),
('plaquiste', 'Plaquiste', 'Artisanat', 'Installation de cloisons et plafonds en placo'),
('carrelage', 'Carrelage', 'Artisanat', 'Pose de carrelage et faïence'),
('climatisation', 'Climatisation', 'Artisanat', 'Installation et entretien de systèmes de climatisation'),
('serrurerie', 'Serrurerie', 'Artisanat', 'Services de serrurerie et installation de systèmes de sécurité'),
('demenagement', 'Déménagement', 'Services', 'Services de déménagement et transport de meubles'),
('informatique', 'Informatique', 'Services', 'Dépannage et assistance informatique'),
('gardiennage', 'Gardiennage', 'Services', 'Services de surveillance et gardiennage'),
('cours-particuliers', 'Cours particuliers', 'Éducation', 'Cours particuliers à domicile'),
('coiffure', 'Coiffure', 'Bien-être', 'Services de coiffure à domicile'),
('massage', 'Massage', 'Bien-être', 'Services de massage et bien-être')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;