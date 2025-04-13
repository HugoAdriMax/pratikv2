-- Fonction pour retourner UNIQUEMENT les services sélectionnés par un prestataire
-- Cette version est spécifiquement pour les badges de services dans le profil

-- Supprimer la fonction si elle existe déjà
DROP FUNCTION IF EXISTS public.get_selected_services(UUID);

-- Créer la fonction avec paramètre non-ambigu
CREATE OR REPLACE FUNCTION public.get_selected_services(p_prestataire_id UUID)
RETURNS TABLE(
    id UUID,
    name TEXT,
    category TEXT,
    description TEXT,
    is_selected BOOLEAN
) AS $$
BEGIN
    -- Retourner uniquement les services sélectionnés
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.category,
        s.description,
        TRUE AS is_selected  -- Toujours true puisqu'on ne retourne que les services sélectionnés
    FROM 
        services s
    JOIN 
        prestataire_services ps ON s.id = ps.service_id
    WHERE 
        ps.prestataire_id = p_prestataire_id
    ORDER BY 
        s.category, 
        s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ajouter des permissions
GRANT EXECUTE ON FUNCTION public.get_selected_services(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_selected_services(UUID) TO service_role;

-- Rafraîchir le schéma
NOTIFY pgrst, 'reload schema';