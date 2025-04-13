-- Improved function to properly manage prestataire activation status
-- This version ensures rejected requests stay rejected and don't reappear

CREATE OR REPLACE FUNCTION public.manage_prestataire_status(
  prestataire_id UUID,
  new_status TEXT, -- 'approved', 'rejected', 'pending'
  admin_id UUID,
  notes_param TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  current_activation_id UUID;
  result JSONB;
BEGIN
  -- Handling duplicate activations - ensure there's only one active record
  -- First deactivate any existing activations for this user
  UPDATE prestataire_activations 
  SET is_active = FALSE,
      updated_at = now()
  WHERE user_id = prestataire_id AND is_active = TRUE;
  
  -- Create a new activation record
  INSERT INTO prestataire_activations (
    user_id, 
    status, 
    admin_id, 
    notes,
    is_active
  ) 
  VALUES (
    prestataire_id, 
    new_status, 
    admin_id, 
    COALESCE(notes_param, ''),
    TRUE
  )
  RETURNING id INTO current_activation_id;
  
  -- Update the user's status based on the activation status
  UPDATE users 
  SET 
    is_active = CASE 
      WHEN new_status = 'approved' THEN TRUE 
      ELSE FALSE 
    END,
    is_verified = CASE 
      WHEN new_status = 'approved' THEN TRUE 
      ELSE users.is_verified 
    END
  WHERE id = prestataire_id;
  
  -- Return the result with all relevant info
  result = jsonb_build_object(
    'action', 'created',
    'activation_id', current_activation_id,
    'user_id', prestataire_id,
    'status', new_status,
    'is_active', TRUE
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add is_active column to prestataire_activations table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'prestataire_activations' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE prestataire_activations ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    
    -- Set existing records to active
    UPDATE prestataire_activations SET is_active = TRUE;
    
    -- Add index for performance
    CREATE INDEX idx_prestataire_activations_is_active ON prestataire_activations(is_active);
  END IF;
END $$;

-- Create policy to restrict access to active activations only
DROP POLICY IF EXISTS prestataire_activations_select_policy ON prestataire_activations;
CREATE POLICY prestataire_activations_select_policy ON prestataire_activations 
  FOR SELECT USING (
    (auth.uid() = user_id OR 
     auth.uid() = admin_id OR 
     EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')) 
    AND is_active = TRUE
  );

-- Create a function to get the latest activation status
CREATE OR REPLACE FUNCTION get_latest_prestataire_status(p_user_id UUID) 
RETURNS TEXT AS $$
DECLARE
  latest_status TEXT;
BEGIN
  SELECT status INTO latest_status 
  FROM prestataire_activations 
  WHERE user_id = p_user_id AND is_active = TRUE
  ORDER BY created_at DESC 
  LIMIT 1;
  
  RETURN COALESCE(latest_status, 'pending');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;