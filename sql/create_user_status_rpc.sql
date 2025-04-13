-- Create RPC function to update user status safely (avoiding schema cache issues)
CREATE OR REPLACE FUNCTION update_user_status(
  user_id UUID,
  is_user_active BOOLEAN,
  is_user_verified BOOLEAN DEFAULT NULL
)
RETURNS VOID AS 188629
BEGIN
  -- Check if is_user_verified is provided
  IF is_user_verified IS NULL THEN
    UPDATE public.users 
    SET is_active = is_user_active
    WHERE id = user_id;
  ELSE
    UPDATE public.users 
    SET 
      is_active = is_user_active,
      is_verified = is_user_verified
    WHERE id = user_id;
  END IF;
END;
188629 LANGUAGE plpgsql;
