-- Add is_active column to prestataire_activations table
-- This script is idempotent and can be run multiple times safely

DO $$
BEGIN
  -- Check if is_active column exists in prestataire_activations table
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'prestataire_activations' AND column_name = 'is_active'
  ) THEN
    -- Add the is_active column with default value TRUE
    ALTER TABLE prestataire_activations ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    
    -- Set all existing records to active
    UPDATE prestataire_activations SET is_active = TRUE;
    
    -- Add an index for better query performance
    CREATE INDEX idx_prestataire_activations_is_active ON prestataire_activations(is_active);
    
    RAISE NOTICE 'Added is_active column to prestataire_activations table';
  ELSE
    RAISE NOTICE 'is_active column already exists in prestataire_activations table';
  END IF;
END $$;

-- Create or replace the policy to only show active records
DROP POLICY IF EXISTS prestataire_activations_select_policy ON prestataire_activations;
CREATE POLICY prestataire_activations_select_policy ON prestataire_activations 
  FOR SELECT USING (
    (auth.uid() = user_id OR 
     auth.uid() = admin_id OR 
     EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')) 
    AND is_active = TRUE
  );

-- Ensure RLS is enabled on the table
ALTER TABLE prestataire_activations ENABLE ROW LEVEL SECURITY;

-- Create a utility function to cleanup old records (can be run periodically)
CREATE OR REPLACE FUNCTION cleanup_inactive_prestataire_activations()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete inactive records older than 30 days
  DELETE FROM prestataire_activations 
  WHERE is_active = FALSE AND updated_at < NOW() - INTERVAL '30 days'
  RETURNING COUNT(*) INTO deleted_count;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;