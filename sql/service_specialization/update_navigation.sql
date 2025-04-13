-- Add script to update the KYC submission form to include service selection
-- This will add service selection capabilities to the prestataire onboarding process

-- Add a field to track if prestataire has completed service selection
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'has_selected_services'
  ) THEN
    ALTER TABLE users ADD COLUMN has_selected_services BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Function to get the number of services selected by a prestataire
CREATE OR REPLACE FUNCTION get_prestataire_service_count(prestataire_id UUID)
RETURNS INTEGER AS $$
DECLARE
  service_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO service_count
  FROM prestataire_services
  WHERE prestataire_id = get_prestataire_service_count.prestataire_id;
  
  RETURN service_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if prestataire has completed service selection
CREATE OR REPLACE FUNCTION update_prestataire_service_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update has_selected_services when services are added or removed
  IF (TG_OP = 'INSERT' OR TG_OP = 'DELETE') THEN
    UPDATE users 
    SET has_selected_services = 
      CASE 
        WHEN (SELECT COUNT(*) FROM prestataire_services WHERE prestataire_id = NEW.prestataire_id) > 0 
        THEN true 
        ELSE false 
      END
    WHERE id = NEW.prestataire_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update service status
DROP TRIGGER IF EXISTS update_service_status_trigger ON prestataire_services;
CREATE TRIGGER update_service_status_trigger
AFTER INSERT OR DELETE ON prestataire_services
FOR EACH ROW
EXECUTE FUNCTION update_prestataire_service_status();