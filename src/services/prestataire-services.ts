import supabase from '../config/supabase';

export interface Service {
  id: string;
  name: string;
  category: string;
  description?: string;
  is_selected: boolean;
}

/**
 * Récupère les services sélectionnés par un prestataire
 * @param prestataireId L'ID du prestataire
 * @returns Les services sélectionnés
 */
export async function getSelectedServices(prestataireId: string): Promise<Service[]> {
  try {
    // Appel de la fonction RPC pour récupérer uniquement les services sélectionnés
    const { data, error } = await supabase.rpc(
      'get_prestataire_services',
      { p_prestataire_id: prestataireId }
    );
    
    if (error) {
      console.error('Erreur RPC:', error);
      throw error;
    }
    
    // Transformation des données
    let processedServices: Service[] = [];
    
    if (Array.isArray(data)) {
      // Filtrer uniquement les services sélectionnés
      processedServices = data
        .filter(item => item && typeof item === 'object' && (item.is_selected || (item.service && item.service.is_selected)))
        .map((item: any) => {
          // Certaines fonctions retournent un objet 'service', d'autres retournent directement les données
          const serviceData = item.service || item;
          
          return {
            id: serviceData.id || '',
            name: serviceData.name || 'Service sans nom',
            category: serviceData.category || 'Autre',
            description: serviceData.description || '',
            is_selected: true // Puisqu'ils sont sélectionnés
          };
        })
        .filter(Boolean);
    } else if (data && typeof data === 'object') {
      // Si la fonction retourne un seul objet au lieu d'un tableau
      const serviceData = data.service || data;
      if (serviceData.is_selected) {
        processedServices.push({
          id: serviceData.id || '',
          name: serviceData.name || 'Service sans nom',
          category: serviceData.category || 'Autre',
          description: serviceData.description || '',
          is_selected: true
        });
      }
    }
    
    console.log(`Récupération de ${processedServices.length} services pour le prestataire ${prestataireId}`);
    return processedServices;
  } catch (error) {
    console.error('Erreur lors de la récupération des services:', error);
    return [];
  }
}

/**
 * Récupère tous les services et indique ceux sélectionnés par un prestataire
 * @param prestataireId L'ID du prestataire
 * @returns Tous les services avec indication de sélection
 */
export async function getAllServicesWithSelection(prestataireId: string): Promise<Service[]> {
  try {
    const { data, error } = await supabase.rpc(
      'get_prestataire_services',
      { p_prestataire_id: prestataireId }
    );
    
    if (error) throw error;
    
    // Transformation des données
    let processedServices: Service[] = [];
    
    if (Array.isArray(data)) {
      processedServices = data.map((item: any) => {
        if (item && typeof item === 'object') {
          const serviceData = item.service || item;
          
          return {
            id: serviceData.id || '',
            name: serviceData.name || 'Service sans nom',
            category: serviceData.category || 'Autre',
            description: serviceData.description || '',
            is_selected: serviceData.is_selected === true
          };
        }
        return null;
      }).filter(Boolean);
    }
    
    return processedServices;
  } catch (error) {
    console.error('Erreur lors de la récupération de tous les services:', error);
    return [];
  }
}