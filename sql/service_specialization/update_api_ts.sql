-- Script pour modifier le champ getNearbyRequests dans api.ts

/*
Modifiez la fonction getNearbyRequests dans api.ts:

export const getNearbyRequests = async (
  userId: string,
  maxDistance?: number,
  serviceIds?: string[]
): Promise<Request[]> => {
  try {
    // Récupérer d'abord les services du prestataire
    if (!serviceIds || serviceIds.length === 0) {
      const { data: prestataireServices } = await supabase
        .from('prestataire_services')
        .select('service_id')
        .eq('prestataire_id', userId);
      
      if (prestataireServices && prestataireServices.length > 0) {
        serviceIds = prestataireServices.map(item => item.service_id);
      }
    }
    
    // Construire la requête principale
    let query = supabase
      .from('requests')
      .select('*, service:service_id(*)')
      .or(`status.eq.${RequestStatus.PENDING},status.eq.${RequestStatus.OFFERED}`)
      .order('created_at', { ascending: false });
    
    // Filtrer par services si disponible
    if (serviceIds && serviceIds.length > 0) {
      query = query.in('service_id', serviceIds);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return data as Request[];
  } catch (error) {
    return handleError(error, 'Erreur lors de la récupération des demandes à proximité');
  }
};
*/

-- Fonction pour renvoyer les services d'un prestataire
CREATE OR REPLACE FUNCTION get_prestataire_service_ids(p_prestataire_id UUID)
RETURNS TABLE (service_id TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT ps.service_id
  FROM prestataire_services ps
  WHERE ps.prestataire_id = p_prestataire_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vue pour permettre un filtre efficace des demandes par service
CREATE OR REPLACE VIEW requests_by_service AS
SELECT 
  r.*,
  s.name AS service_name,
  s.category AS service_category
FROM 
  requests r
LEFT JOIN
  services s ON r.service_id = s.id
WHERE 
  r.status IN ('pending', 'offered');

-- RPC pour obtenir les demandes correspondant aux services d'un prestataire
CREATE OR REPLACE FUNCTION get_requests_by_prestataire_services(p_prestataire_id UUID)
RETURNS SETOF requests_by_service AS $$
DECLARE
  v_service_ids TEXT[];
BEGIN
  -- Récupérer les IDs des services du prestataire
  SELECT array_agg(service_id) INTO v_service_ids
  FROM prestataire_services
  WHERE prestataire_id = p_prestataire_id;
  
  -- Si le prestataire n'a pas sélectionné de services, renvoyer toutes les demandes
  IF v_service_ids IS NULL OR array_length(v_service_ids, 1) = 0 THEN
    RETURN QUERY
    SELECT * FROM requests_by_service;
  ELSE
    -- Sinon, filtrer par services
    RETURN QUERY
    SELECT * FROM requests_by_service
    WHERE service_id = ANY(v_service_ids);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;