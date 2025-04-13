-- Fix KYC document display issues
-- This script creates and updates functions for better KYC document handling

-- Ensure the get_kyc_documents function exists for retrieving formatted KYC documents
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
    BEGIN
      IF doc_result.doc_url IS NOT NULL THEN
        parsed_result = jsonb_build_object(
          'idCardUrl', doc_result.doc_url,
          'businessDocUrl', NULL
        );
      ELSE
        parsed_result = jsonb_build_object(
          'idCardUrl', NULL,
          'businessDocUrl', NULL
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      parsed_result = jsonb_build_object(
        'idCardUrl', NULL,
        'businessDocUrl', NULL,
        'error', 'Could not parse document URLs'
      );
    END;
  END;
  
  -- Add debug information
  parsed_result = jsonb_set(
    parsed_result, 
    '{debug}', 
    jsonb_build_object(
      'doc_url_type', pg_typeof(doc_result.doc_url)::text,
      'doc_url_length', CASE 
        WHEN doc_result.doc_url IS NULL THEN 0
        WHEN pg_typeof(doc_result.doc_url) = 'text'::regtype THEN length(doc_result.doc_url::text)
        ELSE 0
      END
    )
  );
  
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

-- Create a helper function to migrate any non-JSON doc_url values to proper JSON format
-- This fixes older KYC entries that might not be in the correct format
CREATE OR REPLACE FUNCTION public.fix_kyc_document_formats() RETURNS JSONB AS $$
DECLARE
  result JSONB;
  fixed_count INTEGER := 0;
  failed_count INTEGER := 0;
  rec RECORD;
  doc_url_value TEXT;
  new_doc_json JSONB;
  error_details TEXT[];
BEGIN
  FOR rec IN 
    SELECT id, user_id, doc_url, status 
    FROM public.kyc 
    WHERE doc_url IS NOT NULL
  LOOP
    BEGIN
      -- Check if already valid JSON
      PERFORM rec.doc_url::jsonb;
      -- If we got here, it's valid JSON, continue to next record
      CONTINUE;
    EXCEPTION WHEN OTHERS THEN
      -- Not valid JSON, try to fix it
      BEGIN
        IF pg_typeof(rec.doc_url) = 'text'::regtype THEN
          doc_url_value := rec.doc_url;
          -- Create proper JSON
          new_doc_json := jsonb_build_object(
            'idCardUrl', doc_url_value,
            'businessDocUrl', NULL
          );
          
          -- Update the record
          UPDATE public.kyc 
          SET doc_url = new_doc_json::text
          WHERE id = rec.id;
          
          fixed_count := fixed_count + 1;
        ELSE
          -- Can't fix this type
          error_details := array_append(error_details, 
            format('ID: %s, Type: %s', rec.id, pg_typeof(rec.doc_url)::text)
          );
          failed_count := failed_count + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Record failure
        error_details := array_append(error_details, 
          format('ID: %s, Error: %s', rec.id, SQLERRM)
        );
        failed_count := failed_count + 1;
      END;
    END;
  END LOOP;
  
  result := jsonb_build_object(
    'status', 'completed',
    'fixed_count', fixed_count,
    'failed_count', failed_count,
    'error_details', error_details
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a security policy to ensure kyc docs are accessible by admins
DO $$
BEGIN
  -- Check if policy exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'kyc' 
    AND policyname = 'admins_can_read_kyc'
  ) THEN
    -- Create policy if it doesn't exist
    CREATE POLICY admins_can_read_kyc ON public.kyc
      FOR SELECT
      TO authenticated
      USING (
        auth.uid() IN (
          SELECT id FROM public.users WHERE role = 'admin'
        )
      );
  END IF;
END $$;