-- Add basic services
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