-- Version finale qui correspond au nom de paramètre utilisé dans le code

-- Drop la fonction existante
DROP FUNCTION IF EXISTS public.get_prestataire_services(UUID);

-- Créer la fonction avec le paramètre nommé prestataire_id pour correspondre au code
CREATE FUNCTION public.get_prestataire_services("prestataire_id" UUID)
RETURNS TABLE(
    id UUID,
    name TEXT,
    category TEXT,
    description TEXT,
    is_selected BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH selected_services AS (
        SELECT ps.service_id
        FROM prestataire_services ps
        WHERE ps.prestataire_id = "prestataire_id"
    )
    SELECT 
        s.id,
        s.name,
        s.category,
        s.description,
        CASE WHEN s.id IN (SELECT service_id FROM selected_services) THEN true ELSE false END AS is_selected
    FROM 
        services s
    ORDER BY 
        s.category, 
        s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ajouter des permissions
GRANT EXECUTE ON FUNCTION public.get_prestataire_services(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_prestataire_services(UUID) TO service_role;

-- Rafraîchir le schéma
NOTIFY pgrst, 'reload schema';