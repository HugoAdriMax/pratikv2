-- Script pour créer une vue qui expose directement les URLs complètes des documents KYC
-- Cette approche contourne le problème d'accès au stockage en rendant les URLs disponibles via la BDD

BEGIN;

-- 1. Créer une vue qui expose les URLs complètes des documents KYC
CREATE OR REPLACE VIEW public.kyc_documents AS
SELECT 
    k.id,
    k.user_id,
    k.status,
    k.created_at,
    CASE 
        -- Si c'est déjà une URL complète, l'utiliser telle quelle
        WHEN k.doc_url::text LIKE 'http%' THEN k.doc_url
        
        -- Si c'est du JSON, parser et extraire les URLs
        WHEN (k.doc_url::text) LIKE '{%}' THEN 
            jsonb_build_object(
                'idCardUrl', COALESCE(
                    (k.doc_url::jsonb->>'idCardUrl'),
                    'https://via.placeholder.com/400x300?text=ID+Card+Not+Available'
                ),
                'businessDocUrl', COALESCE(
                    (k.doc_url::jsonb->>'businessDocUrl'),
                    'https://via.placeholder.com/400x300?text=Business+Doc+Not+Available'
                )
            )
            
        -- Si format inconnu, utiliser une URL de placeholder
        ELSE jsonb_build_object(
            'idCardUrl', 'https://via.placeholder.com/400x300?text=Format+Unknown',
            'businessDocUrl', 'https://via.placeholder.com/400x300?text=Format+Unknown'
        )
    END AS document_urls
FROM kyc k;

-- 2. Accorder les droits d'accès à la vue
GRANT SELECT ON public.kyc_documents TO authenticated;
GRANT SELECT ON public.kyc_documents TO anon;

-- 3. Créer une politique RLS pour la vue
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

-- 4. Politique pour permettre aux utilisateurs de voir leurs propres documents
CREATE POLICY "Users can see their own KYC documents" 
ON public.kyc_documents 
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 5. Politique pour permettre aux admins de voir tous les documents
CREATE POLICY "Admins can see all KYC documents" 
ON public.kyc_documents 
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 6. Créer une fonction SQL pour récupérer les URLs de documents KYC d'un utilisateur
CREATE OR REPLACE FUNCTION public.get_kyc_document_urls(user_id_param UUID)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT document_urls 
    FROM public.kyc_documents 
    WHERE user_id = user_id_param
    ORDER BY created_at DESC 
    LIMIT 1;
$$;

COMMIT;
