-- Script pour créer la table user_locations et les fonctionnalités de localisation en temps réel
-- Ce script ajoute le suivi de localisation en temps réel pour les clients et prestataires

-- Début de la transaction
BEGIN;

-- Création de la table user_locations
CREATE TABLE IF NOT EXISTS public.user_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    address TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON public.user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_updated_at ON public.user_locations(updated_at);

-- Fonction pour mettre à jour le timestamp updated_at
CREATE OR REPLACE FUNCTION update_user_location_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement le timestamp updated_at
DROP TRIGGER IF EXISTS trigger_update_user_location_timestamp ON public.user_locations;
CREATE TRIGGER trigger_update_user_location_timestamp
BEFORE UPDATE ON public.user_locations
FOR EACH ROW
EXECUTE FUNCTION update_user_location_timestamp();

-- Fonction pour vérifier et purger les anciennes localisations (plus de 24h)
CREATE OR REPLACE FUNCTION purge_old_locations()
RETURNS void AS $$
BEGIN
    DELETE FROM public.user_locations
    WHERE updated_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- On active la sécurité au niveau des lignes (RLS)
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Politique pour que les utilisateurs puissent voir leurs propres localisations
CREATE POLICY "Users can see their own locations"
    ON public.user_locations
    FOR SELECT
    USING (auth.uid() = user_id);

-- Politique pour que les utilisateurs puissent insérer leurs propres localisations
CREATE POLICY "Users can insert their own locations"
    ON public.user_locations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Politique pour que les utilisateurs puissent mettre à jour leurs propres localisations
CREATE POLICY "Users can update their own locations"
    ON public.user_locations
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Politique pour que les utilisateurs puissent supprimer leurs propres localisations
CREATE POLICY "Users can delete their own locations"
    ON public.user_locations
    FOR DELETE
    USING (auth.uid() = user_id);

-- Politique pour que les utilisateurs puissent voir les localisations associées à leurs missions actives
CREATE POLICY "Users can see job participant locations"
    ON public.user_locations
    FOR SELECT
    USING (
        -- Permet aux prestataires de voir les localisations des clients pour les jobs actifs
        EXISTS (
            SELECT 1 FROM public.jobs 
            WHERE prestataire_id = auth.uid() 
            AND client_id = user_locations.user_id
            AND is_completed = false
        )
        OR
        -- Permet aux clients de voir les localisations des prestataires pour les jobs actifs
        EXISTS (
            SELECT 1 FROM public.jobs 
            WHERE client_id = auth.uid() 
            AND prestataire_id = user_locations.user_id
            AND is_completed = false
        )
    );

-- On accorde les permissions nécessaires
GRANT ALL ON public.user_locations TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.user_locations_id_seq TO authenticated;

-- Fonction pour obtenir la localisation d'un prestataire pour un job spécifique
CREATE OR REPLACE FUNCTION get_prestataire_location(job_id UUID)
RETURNS TABLE (
    latitude FLOAT,
    longitude FLOAT,
    address TEXT,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT ul.latitude, ul.longitude, ul.address, ul.updated_at
    FROM public.jobs j
    JOIN public.user_locations ul ON j.prestataire_id = ul.user_id
    WHERE j.id = job_id
    AND (auth.uid() = j.client_id OR auth.uid() = j.prestataire_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir la localisation d'un client pour un job spécifique
CREATE OR REPLACE FUNCTION get_client_location(job_id UUID)
RETURNS TABLE (
    latitude FLOAT,
    longitude FLOAT,
    address TEXT,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT ul.latitude, ul.longitude, ul.address, ul.updated_at
    FROM public.jobs j
    JOIN public.user_locations ul ON j.client_id = ul.user_id
    WHERE j.id = job_id
    AND (auth.uid() = j.client_id OR auth.uid() = j.prestataire_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour calculer la distance entre deux points (formule de Haversine)
CREATE OR REPLACE FUNCTION calculate_distance(lat1 FLOAT, lon1 FLOAT, lat2 FLOAT, lon2 FLOAT)
RETURNS FLOAT AS $$
DECLARE
    earth_radius FLOAT := 6371; -- Rayon de la Terre en km
    dlat FLOAT;
    dlon FLOAT;
    a FLOAT;
    c FLOAT;
    distance FLOAT;
BEGIN
    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);
    
    a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)^2;
    c := 2 * asin(sqrt(a));
    distance := earth_radius * c;
    
    RETURN distance;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour le statut d'un job en fonction de la distance
CREATE OR REPLACE FUNCTION update_job_status_by_distance()
RETURNS TRIGGER AS $$
DECLARE
    client_lat FLOAT;
    client_lng FLOAT;
    prestataire_lat FLOAT;
    prestataire_lng FLOAT;
    distance FLOAT;
    job_record RECORD;
BEGIN
    -- Récupérer l'ID du job associé
    SELECT j.* INTO job_record
    FROM public.jobs j
    WHERE (j.prestataire_id = NEW.user_id OR j.client_id = NEW.user_id)
    AND j.is_completed = FALSE
    AND j.tracking_status IN ('en_route', 'not_started')
    LIMIT 1;
    
    IF job_record IS NOT NULL THEN
        -- Récupérer les coordonnées du client
        SELECT latitude, longitude INTO client_lat, client_lng
        FROM public.user_locations
        WHERE user_id = job_record.client_id
        ORDER BY updated_at DESC
        LIMIT 1;
        
        -- Récupérer les coordonnées du prestataire
        SELECT latitude, longitude INTO prestataire_lat, prestataire_lng
        FROM public.user_locations
        WHERE user_id = job_record.prestataire_id
        ORDER BY updated_at DESC
        LIMIT 1;
        
        -- Si les deux localisations sont disponibles
        IF client_lat IS NOT NULL AND prestataire_lat IS NOT NULL THEN
            -- Calculer la distance entre le client et le prestataire
            distance := calculate_distance(client_lat, client_lng, prestataire_lat, prestataire_lng);
            
            -- Si la distance est inférieure à 100 mètres et que le statut est 'en_route', mettre à jour à 'arrived'
            IF distance < 0.1 AND job_record.tracking_status = 'en_route' THEN
                UPDATE public.jobs
                SET tracking_status = 'arrived'
                WHERE id = job_record.id;
                
                -- Mettre également à jour le statut dans la demande
                UPDATE public.requests r
                SET prestataire_status = 'arrived'
                FROM public.offers o
                WHERE o.id = job_record.offer_id
                AND r.id = o.request_id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement le statut d'un job en fonction de la distance
DROP TRIGGER IF EXISTS trigger_update_job_status_by_distance ON public.user_locations;
CREATE TRIGGER trigger_update_job_status_by_distance
AFTER INSERT OR UPDATE ON public.user_locations
FOR EACH ROW
EXECUTE FUNCTION update_job_status_by_distance();

-- Activer la réplication temps réel pour les localisations
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_locations;

-- Mise à jour du schéma pour Supabase
NOTIFY pgrst, 'reload schema';

COMMIT;