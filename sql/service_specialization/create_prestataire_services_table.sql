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
GRANT SELECT ON prestataire_services_view TO authenticated;