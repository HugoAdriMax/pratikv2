-- Fix ambiguité sur le paramètre prestataire_id
-- Cette fonction retourne uniquement les services sélectionnés

-- Supprimer la fonction existante si elle existe
DROP FUNCTION IF EXISTS public.get_prestataire_services(UUID);

-- Create the function with a parameter named differently from column names
CREATE OR REPLACE FUNCTION public.get_prestataire_services(p_prestataire_id UUID)
RETURNS SETOF jsonb AS $$
DECLARE
    result jsonb;
BEGIN
    -- For each service selected by the prestataire
    FOR result IN
        SELECT jsonb_build_object(
            'id', s.id::text,
            'name', s.name,
            'category', s.category,
            'description', s.description,
            'is_selected', true
        ) AS service
        FROM services s
        JOIN prestataire_services ps ON s.id = ps.service_id 
        WHERE ps.prestataire_id = p_prestataire_id
        ORDER BY s.category, s.name
    LOOP
        RETURN NEXT result;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add permissions
GRANT EXECUTE ON FUNCTION public.get_prestataire_services(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_prestataire_services(UUID) TO service_role;

-- Refresh schema
NOTIFY pgrst, 'reload schema';