-- Script pour inspecter les entrées KYC et leur format

-- 1. Examiner la structure de la table KYC
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'kyc';

-- 2. Examiner les 10 premières entrées KYC
SELECT id, user_id, doc_url, status, created_at, updated_at
FROM kyc
LIMIT 10;

-- 3. Vérifier quel format est utilisé pour doc_url 
-- (json ou texte)
SELECT 
    user_id,
    pg_typeof(doc_url) as type,
    CASE 
        WHEN (doc_url::text) LIKE '{%}' THEN 'JSON format'
        WHEN (doc_url::text) LIKE 'http%' THEN 'URL format'
        ELSE 'Unknown format'
    END as format_type,
    LEFT(doc_url::text, 100) as sample
FROM kyc
LIMIT 10;

-- 4. Vérifier si les fichiers existent dans storage
SELECT 
    name,
    created_at
FROM storage.objects
WHERE bucket_id = 'chat-media' 
AND name LIKE 'kyc-documents/%'
ORDER BY created_at DESC
LIMIT 20;

-- 5. Vérifier les politiques d'accès au bucket
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qualifier
FROM pg_catalog.pg_policies
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND qualifier LIKE '%chat-media%';
