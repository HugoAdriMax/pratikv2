-- Script de test pour les activations prestataires
-- Ce script permet de vérifier si les permissions RLS fonctionnent correctement

-- 1. Vérifier que la table prestataire_activations existe
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_name = 'prestataire_activations'
);

-- 2. Vérifier la structure de la table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'prestataire_activations'
ORDER BY ordinal_position;

-- 3. Vérifier les politiques RLS actuelles sur la table
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive,
    roles,
    cmd, 
    qual, 
    with_check
FROM pg_policies
WHERE tablename = 'prestataire_activations'
ORDER BY policyname;

-- 4. Vérifier les permissions sur la table
SELECT 
    grantee, 
    table_name, 
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'prestataire_activations'
ORDER BY grantee, privilege_type;

-- 5. Compter le nombre d'entrées dans la table
SELECT COUNT(*) FROM public.prestataire_activations;

-- 6. Récupérer le nombre de prestataires qui ont soumis leur KYC mais n'ont pas d'activation
SELECT COUNT(*) 
FROM public.users 
WHERE 
    role = 'prestataire' 
    AND kyc_submitted = TRUE 
    AND NOT EXISTS (
        SELECT 1 
        FROM public.prestataire_activations 
        WHERE user_id = users.id
    );

-- 7. Lister les 5 dernières activations
SELECT 
    pa.id, 
    pa.user_id, 
    u.email, 
    pa.status, 
    pa.created_at, 
    pa.updated_at
FROM public.prestataire_activations pa
JOIN public.users u ON pa.user_id = u.id
ORDER BY pa.created_at DESC
LIMIT 5;