-- Create a function to handle KYC data submission
CREATE OR REPLACE FUNCTION public.submit_kyc_data(
  input_user_id UUID,
  business_name TEXT,
  user_address TEXT DEFAULT NULL,
  business_reg_num TEXT DEFAULT NULL,
  doc_data TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- 1. Update user information
  UPDATE public.users
  SET 
    name = business_name,
    address = user_address,
    business_reg_number = business_reg_num,
    kyc_submitted = TRUE,
    updated_at = NOW()
  WHERE id = input_user_id;
  
  -- 2. Create or update KYC entry
  INSERT INTO public.kyc (user_id, doc_url, status)
  VALUES (input_user_id, doc_data, 'pending')
  ON CONFLICT (user_id) DO UPDATE
  SET doc_url = EXCLUDED.doc_url,
      status = 'pending',
      updated_at = NOW();
  
  -- 3. Return result
  result = jsonb_build_object(
    'status', 'success',
    'message', 'KYC data submitted successfully',
    'user_id', input_user_id
  );
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  result = jsonb_build_object(
    'status', 'error',
    'message', SQLERRM,
    'code', SQLSTATE
  );
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to retrieve KYC documents with proper parsing
CREATE OR REPLACE FUNCTION public.get_kyc_documents(
  user_id_param UUID
) RETURNS JSONB AS $$
DECLARE
  doc_result RECORD;
  parsed_result JSONB;
BEGIN
  -- Get KYC document data
  SELECT * FROM public.kyc 
  WHERE user_id = user_id_param
  ORDER BY created_at DESC LIMIT 1
  INTO doc_result;
  
  IF doc_result IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'No KYC documents found for this user'
    );
  END IF;
  
  -- Attempt to parse the document URL as JSON
  BEGIN
    parsed_result = doc_result.doc_url::jsonb;
  EXCEPTION WHEN OTHERS THEN
    -- If it's not valid JSON, create a simple structure
    parsed_result = jsonb_build_object(
      'idCardUrl', doc_result.doc_url,
      'businessDocUrl', NULL
    );
  END;
  
  -- Return the document data
  RETURN jsonb_build_object(
    'status', 'success',
    'kyc_id', doc_result.id,
    'kyc_status', doc_result.status,
    'created_at', doc_result.created_at,
    'documents', parsed_result
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;