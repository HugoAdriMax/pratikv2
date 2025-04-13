-- Script complet pour résoudre les problèmes de types de colonnes
-- Supprimer d'abord les tables existantes pour éviter tout conflit
BEGIN;

-- Vérification de l'existence des tables et des types de colonnes
DO $$
DECLARE
    service_id_type TEXT;
    has_service_table BOOLEAN;
BEGIN
    -- Vérifier si la table services existe
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'services'
    ) INTO has_service_table;
    
    -- Si la table existe, vérifier le type de la colonne id
    IF has_service_table THEN
        SELECT data_type INTO service_id_type
        FROM information_schema.columns
        WHERE table_name = 'services' AND column_name = 'id';
        
        RAISE NOTICE 'Table services exists with id type: %', service_id_type;
        
        -- Si le type est uuid, supprimer la table
        IF service_id_type = 'uuid' THEN
            RAISE NOTICE 'Dropping services table because id is UUID';
            DROP TABLE IF EXISTS prestataire_services CASCADE;
            DROP TABLE IF EXISTS services CASCADE;
        END IF;
    ELSE
        RAISE NOTICE 'Services table does not exist yet';
    END IF;
END $$;

-- Créer la table des services avec id de type TEXT
CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Créer la table de relation prestataire-services
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

-- Ajouter les politiques RLS
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestataire_services ENABLE ROW LEVEL SECURITY;

-- Politiques pour les services
CREATE POLICY services_select ON services FOR SELECT USING (true);
CREATE POLICY services_insert ON services FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY services_update ON services FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY services_delete ON services FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Politiques pour prestataire_services
CREATE POLICY prestataire_services_select ON prestataire_services FOR SELECT USING (
    auth.uid() = prestataire_id OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY prestataire_services_insert ON prestataire_services FOR INSERT WITH CHECK (
    auth.uid() = prestataire_id OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY prestataire_services_update ON prestataire_services FOR UPDATE USING (
    auth.uid() = prestataire_id OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY prestataire_services_delete ON prestataire_services FOR DELETE USING (
    auth.uid() = prestataire_id OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Vue pour faciliter les requêtes
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

-- Permissions sur la vue
GRANT SELECT ON prestataire_services_view TO authenticated;

-- Ajouter les services prédéfinis
INSERT INTO services (id, name, category, description)
VALUES 
('plomberie', 'Plomberie', 'Artisanat', 'Services de plomberie pour réparations et installations'),
('electricite', 'Électricité', 'Artisanat', 'Services électriques pour installations et dépannages'),
('menuiserie', 'Menuiserie', 'Artisanat', 'Travaux de menuiserie et charpente'),
('peinture', 'Peinture', 'Artisanat', 'Services de peinture intérieure et extérieure'),
('jardinage', 'Jardinage', 'Extérieur', 'Services d''entretien de jardin et d''aménagement paysager'),
('nettoyage', 'Nettoyage', 'Entretien', 'Services de nettoyage professionnel'),
('plaquiste', 'Plaquiste', 'Artisanat', 'Installation de cloisons et plafonds en placo'),
('carrelage', 'Carrelage', 'Artisanat', 'Pose de carrelage et faïence')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

-- Fonction RPC pour obtenir les services d'un prestataire
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

-- Fonction RPC pour mettre à jour les services d'un prestataire
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
    -- Si service doit être sélectionné
    IF p_selected THEN
        -- Insérer ou mettre à jour la sélection
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
        RETURNING jsonb_build_object('id', id::text) INTO result;
    ELSE
        -- Si service déselectionné, le supprimer
        DELETE FROM prestataire_services 
        WHERE prestataire_id = p_prestataire_id AND service_id = p_service_id
        RETURNING jsonb_build_object('id', id::text, 'removed', true) INTO result;
        
        -- Si aucune ligne n'a été supprimée, définir un résultat par défaut
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

-- Champ pour suivre si prestataire a sélectionné des services
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'has_selected_services'
  ) THEN
    ALTER TABLE users ADD COLUMN has_selected_services BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Fonction pour mettre à jour le statut de sélection des services
CREATE OR REPLACE FUNCTION update_prestataire_service_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour has_selected_services quand des services sont ajoutés ou supprimés
  IF (TG_OP = 'INSERT') THEN
    UPDATE users 
    SET has_selected_services = true
    WHERE id = NEW.prestataire_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE users 
    SET has_selected_services = 
      CASE 
        WHEN (SELECT COUNT(*) FROM prestataire_services WHERE prestataire_id = OLD.prestataire_id) > 0 
        THEN true 
        ELSE false 
      END
    WHERE id = OLD.prestataire_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger pour mettre à jour le statut du service
DROP TRIGGER IF EXISTS update_service_status_trigger ON prestataire_services;
CREATE TRIGGER update_service_status_trigger
AFTER INSERT OR DELETE ON prestataire_services
FOR EACH ROW
EXECUTE FUNCTION update_prestataire_service_status();

COMMIT;