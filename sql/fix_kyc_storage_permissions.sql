-- Verify and fix storage bucket permissions for KYC documents
-- This ensures that authenticated users can upload and admins can view the documents

BEGIN;

-- Check if the policy already exists
DO 188629
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Prestataires can upload KYC documents'
  ) THEN
    -- Create policy for prestataires to upload their own KYC documents
    CREATE POLICY "Prestataires can upload KYC documents"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'kyc-documents' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
    
    RAISE NOTICE 'Created upload policy for KYC documents';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Users can view their own KYC documents'
  ) THEN
    -- Create policy for prestataires to view their own KYC documents
    CREATE POLICY "Users can view their own KYC documents"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'kyc-documents' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
    
    RAISE NOTICE 'Created view policy for own KYC documents';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Admins can view all KYC documents'
  ) THEN
    -- Create policy for admins to view all KYC documents
    CREATE POLICY "Admins can view all KYC documents"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'kyc-documents' AND
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
      )
    );
    
    RAISE NOTICE 'Created admin view policy for KYC documents';
  END IF;
END 188629;

-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name)
VALUES ('kyc-documents', 'KYC Documents')
ON CONFLICT (id) DO NOTHING;

COMMIT;
