-- Script pour montrer tous les services d'un prestataire, qu'ils soient sélectionnés ou non

-- Supprimer la fonction existante si elle existe
DROP FUNCTION IF EXISTS public.get_prestataire_services(UUID);

-- Créer la fonction qui montre tous les services
CREATE OR REPLACE FUNCTION public.get_prestataire_services(prestataire_id UUID)
RETURNS SETOF jsonb AS $$
DECLARE
    result jsonb;
BEGIN
    -- Pour chaque service, vérifier s'il est sélectionné par le prestataire
    FOR result IN
        SELECT jsonb_build_object(
            'id', s.id::text,
            'name', s.name,
            'category', s.category,
            'description', s.description,
            'is_selected', CASE WHEN ps.service_id IS NOT NULL THEN true ELSE false END
        ) AS service
        FROM services s
        LEFT JOIN prestataire_services ps ON s.id = ps.service_id AND ps.prestataire_id = $1
        ORDER BY s.category, s.name
    LOOP
        RETURN NEXT result;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ajouter des permissions
GRANT EXECUTE ON FUNCTION public.get_prestataire_services(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_prestataire_services(UUID) TO service_role;

-- Rafraîchir le schéma
NOTIFY pgrst, 'reload schema';
