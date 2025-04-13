-- Add function to get available services for a prestataire with selection status
CREATE OR REPLACE FUNCTION get_prestataire_services(prestataire_id UUID)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    category TEXT,
    description TEXT,
    is_selected BOOLEAN,
    experience_years INT,
    hourly_rate DECIMAL(10, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.category,
        s.description,
        CASE WHEN ps.prestataire_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_selected,
        ps.experience_years,
        ps.hourly_rate
    FROM 
        services s
    LEFT JOIN 
        prestataire_services ps ON s.id = ps.service_id AND ps.prestataire_id = get_prestataire_services.prestataire_id
    ORDER BY 
        s.category, s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add/update prestataire service selection
CREATE OR REPLACE FUNCTION update_prestataire_service(
    p_prestataire_id UUID,
    p_service_id TEXT,
    p_selected BOOLEAN,
    p_experience_years INT DEFAULT NULL,
    p_hourly_rate DECIMAL(10, 2) DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- If service should be selected
    IF p_selected THEN
        -- Insert or update the service selection
        INSERT INTO prestataire_services (
            prestataire_id, 
            service_id, 
            experience_years, 
            hourly_rate
        ) 
        VALUES (
            p_prestataire_id, 
            p_service_id, 
            p_experience_years, 
            p_hourly_rate
        )
        ON CONFLICT (prestataire_id, service_id) 
        DO UPDATE SET
            experience_years = COALESCE(p_experience_years, prestataire_services.experience_years),
            hourly_rate = COALESCE(p_hourly_rate, prestataire_services.hourly_rate),
            updated_at = now()
        RETURNING id INTO result;
    ELSE
        -- If service should be deselected, remove it
        DELETE FROM prestataire_services 
        WHERE prestataire_id = p_prestataire_id AND service_id = p_service_id
        RETURNING jsonb_build_object('id', id, 'removed', true) INTO result;
        
        -- If no row was deleted, set a default result
        IF result IS NULL THEN
            result := jsonb_build_object('removed', false, 'message', 'Service was not selected');
        END IF;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'service_id', p_service_id,
        'selected', p_selected,
        'result', result
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'service_id', p_service_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;