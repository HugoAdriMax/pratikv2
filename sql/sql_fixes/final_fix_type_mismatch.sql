-- Version finale avec correction des types

-- Supprimer la fonction existante
DROP FUNCTION IF EXISTS public.get_prestataire_services(UUID);

-- Créer une fonction simple qui vérifie juste l'existence des tables et colonnes
CREATE OR REPLACE FUNCTION public.get_prestataire_services(prestataire_id UUID)
RETURNS SETOF jsonb AS $$
DECLARE
    result jsonb;
BEGIN
    -- Vérifier chaque service et déterminer s'il est sélectionné
    FOR result IN
        SELECT jsonb_build_object(
            'id', s.id::text,  -- Conversion explicite en text pour éviter les problèmes de type
            'name', s.name,
            'category', s.category,
            'description', s.description,
            'is_selected', (
                SELECT EXISTS(
                    SELECT 1 
                    FROM prestataire_services ps 
                    WHERE ps.prestataire_id = $1 
                    AND ps.service_id = s.id
                )
            )
        ) AS service
        FROM services s
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
