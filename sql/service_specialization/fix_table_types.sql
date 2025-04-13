DROP TABLE IF EXISTS prestataire_services CASCADE;
DROP TABLE IF EXISTS services CASCADE;
-- Create services table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create a table to store the services offered by each prestataire
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

-- Add RLS policies for the prestataire_services table
ALTER TABLE prestataire_services ENABLE ROW LEVEL SECURITY;

-- Allow prestataires to view their own services
CREATE POLICY prestataire_services_select ON prestataire_services
    FOR SELECT USING (
        auth.uid() = prestataire_id OR
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Allow prestataires to insert their own services
CREATE POLICY prestataire_services_insert ON prestataire_services
    FOR INSERT WITH CHECK (
        auth.uid() = prestataire_id OR
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Allow prestataires to update their own services
CREATE POLICY prestataire_services_update ON prestataire_services
    FOR UPDATE USING (
        auth.uid() = prestataire_id OR
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Allow prestataires to delete their own services
CREATE POLICY prestataire_services_delete ON prestataire_services
    FOR DELETE USING (
        auth.uid() = prestataire_id OR
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Create a view to show prestataires with their services
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

-- Allow all to select from the view
GRANT SELECT ON prestataire_services_view TO authenticated;-- Add basic services
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

-- Add RLS policies to the services table
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view services
CREATE POLICY services_select ON services
    FOR SELECT USING (true);

-- Only allow admins to modify services
CREATE POLICY services_insert ON services
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY services_update ON services
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY services_delete ON services
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Grant access to authenticated users
GRANT SELECT ON services TO authenticated;