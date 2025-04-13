-- Fonction RPC pour obtenir les services d'un prestataire

-- Supprimer la fonction existante si elle existe
DROP FUNCTION IF EXISTS public.get_prestataire_services(UUID);

-- Créer la fonction qui retourne les services d'un prestataire avec leur statut de sélection
CREATE FUNCTION public.get_prestataire_services(prestataire_id UUID)
RETURNS SETOF jsonb AS $$
DECLARE
    service_data jsonb;
BEGIN
    -- Sélectionner toutes les informations des services et leur statut de sélection
    FOR service_data IN
        WITH ps AS (
            SELECT 
                service_id, 
                is_selected, 
                experience_years, 
                hourly_rate
            FROM 
                prestataire_services
            WHERE 
                prestataire_id = $1
        )
        SELECT
            json_build_object(
                'id', s.id,
                'name', s.name,
                'category', s.category,
                'description', s.description,
                'is_selected', COALESCE(ps.is_selected, false),
                'experience_years', ps.experience_years,
                'hourly_rate', ps.hourly_rate
            ) AS service
        FROM
            services s
        LEFT JOIN
            ps ON s.id = ps.service_id
        ORDER BY
            s.category ASC, s.name ASC
    LOOP
        RETURN NEXT service_data;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ajouter des permissions pour toutes les utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION public.get_prestataire_services(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_prestataire_services(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_prestataire_services(UUID) TO service_role;

-- Notifier le changement de schéma
NOTIFY pgrst, 'reload schema';
