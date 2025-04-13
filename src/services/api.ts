import supabase from '../config/supabase';
import { Request, Offer, Job, Transaction, Review, Service, UserRole, KYCStatus, TrackingStatus, RequestStatus, OfferStatus } from '../types';
import { sendLocalNotification, sendNotificationToUser, getUserNotificationPreferences } from './notification';

// Type pour les coordonnées de localisation - cette définition a été déplacée dans types/index.ts
// Maintenue ici pour rétrocompatibilité
import { LocationCoordinates } from '../types';

// Classe d'erreur API personnalisée
export class ApiError extends Error {
  public status: number;
  public context?: any;
  
  constructor(message: string, status: number = 500, context?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.context = context;
  }
}

// Helper pour gérer les erreurs
const handleError = (error: any, message: string): never => {
  console.error(`${message}:`, error);
  
  if (error?.code === 'PGRST301') {
    throw new ApiError(`Accès non autorisé: ${message}`, 403, error);
  }
  
  if (error?.code === 'PGRST116') {
    throw new ApiError(`Ressource non trouvée: ${message}`, 404, error);
  }
  
  throw new ApiError(message, 500, error);
};

// Fonctions pour les services
export const getServices = async (): Promise<Service[]> => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('name');
      
    if (error) throw error;
    return data as Service[];
  } catch (error) {
    return handleError(error, 'Erreur lors de la récupération des services');
  }
};

export const getServiceById = async (serviceId: string): Promise<Service> => {
  try {
    console.log(`Récupération du service avec ID: "${serviceId}"`);
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single();
      
    if (error) {
      console.error(`Erreur dans getServiceById pour ${serviceId}:`, error);
      throw error;
    }
    
    console.log(`Service trouvé:`, data);
    return data as Service;
  } catch (error) {
    console.error(`Exception dans getServiceById:`, error);
    return handleError(error, `Erreur lors de la récupération du service ${serviceId}`);
  }
};

export const getServiceIdByName = async (serviceName: string): Promise<string> => {
  try {
    console.log(`Recherche du service par nom: "${serviceName}"`);
    
    // Mapping des services communs vers les IDs que nous avons définis
    // Inclut les métiers (ex: menuisier) et les services (ex: menuiserie)
    const serviceMap: Record<string, string> = {
      // Plomberie
      "plomberie": "plomberie",
      "plombier": "plomberie",

      // Électricité
      "électricité": "electricite",
      "electricité": "electricite",
      "électricien": "electricite",
      "electricien": "electricite",

      // Menuiserie
      "menuiserie": "menuiserie",
      "menuisier": "menuiserie",
      "meuble": "menuiserie",
      "bois": "menuiserie",

      // Peinture
      "peinture": "peinture",
      "peintre": "peinture",
      "peindre": "peinture",
      "décoration": "peinture",
      "decoration": "peinture",

      // Jardinage
      "jardinage": "jardinage",
      "jardinier": "jardinage",
      "jardin": "jardinage",
      "pelouse": "jardinage",
      "tonte": "jardinage",

      // Nettoyage
      "nettoyage": "nettoyage",
      "ménage": "nettoyage",
      "menage": "nettoyage",
      "nettoyer": "nettoyage",
      "femme de ménage": "nettoyage",
      "homme de ménage": "nettoyage",

      // Plaquiste
      "plaquiste": "plaquiste",
      "placoplatre": "plaquiste",
      "placo": "plaquiste",

      // Carrelage
      "carrelage": "carrelage",
      "carreleur": "carrelage", 
      "carreler": "carrelage",

      // Climatisation
      "climatisation": "climatisation",
      "climatiseur": "climatisation",
      "clim": "climatisation",
      "chauffage": "climatisation",

      // Serrurerie
      "serrurerie": "serrurerie",
      "serrurier": "serrurerie",
      "serrure": "serrurerie",

      // Déménagement
      "déménagement": "demenagement",
      "demenagement": "demenagement",
      "déménageur": "demenagement",
      "demenageur": "demenagement",

      // Informatique
      "informatique": "informatique",
      "ordinateur": "informatique",
      "pc": "informatique",
      "dépannage informatique": "informatique",

      // Gardiennage
      "gardiennage": "gardiennage",
      "gardien": "gardiennage",
      "garde": "gardiennage",
      "surveillance": "gardiennage",

      // Cours particuliers
      "cours": "cours-particuliers",
      "professeur": "cours-particuliers",
      "prof": "cours-particuliers",
      "leçon": "cours-particuliers",
      "lecon": "cours-particuliers",

      // Coiffure
      "coiffure": "coiffure",
      "coiffeur": "coiffure",
      "coiffeuse": "coiffure",
      "cheveux": "coiffure",

      // Massage
      "massage": "massage",
      "masseur": "massage",
      "masseuse": "massage",
      "détente": "massage",
      "relaxation": "massage"
    };
    
    // Normalisation et nettoyage du nom de service
    const normalizedName = serviceName.toLowerCase().trim();
    
    // Vérifier une correspondance exacte d'abord
    if (serviceMap[normalizedName]) {
      console.log(`Service trouvé par correspondance exacte: "${normalizedName}" => "${serviceMap[normalizedName]}"`);
      return serviceMap[normalizedName];
    }
    
    // Puis vérifier si le service contient une des clés du mapping
    for (const [key, value] of Object.entries(serviceMap)) {
      if (normalizedName.includes(key)) {
        console.log(`Service trouvé par inclusion: "${key}" => "${value}"`);
        return value;
      }
    }
    
    // Si toujours pas trouvé, essayons avec une logique de correspondance plus flexible
    // Diviser l'entrée en mots et vérifier chaque mot
    const words = normalizedName.split(/\s+/);
    for (const word of words) {
      if (word.length < 3) continue; // Ignorer les mots trop courts
      
      for (const [key, value] of Object.entries(serviceMap)) {
        // Vérifier les racines communes (par exemple "menuisi" dans "menuisier" et "menuiserie")
        if (key.includes(word) || word.includes(key)) {
          console.log(`Service trouvé par correspondance partielle: "${word}" ~ "${key}" => "${value}"`);
          return value;
        }
      }
    }
    
    // Si pas trouvé dans le mapping, chercher dans la base de données
    console.log("Service non trouvé dans le mapping, recherche en base de données");
    
    // D'abord rechercher avec le nom exact
    let { data, error } = await supabase
      .from('services')
      .select('id, name')
      .ilike('name', normalizedName)
      .limit(1);
    
    // Si rien trouvé, essayer une correspondance partielle
    if (!data || data.length === 0) {
      ({ data, error } = await supabase
        .from('services')
        .select('id, name')
        .ilike('name', `%${normalizedName}%`)
        .limit(1));
    }
    
    if (error) {
      console.error("Erreur lors de la recherche par nom:", error);
      throw error;
    }
    
    // Si un service est trouvé, retourner son ID
    if (data && data.length > 0) {
      console.log(`Service trouvé en base: "${data[0].name}" => "${data[0].id}"`);
      return data[0].id;
    }
    
    // Dernière tentative: rechercher avec des mots clés individuels
    for (const word of words) {
      if (word.length < 3) continue; // Ignorer les mots trop courts
      
      const { data: wordData, error: wordError } = await supabase
        .from('services')
        .select('id, name')
        .ilike('name', `%${word}%`)
        .limit(1);
      
      if (!wordError && wordData && wordData.length > 0) {
        console.log(`Service trouvé par mot-clé "${word}": "${wordData[0].name}" => "${wordData[0].id}"`);
        return wordData[0].id;
      }
    }
    
    // Si aucun service n'est trouvé, utiliser plomberie comme service par défaut
    console.log("Service introuvable, utilisation du service 'plomberie' par défaut");
    
    // Option 1: Récupérer l'ID de "plomberie" depuis la base de données
    const { data: plumberService, error: plumberError } = await supabase
      .from('services')
      .select('id')
      .eq('name', 'Plomberie')
      .limit(1);
      
    if (!plumberError && plumberService && plumberService.length > 0) {
      console.log(`Service plomberie utilisé: "${plumberService[0].id}"`);
      return plumberService[0].id;
    }
    
    // Option 2: Si même "plomberie" n'est pas trouvé, prendre le premier service disponible
    const { data: firstService, error: firstServiceError } = await supabase
      .from('services')
      .select('id, name')
      .limit(1);
      
    if (!firstServiceError && firstService && firstService.length > 0) {
      console.log(`Premier service disponible utilisé: "${firstService[0].name}" => "${firstService[0].id}"`);
      return firstService[0].id;
    }
    
    console.error("Aucun service disponible dans la base de données");
    return "plomberie"; // Valeur par défaut qui devrait toujours exister
  } catch (error) {
    console.error(`Erreur complète lors de la recherche du service "${serviceName}":`, error);
    // Au lieu de générer une erreur, retourner un service par défaut
    return "plomberie";
  }
};

// Fonctions pour les requêtes
export const createRequest = async (request: Omit<Request, 'id' | 'status' | 'created_at'>): Promise<Request> => {
  try {
    const { data, error } = await supabase
      .from('requests')
      .insert({
        ...request,
        status: RequestStatus.PENDING
      })
      .select()
      .single();
      
    if (error) throw error;
    return data as Request;
  } catch (error) {
    return handleError(error, 'Erreur lors de la création de la demande');
  }
};

export const getClientRequests = async (clientId: string): Promise<Request[]> => {
  try {
    const { data, error } = await supabase
      .from('requests')
      .select('*, services:service_id(*)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    console.log('Données de demandes récupérées:', data);
    
    // Vérifier les relations chargées
    if (data) {
      data.forEach((request, index) => {
        if (!request.services) {
          console.warn(`La demande ${index} (${request.id}) n'a pas chargé son service correctement`);
        }
      });
    }
    
    return data as Request[];
  } catch (error) {
    return handleError(error, `Erreur lors de la récupération des demandes du client ${clientId}`);
  }
};

export const getRequestById = async (requestId: string): Promise<Request> => {
  try {
    const { data, error } = await supabase
      .from('requests')
      .select('*, services:service_id(*)')
      .eq('id', requestId)
      .single();
      
    if (error) throw error;
    
    // S'assurer que la propriété location existe pour éviter les erreurs
    if (data && !data.location) {
      data.location = {
        latitude: 0,
        longitude: 0,
        address: "Adresse non disponible"
      };
    }
    
    return data as Request;
  } catch (error) {
    return handleError(error, `Erreur lors de la récupération de la demande ${requestId}`);
  }
};

export const getNearbyRequests = async (
  userId: string,
  maxDistance?: number,
  serviceIds?: string[]
): Promise<Request[]> => {
  try {
    console.log('-----------------------------------------------------');
    console.log('DIAGNOSTIC getNearbyRequests pour userId:', userId);
    
    // 0. DEBUG: Récupérer toutes les demandes d'abord pour voir ce qui existe
    const { data: allRequests, error: allReqError } = await supabase
      .from('requests')
      .select('id, service_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (allReqError) {
      console.error('Erreur lors de la récupération de toutes les demandes:', allReqError);
    } else {
      console.log('CRITIQUE - Toutes les demandes disponibles (10 max):');
      allRequests?.forEach((req, idx) => {
        console.log(`Demande ${idx+1}: id=${req.id}, service_id="${req.service_id}", status=${req.status}, date=${req.created_at}`);
      });
    }
    
    // 1. Récupérer les services du prestataire
    console.log('Recherche des services pour le prestataire ID:', userId);
    const { data: prestataireServices, error: servicesError } = await supabase
      .from('prestataire_services')
      .select('service_id')
      .eq('prestataire_id', userId);
    
    if (servicesError) {
      console.error('Erreur lors de la récupération des services du prestataire:', servicesError);
      // En cas d'erreur, ne pas filtrer par service
      serviceIds = [];
    } else if (prestataireServices && prestataireServices.length > 0) {
      serviceIds = prestataireServices.map(item => item.service_id);
      console.log(`${prestataireServices.length} services trouvés pour le prestataire:`, serviceIds);
    } else {
      console.log('⚠️ Aucun service trouvé pour ce prestataire!');
      serviceIds = [];
    }
    
    // 2. DEBUG: Tester chaque service_id individuellement pour voir s'il y a des demandes correspondantes
    if (serviceIds && serviceIds.length > 0) {
      console.log('Test de chaque service_id individuellement:');
      for (const serviceId of serviceIds) {
        const { data: matchingRequests, error: matchError } = await supabase
          .from('requests')
          .select('id, service_id')
          .eq('service_id', serviceId)
          .limit(5);
          
        if (matchError) {
          console.log(`  - Service "${serviceId}": Erreur:`, matchError);
        } else {
          console.log(`  - Service "${serviceId}": ${matchingRequests?.length || 0} demandes trouvées`);
          if (matchingRequests && matchingRequests.length > 0) {
            console.log('    Premiers IDs:', matchingRequests.map(r => r.id).join(', '));
          }
        }
      }
    }
    
    // 3. Faisons la requête principale, mais SANS filtre d'abord
    let query = supabase
      .from('requests')
      .select('*, services:service_id(*)')
      .or(`status.eq.${RequestStatus.PENDING},status.eq.${RequestStatus.OFFERED}`)
      .neq('status', RequestStatus.CANCELLED)  // Exclure explicitement les demandes annulées
      .order('created_at', { ascending: false });
    
    // Exécuter sans filtre pour vérifier
    const { data: unfilteredData, error: unfilteredError } = await query;
    if (unfilteredError) {
      console.error('Erreur requête non filtrée:', unfilteredError);
    } else {
      console.log(`Requête non filtrée: ${unfilteredData?.length || 0} demandes disponibles`);
    }
    
    // 4. Maintenant filtrons par service
    if (serviceIds && serviceIds.length > 0) {
      console.log('Application du filtre par services:', serviceIds);
      query = supabase
        .from('requests')
        .select('*, services:service_id(*)')
        .or(`status.eq.${RequestStatus.PENDING},status.eq.${RequestStatus.OFFERED}`)
        .neq('status', RequestStatus.CANCELLED)  // Exclure explicitement les demandes annulées
        .in('service_id', serviceIds)
        .order('created_at', { ascending: false });
    } else {
      console.log('⚠️ Pas de filtrage par service - toutes les demandes seront retournées');
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Erreur lors de la requête filtrée de demandes:', error);
      throw error;
    }
    
    console.log(`${data?.length || 0} demandes trouvées après filtrage`);
    
    // Si aucune demande n'est trouvée, retourner un tableau vide
    if (!data || data.length === 0) {
      console.log('Aucune demande correspondante trouvée!');
      return [];
    }
    
    // Log des détails des demandes trouvées
    data.forEach((request, idx) => {
      console.log(`Demande #${idx+1}:`, 
        `id=${request.id}`, 
        `service=${request.service_id}`,
        `status=${request.status}`);
    });
    
    console.log('-----------------------------------------------------');
    
    // 3. Retourner directement les données
    return data as Request[];
  } catch (error) {
    console.error('Exception complète dans getNearbyRequests:', error);
    // Retourner un tableau vide au lieu de propager l'erreur pour une meilleure expérience utilisateur
    return [];
  }
};

// Fonctions pour les offres
export const createOffer = async (offer: Omit<Offer, 'id' | 'status' | 'created_at'>): Promise<Offer> => {
  try {
    // Étape 1: Vérifier que la demande est toujours disponible
    const { data: requestData, error: requestError } = await supabase
      .from('requests')
      .select('status')
      .eq('id', offer.request_id)
      .single();
      
    if (requestError) throw requestError;
    
    // Si la demande est déjà acceptée ou terminée, on ne peut plus faire d'offre
    if (requestData.status === RequestStatus.ACCEPTED || 
        requestData.status === RequestStatus.COMPLETED || 
        requestData.status === RequestStatus.CANCELLED) {
      throw new ApiError(`Cette demande n'est plus disponible (statut: ${requestData.status})`, 400);
    }
    
    // Étape 2: Créer l'offre
    const { data, error } = await supabase
      .from('offers')
      .insert({
        ...offer,
        status: OfferStatus.PENDING
      })
      .select()
      .single();
      
    if (error) throw error;
    
    // Étape 3: Mettre à jour le statut de la demande à "offered" seulement si elle est encore "pending"
    if (requestData.status === RequestStatus.PENDING) {
      const { error: updateError } = await supabase
        .from('requests')
        .update({ status: RequestStatus.OFFERED })
        .eq('id', offer.request_id)
        .eq('status', RequestStatus.PENDING);
        
      if (updateError) {
        console.error('Erreur lors de la mise à jour du statut de la demande:', updateError);
      }
    }
    
    return data as Offer;
  } catch (error) {
    return handleError(error, 'Erreur lors de la création de l\'offre');
  }
};

export const getOffersByRequestId = async (requestId: string): Promise<Offer[]> => {
  try {
    const { data, error } = await supabase
      .from('offers')
      .select(`
        *,
        prestataires:prestataire_id(
          id, 
          name, 
          email, 
          profile_picture, 
          profile_picture_base64
        )
      `)
      .eq('request_id', requestId);
      
    if (error) throw error;
    
    // Formatage des données pour faciliter l'affichage
    if (data && data.length > 0) {
      return data.map(offer => {
        // Extraire le prénom et la photo de profil du prestataire
        const prestataire = offer.prestataires || {};
        return {
          ...offer,
          prestataire_name: prestataire.name || prestataire.email?.split('@')[0] || 'Prestataire',
          prestataire_profile_picture: prestataire.profile_picture_base64 || prestataire.profile_picture || null
        };
      });
    }
    
    return data as Offer[];
  } catch (error) {
    return handleError(error, `Erreur lors de la récupération des offres pour la demande ${requestId}`);
  }
};

export const getOfferById = async (offerId: string): Promise<Offer> => {
  try {
    const { data, error } = await supabase
      .from('offers')
      .select('*, prestataires:prestataire_id(*), requests:request_id(*)')
      .eq('id', offerId)
      .single();
      
    if (error) throw error;
    return data as Offer;
  } catch (error) {
    return handleError(error, `Erreur lors de la récupération de l'offre ${offerId}`);
  }
};

export const acceptOffer = async (offerId: string): Promise<Offer> => {
  try {
    // Récupérer l'offre avec les informations nécessaires
    const { data: existingOffer, error: checkError } = await supabase
      .from('offers')
      .select(`
        id, 
        request_id, 
        prestataire_id, 
        price, 
        status, 
        created_at,
        requests:request_id (
          id, 
          client_id,
          service_id,
          status
        )
      `)
      .eq('id', offerId)
      .single();
      
    if (checkError) throw checkError;
    if (!existingOffer) throw new ApiError('Cette offre n\'existe pas', 404);
    
    // Vérifications de validité
    if (existingOffer.status !== OfferStatus.PENDING) {
      throw new ApiError(`Cette offre a déjà été ${existingOffer.status === OfferStatus.ACCEPTED ? 'acceptée' : 'rejetée'}`, 400);
    }
    
    if (!existingOffer.requests) {
      throw new ApiError('Impossible de trouver la demande associée à cette offre', 404);
    }
    
    if (existingOffer.requests.status === RequestStatus.ACCEPTED || existingOffer.requests.status === RequestStatus.COMPLETED) {
      throw new ApiError(`La demande associée a déjà été ${existingOffer.requests.status === RequestStatus.ACCEPTED ? 'acceptée' : 'complétée'}`, 400);
    }
    
    // Mise à jour du statut de l'offre et de la demande dans une transaction
    const clientId = existingOffer.requests.client_id;
    const prestataireId = existingOffer.prestataire_id;
    
    // 1. Mise à jour de l'offre
    const { data: updatedOffer, error: offerError } = await supabase
      .from('offers')
      .update({ status: OfferStatus.ACCEPTED })
      .eq('id', offerId)
      .eq('status', OfferStatus.PENDING)
      .select()
      .single();
      
    if (offerError) throw offerError;
    
    // 2. Mise à jour de la demande
    const { error: requestError } = await supabase
      .from('requests')
      .update({ status: RequestStatus.ACCEPTED })
      .eq('id', existingOffer.request_id);
      
    if (requestError) throw requestError;
    
    // 3. Rejeter les autres offres
    await supabase
      .from('offers')
      .update({ status: OfferStatus.REJECTED })
      .eq('request_id', existingOffer.request_id)
      .neq('id', offerId)
      .eq('status', OfferStatus.PENDING);
    
    // 4. Créer un job
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .insert({
        offer_id: offerId,
        client_id: clientId,
        prestataire_id: prestataireId,
        tracking_status: TrackingStatus.NOT_STARTED,
        is_completed: false
      })
      .select();
      
    if (jobError) {
      console.error('Erreur lors de la création du job:', jobError);
      // Continuer même si la création du job échoue
    }
    
    // 5. Envoyer une notification au prestataire
    try {
      // Récupérer le service pour la notification
      let serviceName = 'service';
      if (existingOffer.requests.service_id) {
        const serviceData = await getServiceById(existingOffer.requests.service_id);
        if (serviceData) {
          serviceName = serviceData.name;
        }
      }
      
      // Vérifier les préférences de notification du prestataire
      const preferences = await getUserNotificationPreferences(prestataireId);
      if (!preferences || preferences.new_offers !== false) {
        // Envoyer une notification au prestataire
        await sendNotificationToUser(
          prestataireId,
          'Votre offre a été acceptée',
          `Votre offre pour le service de ${serviceName} a été acceptée par le client.`,
          {
            offerId,
            requestId: existingOffer.request_id,
            type: 'new_offer'
          }
        );
        
        console.log(`Notification envoyée au prestataire ${prestataireId}: Offre acceptée`);
      }
    } catch (notificationError) {
      console.error('Erreur lors de l\'envoi de la notification:', notificationError);
      // Ne pas échouer si la notification échoue
    }
    
    // 6. Récupérer et retourner les données du job créé si disponible
    try {
      if (jobData && jobData[0]) {
        console.log('Job créé:', jobData[0].id);
        return { ...updatedOffer, jobId: jobData[0].id } as any;
      }
    } catch (e) {
      console.error('Erreur lors de la récupération du job:', e);
    }
    
    return updatedOffer as Offer;
  } catch (error) {
    return handleError(error, `Erreur lors de l'acceptation de l'offre ${offerId}`);
  }
};

// Fonctions pour les jobs
export const getJobByOfferId = async (offerId: string): Promise<Job | null> => {
  try {
    // Première tentative: essayer de trouver un job existant pour cette offre
    const { data, error } = await supabase
      .from('jobs')
      .select('*, offers:offer_id(*), clients:client_id(*), prestataires:prestataire_id(*)')
      .eq('offer_id', offerId)
      .maybeSingle();
      
    if (error) throw error;
    
    // Si un job a été trouvé, le retourner
    if (data) {
      return data as Job;
    }
    
    // Si aucun job n'a été trouvé, vérifier si c'est peut-être l'ID du job lui-même
    // qui a été passé (et non l'ID d'une offre)
    const { data: jobById, error: jobError } = await supabase
      .from('jobs')
      .select('*, offers:offer_id(*), clients:client_id(*), prestataires:prestataire_id(*)')
      .eq('id', offerId)
      .maybeSingle();
      
    if (jobError) throw jobError;
    
    if (jobById) {
      return jobById as Job;
    }
    
    // Aucun job trouvé, ni par offre_id ni par id
    return null;
  } catch (error) {
    console.error(`Erreur lors de la récupération du job pour l'offre/job ${offerId}:`, error);
    // Retourner null au lieu de propager l'erreur pour permettre au code appelant de gérer la situation
    return null;
  }
};

export const getJobsByPrestataireId = async (prestataireId: string): Promise<Job[]> => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *, 
        offers:offer_id(*), 
        clients:client_id(*),
        requests:offers(requests:request_id(*))
      `)
      .eq('prestataire_id', prestataireId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data as Job[];
  } catch (error) {
    return handleError(error, `Erreur lors de la récupération des jobs du prestataire ${prestataireId}`);
  }
};

export const getJobsByClientId = async (clientId: string): Promise<Job[]> => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *, 
        offers:offer_id(*), 
        prestataires:prestataire_id(*),
        requests:offers(requests:request_id(*))
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data as Job[];
  } catch (error) {
    return handleError(error, `Erreur lors de la récupération des jobs du client ${clientId}`);
  }
};

// Enrichir un job avec des relations complètes
export const enrichJobWithMockData = async (job: Job): Promise<Job> => {
  // Créer une copie du job pour éviter de modifier l'original
  const enrichedJob = { ...job };
  
  try {
    // Si le job a déjà toutes les relations, le retourner tel quel
    if (job.offers && job.offers.requests && job.clients && job.prestataires) {
      return job;
    }

    // Récupérer l'offre associée si elle n'existe pas déjà
    if (!job.offers) {
      try {
        const offer = await getOfferById(job.offer_id);
        enrichedJob.offers = offer;
      } catch (error) {
        console.error(`Erreur lors de la récupération de l'offre ${job.offer_id}:`, error);
      }
    }
    
    // Récupérer le client associé si il n'existe pas déjà
    if (!job.clients) {
      try {
        const client = await getClientById(job.client_id);
        enrichedJob.clients = client;
      } catch (error) {
        console.error(`Erreur lors de la récupération du client ${job.client_id}:`, error);
      }
    }
    
    // Récupérer le prestataire associé si il n'existe pas déjà
    if (!job.prestataires) {
      try {
        const prestataire = await getUserById(job.prestataire_id);
        enrichedJob.prestataires = prestataire;
      } catch (error) {
        console.error(`Erreur lors de la récupération du prestataire ${job.prestataire_id}:`, error);
      }
    }
    
    return enrichedJob;
  } catch (error) {
    console.error('Erreur lors de l\'enrichissement du job:', error);
    return job; // Retourner le job original en cas d'erreur
  }
};

export const updateJobTrackingStatus = async (jobId: string, status: TrackingStatus): Promise<Job> => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .update({ tracking_status: status })
      .eq('id', jobId)
      .select()
      .single();
      
    if (error) throw error;
    
    // Mettre à jour aussi le statut de suivi dans la demande pour la cohérence
    const { data: jobData } = await supabase
      .from('jobs')
      .select('client_id, offer_id')
      .eq('id', jobId)
      .single();
      
    if (jobData?.offer_id) {
      const { data: offerData } = await supabase
        .from('offers')
        .select('request_id')
        .eq('id', jobData.offer_id)
        .single();
        
      if (offerData?.request_id) {
        await supabase
          .from('requests')
          .update({ prestataire_status: status })
          .eq('id', offerData.request_id);
      }
      
      // Envoyer une notification au client
      if (jobData.client_id) {
        let title = '';
        let body = '';
        
        switch (status) {
          case TrackingStatus.EN_ROUTE:
            title = 'Prestataire en route';
            body = 'Votre prestataire est en route vers votre domicile';
            break;
          case TrackingStatus.ARRIVED:
            title = 'Prestataire arrivé';
            body = 'Votre prestataire est arrivé à destination';
            break;
          case TrackingStatus.IN_PROGRESS:
            title = 'Prestation en cours';
            body = 'La prestation a commencé';
            break;
          case TrackingStatus.COMPLETED:
            title = 'Prestation terminée';
            body = 'La prestation a été marquée comme terminée';
            break;
        }
        
        if (title) {
          try {
            // Vérifier les préférences de notification du client
            const preferences = await getUserNotificationPreferences(jobData.client_id);
            if (!preferences || preferences.status_updates !== false) {
              // Envoyer une notification au client
              await sendNotificationToUser(
                jobData.client_id,
                title,
                body,
                { 
                  jobId, 
                  status,
                  type: 'status_update' 
                }
              );
              
              console.log(`Notification envoyée au client ${jobData.client_id}: ${title}`);
            }
          } catch (notificationError) {
            console.error('Erreur lors de l\'envoi de la notification de statut:', notificationError);
          }
        }
      }
    }
    
    return data as Job;
  } catch (error) {
    return handleError(error, `Erreur lors de la mise à jour du statut de suivi du job ${jobId}`);
  }
};

export const completeJob = async (jobId: string): Promise<Job> => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .update({ 
        is_completed: true,
        tracking_status: TrackingStatus.COMPLETED,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single();
      
    if (error) throw error;
    
    // Mettre à jour le statut de la demande
    const job = data as Job;
    const { data: offerData } = await supabase
      .from('offers')
      .select('request_id')
      .eq('id', job.offer_id)
      .single();
      
    if (offerData) {
      await supabase
        .from('requests')
        .update({ 
          status: RequestStatus.COMPLETED,
          prestataire_status: TrackingStatus.COMPLETED
        })
        .eq('id', offerData.request_id);
    }
    
    return job;
  } catch (error) {
    return handleError(error, `Erreur lors de la complétion du job ${jobId}`);
  }
};

// Fonctions pour les reviews
export const createReview = async (review: Omit<Review, 'id' | 'created_at'>): Promise<Review> => {
  try {
    console.log('Création d\'un avis:', review);
    
    const { data, error } = await supabase
      .from('reviews')
      .insert(review)
      .select()
      .single();
      
    if (error) {
      // Si l'erreur concerne la vue matérialisée, on l'ignore
      if (error.message && error.message.includes('user_review_stats')) {
        console.warn('Avis créé mais erreur ignorée sur la vue matérialisée:', error.message);
        
        // Récupérer l'avis créé sans déclencher le trigger
        const { data: reviewData } = await supabase
          .from('reviews')
          .select()
          .match({ 
            job_id: review.job_id, 
            reviewer_id: review.reviewer_id, 
            reviewed_user_id: review.reviewed_user_id 
          })
          .single();
          
        if (reviewData) {
          // Marquer la demande comme ayant été évaluée
          try {
            // Trouver d'abord l'offre et la demande associée à ce job
            const { data: jobData } = await supabase
              .from('jobs')
              .select('offer_id')
              .eq('id', review.job_id)
              .maybeSingle();
            
            if (jobData?.offer_id) {
              const { data: offerData } = await supabase
                .from('offers')
                .select('request_id')
                .eq('id', jobData.offer_id)
                .single();
              
              if (offerData?.request_id) {
                // Mettre à jour la demande
                await supabase
                  .from('requests')
                  .update({ is_reviewed: true })
                  .eq('id', offerData.request_id);
                
                console.log('Demande marquée comme évaluée');
              }
            }
          } catch (updateError) {
            console.error('Erreur lors de la mise à jour du statut d\'évaluation de la demande:', updateError);
          }
          
          return reviewData as Review;
        }
      }
      
      throw error;
    }
    
    // Si aucune erreur, marquer également la demande comme évaluée
    try {
      // Trouver d'abord l'offre et la demande associée à ce job
      const { data: jobData } = await supabase
        .from('jobs')
        .select('offer_id')
        .eq('id', review.job_id)
        .maybeSingle();
      
      if (jobData?.offer_id) {
        const { data: offerData } = await supabase
          .from('offers')
          .select('request_id')
          .eq('id', jobData.offer_id)
          .single();
        
        if (offerData?.request_id) {
          // Mettre à jour la demande
          await supabase
            .from('requests')
            .update({ is_reviewed: true })
            .eq('id', offerData.request_id);
          
          console.log('Demande marquée comme évaluée');
        }
      }
    } catch (updateError) {
      console.error('Erreur lors de la mise à jour du statut d\'évaluation de la demande:', updateError);
    }
    
    return data as Review;
  } catch (error) {
    console.error('Erreur détaillée lors de la création de l\'avis:', error);
    return handleError(error, 'Erreur lors de la création de l\'avis');
  }
};

export const getReviewsByJobId = async (jobId: string): Promise<Review[]> => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, reviewer:reviewer_id(*)')
      .eq('job_id', jobId);
      
    if (error) throw error;
    return data as Review[];
  } catch (error) {
    return handleError(error, `Erreur lors de la récupération des avis pour le job ${jobId}`);
  }
};

// Fonctions pour les utilisateurs
export const getUserById = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) throw error;
    return data;
  } catch (error) {
    return handleError(error, `Erreur lors de la récupération de l'utilisateur ${userId}`);
  }
};

export const getClientById = async (clientId: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', clientId)
      .eq('role', UserRole.CLIENT)
      .single();
      
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Erreur lors de la récupération du client ${clientId}:`, error);
    // Retourner un objet client de base pour éviter de casser l'UI
    return {
      id: clientId,
      email: 'client@example.com',
      name: 'Client',
      role: UserRole.CLIENT
    };
  }
};

export const getUserReviewStats = async (userId: string) => {
  try {
    // Récupérer toutes les reviews de l'utilisateur
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('reviewed_user_id', userId);
      
    if (error) throw error;
    
    // Calculer la note moyenne et le nombre de reviews
    if (!data || data.length === 0) {
      return {
        user_id: userId,
        review_count: 0,
        average_rating: 0
      };
    }
    
    const review_count = data.length;
    const total_rating = data.reduce((sum, review) => sum + review.rating, 0);
    const average_rating = total_rating / review_count;
    
    return {
      user_id: userId,
      review_count,
      average_rating
    };
  } catch (error) {
    console.error(`Erreur lors de la récupération des reviews pour l'utilisateur ${userId}:`, error);
    // Retourner des statistiques par défaut pour éviter de casser l'UI
    return {
      user_id: userId,
      review_count: 0,
      average_rating: 0
    };
  }
};

export const updateUserProfile = async (userId: string, profileData: Partial<any>) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update(profileData)
      .eq('id', userId)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  } catch (error) {
    return handleError(error, `Erreur lors de la mise à jour du profil de l'utilisateur ${userId}`);
  }
};

export const uploadProfilePicture = async (userId: string, imageUri: string): Promise<{ imageUrl: string, base64Image: string } | null> => {
  try {
    // Générer un nom de fichier unique
    const fileExt = imageUri.split('.').pop() || 'jpg';
    const fileName = `profile_${userId}_${Date.now()}.${fileExt}`;
    const filePath = `profile-images/${userId}/${fileName}`;
    
    console.log('URI original:', imageUri);
    
    // Convertir l'URI en base64
    let base64Data;
    if (imageUri.startsWith('file://') || imageUri.startsWith('content://')) {
      // Pour les URI locaux sur mobile, lire en tant que base64
      const FileSystem = require('expo-file-system');
      base64Data = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('Image lue, taille:', base64Data.length, 'octets');
    } else {
      // Cas non géré, retourner null
      console.error('Format d\'image non pris en charge:', imageUri);
      return null;
    }
    
    if (base64Data.length === 0) {
      throw new Error('Fichier image vide');
    }
    
    // Utiliser le bucket chat-media existant
    const bucketToUse = 'chat-media';
    
    // Upload vers Supabase Storage
    console.log(`Uploading image to Supabase Storage bucket: ${bucketToUse}, path: ${filePath}`);
    
    let uploadSuccess = false;
    try {
      const { data, error } = await supabase.storage
        .from(bucketToUse)
        .upload(filePath, base64Data, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: true,
        });
      
      if (error) {
        console.error('Erreur détaillée upload:', JSON.stringify(error));
        console.log("L'upload vers Storage a échoué, mais l'image sera quand même disponible en base64");
      } else {
        uploadSuccess = true;
        console.log('Upload réussi, données:', data);
      }
    } catch (uploadError) {
      console.error('Exception pendant l\'upload:', uploadError);
      console.log("Exception lors de l'upload, mais l'image sera quand même disponible en base64");
    }
    
    // Récupérer l'URL publique
    const { data: urlData } = supabase.storage
      .from(bucketToUse)
      .getPublicUrl(filePath);
    
    if (!urlData || !urlData.publicUrl) {
      throw new Error('URL publique non générée');
    }
    
    // Solution hybride:
    // 1. Stocker l'URL Supabase dans l'objet du profil (pour persistance)
    // 2. Retourner une URL transformée qui sera plus compatible ET les données base64
    
    // Construire URL Supabase directe avec quelques modifications pour améliorer la compatibilité
    let publicUrl = urlData.publicUrl;
    
    // Remplacer le domaine Supabase par une URL compatible avec les objets publics
    // Enlever query parameters potentiels
    if (publicUrl.includes('?')) {
      publicUrl = publicUrl.split('?')[0];
    }
    
    // Ajouter un timestamp pour éviter la mise en cache
    const finalUrl = `${publicUrl}?t=${Date.now()}`;
    
    // Encoder l'image en base64 pour un affichage direct si nécessaire
    const base64Image = `data:image/${fileExt === 'jpg' ? 'jpeg' : fileExt};base64,${base64Data}`;
    
    // Mettre à jour le profil de l'utilisateur avec l'URL et la version base64
    console.log("Updating user profile with picture URL and base64 data");
    try {
      const updatedProfile = await updateUserProfile(userId, { 
        profile_picture: finalUrl,
        profile_picture_base64: base64Image
      });
      console.log("Updated profile successfully with base64 image");
    } catch (updateError) {
      console.error("Error updating profile with base64:", updateError);
      
      // Si l'erreur est liée à la colonne base64, essayer sans
      try {
        console.log("Trying update without base64...");
        const fallbackUpdate = await updateUserProfile(userId, { 
          profile_picture: finalUrl
        });
        console.log("Profile updated with URL only");
      } catch (fallbackError) {
        console.error("Complete failure to update profile:", fallbackError);
      }
    }
    
    return {
      imageUrl: finalUrl,
      base64Image: base64Image
    };
  } catch (error) {
    console.error('Erreur lors de l\'upload de l\'image de profil:', error);
    return null;
  }
};

// Fonctions pour la localisation en temps réel ont été déplacées vers location.ts
// Ces fonctions sont maintenues ici pour la compatibilité avec le code existant,
// mais renvoient simplement vers les nouvelles implémentations
import { 
  updateUserLocation as updateLocation,
  getUserLocation as getLocation
} from './location';

export const updateUserLocation = async (userId: string, location: LocationCoordinates): Promise<void> => {
  return updateLocation(userId, location);
};

export const getUserLocation = async (userId: string): Promise<LocationCoordinates | null> => {
  return getLocation(userId);
};

// Fonction utilitaire pour vérifier si une adresse a les coordonnées exactes
export const verifyAddressCoordinates = async (address: string): Promise<LocationCoordinates | null> => {
  if (!address) return null;
  
  try {
    // Import dynamique pour éviter les dépendances circulaires
    const { geocodeAddress } = require('./location');
    return await geocodeAddress(address);
  } catch (error) {
    console.error('Error verifying address coordinates:', error);
    return null;
  }
};

// Fonction pour obtenir les prestataires à proximité
export const getNearbyPrestataires = async (
  serviceId: string,
  latitude: number,
  longitude: number,
  radius: number = 10
): Promise<any[]> => {
  try {
    // Récupérer les prestataires qui offrent ce service
    const { data: serviceData, error: serviceError } = await supabase
      .from('prestataire_services')
      .select('prestataire_id')
      .eq('service_id', serviceId);
      
    if (serviceError) throw serviceError;
    
    if (!serviceData || serviceData.length === 0) {
      return [];
    }
    
    const prestataires = serviceData.map(item => item.prestataire_id);
    
    // Récupérer les informations complètes des prestataires
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .in('id', prestataires)
      .eq('role', UserRole.PRESTAIRE)
      .eq('is_verified', true);
      
    if (usersError) throw usersError;
    
    return users;
  } catch (error) {
    return handleError(error, `Erreur lors de la recherche de prestataires pour le service ${serviceId}`);
  }
};

// Fonctions pour la gestion des KYC
export const submitKycDocument = async (userId: string, docUrl: string): Promise<any> => {
  try {
    const { data, error } = await supabase
      .from('kyc')
      .insert({
        user_id: userId,
        doc_url: docUrl,
        status: KYCStatus.PENDING
      })
      .select()
      .single();
      
    if (error) throw error;
    return data;
  } catch (error) {
    return handleError(error, `Erreur lors de la soumission du document KYC pour l'utilisateur ${userId}`);
  }
};

export const getKycStatus = async (userId: string): Promise<KYCStatus | null> => {
  try {
    const { data, error } = await supabase
      .from('kyc')
      .select('status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (error) throw error;
    return data ? data.status : null;
  } catch (error) {
    console.error(`Erreur lors de la récupération du statut KYC pour l'utilisateur ${userId}:`, error);
    return null;
  }
};

// Fonction pour récupérer les avis d'un utilisateur
export const getUserReviews = async (userId: string) => {
  try {
    // Récupérer les avis où l'utilisateur est le prestataire
    const { data, error } = await supabase
      .from('reviews')
      .select('*, reviewer:reviewer_id(email, profile_picture)')
      .eq('reviewed_user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    // Récupérer aussi les statistiques d'avis (note moyenne, etc.)
    const { data: statsData, error: statsError } = await supabase
      .from('user_review_stats')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (statsError) {
      console.warn('Erreur lors de la récupération des statistiques d\'avis:', statsError);
    }
    
    return { 
      reviews: data || [], 
      stats: statsData || { 
        user_id: userId,
        avg_rating: 0,
        total_reviews: 0
      } 
    };
  } catch (error) {
    console.error(`Erreur lors de la récupération des avis pour l'utilisateur ${userId}:`, error);
    return { 
      reviews: [], 
      stats: { 
        user_id: userId,
        avg_rating: 0,
        total_reviews: 0
      } 
    };
  }
};

// Fonction pour annuler une demande
export const cancelRequest = async (requestId: string): Promise<Request> => {
  try {
    // Vérifier d'abord l'état actuel de la demande
    const { data: requestData, error: requestError } = await supabase
      .from('requests')
      .select('status, client_id')
      .eq('id', requestId)
      .single();
      
    if (requestError) throw requestError;
    
    // Vérifier que la demande peut être annulée (uniquement si en attente ou avec offres)
    if (requestData.status !== RequestStatus.PENDING && requestData.status !== RequestStatus.OFFERED) {
      throw new ApiError(`Impossible d'annuler une demande qui est déjà ${requestData.status}`, 400);
    }
    
    // Procéder à l'annulation
    const { data, error } = await supabase
      .from('requests')
      .update({ status: RequestStatus.CANCELLED })
      .eq('id', requestId)
      .select()
      .single();
      
    if (error) throw error;
    
    // Rejeter toutes les offres en attente associées à cette demande
    await supabase
      .from('offers')
      .update({ status: OfferStatus.REJECTED })
      .eq('request_id', requestId)
      .eq('status', OfferStatus.PENDING);
    
    // Retourner la demande mise à jour
    return data as Request;
  } catch (error) {
    return handleError(error, `Erreur lors de l'annulation de la demande ${requestId}`);
  }
};