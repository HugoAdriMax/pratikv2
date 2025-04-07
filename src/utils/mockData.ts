import { Service, Offer, Request, Job, RequestStatus, OfferStatus } from '../types';

// Liste de services simulés pour le développement
export const mockServices: Service[] = [
  {
    id: '1',
    name: 'Plomberie',
    category: 'Habitat',
    description: 'Services de plomberie résidentielle et professionnelle'
  },
  {
    id: '2',
    name: 'Électricité',
    category: 'Habitat',
    description: 'Tous travaux d\'électricité et dépannage'
  },
  {
    id: '3',
    name: 'Jardinage',
    category: 'Extérieur',
    description: 'Entretien de jardin et espaces verts'
  },
  {
    id: '4',
    name: 'Ménage',
    category: 'Habitat',
    description: 'Services de nettoyage pour particuliers et professionnels'
  },
  {
    id: '5',
    name: 'Bricolage',
    category: 'Habitat',
    description: 'Petits et moyens travaux de bricolage'
  },
  {
    id: '6',
    name: 'Peinture',
    category: 'Rénovation',
    description: 'Travaux de peinture intérieure et extérieure'
  },
  {
    id: '7',
    name: 'Déménagement',
    category: 'Services',
    description: 'Aide au déménagement et transport de meubles'
  }
];

// Clients simulés pour le développement
export const mockClients = [
  { id: 'client-123', name: 'Sophie Dupont', phone: '0612345678' },
  { id: 'client-456', name: 'Thomas Martin', phone: '0687654321' },
  { id: 'client-789', name: 'Julie Bernard', phone: '0698765432' },
  { id: 'client-101', name: 'Nicolas Petit', phone: '0654321098' }
];

// Requêtes simulées pour le développement
export const mockRequests: Partial<Request>[] = [
  // Demandes en cours (pour l'écran Missions/Jobs)
  {
    id: 'req-123',
    client_id: 'client-123',
    service_id: '1', // Plomberie
    urgency: 4,
    notes: 'Fuite sous l\'évier de la cuisine à réparer',
    status: RequestStatus.ACCEPTED,
    location: {
      latitude: 48.8566,
      longitude: 2.3522,
      address: "123 Avenue des Champs-Élysées, Paris"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() // hier
  },
  {
    id: 'req-456',
    client_id: 'client-456',
    service_id: '2', // Électricité
    urgency: 3,
    notes: 'Installation de prises électriques dans le salon',
    status: RequestStatus.ACCEPTED,
    location: {
      latitude: 48.8566,
      longitude: 2.3522,
      address: "45 Rue de Rivoli, Paris"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() // avant-hier
  },
  
  // Demandes disponibles (pour l'écran Demandes)
  {
    id: 'req-111',
    client_id: 'client-789',
    service_id: '1', // Plomberie
    urgency: 5,
    notes: 'Fuite d\'eau urgente dans la salle de bain',
    status: RequestStatus.PENDING,
    location: {
      latitude: 48.8534,
      longitude: 2.3488,
      address: "10 Rue de Rivoli, Paris"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString() // il y a 30 minutes
  },
  {
    id: 'req-222',
    client_id: 'client-101',
    service_id: '4', // Ménage
    urgency: 2,
    notes: 'Nettoyage complet d\'un appartement de 3 pièces',
    status: RequestStatus.PENDING,
    location: {
      latitude: 48.8734,
      longitude: 2.3421,
      address: "15 Boulevard Haussmann, Paris"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString() // il y a 2 heures
  },
  {
    id: 'req-333',
    client_id: 'client-789',
    service_id: '6', // Peinture
    urgency: 3,
    notes: 'Peinture d\'une chambre et d\'un salon',
    status: RequestStatus.PENDING,
    location: {
      latitude: 48.8651,
      longitude: 2.3781,
      address: "27 Rue Oberkampf, Paris"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString() // il y a 4 heures
  },
  {
    id: 'req-444',
    client_id: 'client-456',
    service_id: '3', // Jardinage
    urgency: 2,
    notes: 'Entretien de petit jardin et taille de haies',
    status: RequestStatus.OFFERED,
    location: {
      latitude: 48.8249,
      longitude: 2.3762,
      address: "8 Place d\'Italie, Paris"
    },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString() // il y a 12 heures
  },
  {
    id: 'req-555',
    client_id: 'client-123',
    service_id: '5', // Bricolage
    urgency: 4,
    notes: 'Montage de meubles et installation d\'étagères',
    status: RequestStatus.PENDING,
    location: {
      latitude: 48.8912,
      longitude: 2.3430,
      address: "32 Avenue de Clichy, Paris"
    },
    created_at: new Date().toISOString() // maintenant (nouvelle demande)
  }
];

// Offres simulées pour le développement
export const mockOffers: Partial<Offer>[] = [
  {
    id: 'offer-123',
    request_id: 'req-123',
    price: 85,
    status: OfferStatus.ACCEPTED
  },
  {
    id: 'offer-456',
    request_id: 'req-456',
    price: 120,
    status: OfferStatus.ACCEPTED
  },
  {
    id: 'offer-789',
    request_id: 'req-789',
    price: 65,
    status: OfferStatus.ACCEPTED
  }
];

// Fonction pour récupérer un service par son ID
export const getServiceById = (serviceId: string): Service | undefined => {
  // Vérifier d'abord si l'ID est un des services prédéfinis
  const numericId = serviceId.charAt(0);
  if (numericId && !isNaN(parseInt(numericId))) {
    return mockServices.find(service => service.id === numericId);
  }
  
  // Sinon, on retourne un service par défaut pour les IDs étranges (UUIDs)
  return {
    id: serviceId,
    name: 'Service personnalisé',
    category: 'Divers',
    description: 'Service à la demande'
  };
};

// Fonction pour récupérer un client par son ID
export const getClientById = (clientId: string) => {
  // Vérifier d'abord dans notre liste de clients simulés
  const client = mockClients.find(c => c.id === clientId);
  if (client) return client;
  
  // Pour un clientId inconnu, générer un nom fictif basé sur l'ID
  return {
    id: clientId,
    name: `Client ${clientId.substring(0, 5)}`,
    phone: '06XXXXXXXX'
  };
};

// Fonction pour récupérer une offre par ID
export const getOfferById = (offerId: string): Partial<Offer> | undefined => {
  // Chercher dans les offres simulées
  const offer = mockOffers.find(o => o.id === offerId);
  if (offer) return offer;
  
  // Si c'est un UUID ou un ID inconnu, on retourne une offre par défaut
  return {
    id: offerId,
    request_id: 'req-default',
    price: 85,
    status: OfferStatus.ACCEPTED
  };
};

// Fonction pour récupérer une requête par ID
export const getRequestById = (requestId: string): Partial<Request> | undefined => {
  // Chercher dans les requêtes simulées
  const request = mockRequests.find(r => r.id === requestId);
  if (request) return request;
  
  // Pour un requestId inconnu ou un offerId connu
  // On essaie de trouver une offre qui référence cette requête
  const offer = mockOffers.find(o => o.request_id === requestId);
  if (offer && offer.request_id) {
    const matchingRequest = mockRequests.find(r => r.id === offer.request_id);
    if (matchingRequest) return matchingRequest;
  }
  
  // Sinon, requête par défaut
  return {
    id: requestId,
    service_id: '1', // Plomberie par défaut
    urgency: 3,
    notes: 'Intervention à domicile',
    status: RequestStatus.ACCEPTED
  };
};

// Fonction pour enrichir un job avec des données simulées
export const enrichJobWithMockData = (job: Job): Job => {
  // Ne pas modifier les données si le job a déjà des données complètes
  if (job.offers && job.offers.price) {
    console.log(`Job ${job.id} a déjà des données d'offre complètes avec prix ${job.offers.price}€`);
    return job;
  }
  
  // Ajouter les informations d'offre et de requête
  const offer = getOfferById(job.offer_id);
  
  // Si l'offre existe et a un identifiant de requête, récupérer les informations de la requête
  const request = offer?.request_id 
    ? getRequestById(offer.request_id) 
    : {
        id: `req-for-${job.offer_id}`,
        service_id: '1', // Plomberie par défaut
        urgency: 3,
        status: RequestStatus.ACCEPTED,
        created_at: job.created_at
      };
  
  // Vérifier si job.offer_id contient "mock" (job simulé) ou s'il s'agit d'un vrai UUID
  // Si c'est un vrai UUID (offre réelle), essayer de récupérer plus d'informations
  let enrichedOfferData = offer;
  let enrichedRequestData = request;
  
  if (!/mock/.test(job.offer_id)) {
    // Tenter d'enrichir avec des données plus significatives pour les jobs liés à de vraies offres
    // Ne pas remplacer le prix si l'offre en a déjà un
    enrichedOfferData = {
      ...offer,
      price: offer?.price || '0', // Ne pas fournir de prix par défaut pour les vraies offres
    };
    
    enrichedRequestData = {
      ...request,
      service_id: request?.service_id || '1',
      // Ajouter plus d'informations de requête si nécessaire
    };
  }
  
  // Log pour vérifier les données d'enrichissement
  console.log(`Enrichissement du job ${job.id} - Prix d'origine: ${job.offers?.price || 'non défini'}, Prix après enrichissement: ${enrichedOfferData?.price || 'non défini'}`);
  
  return {
    ...job,
    offers: job.offers || enrichedOfferData as any,
    requests: job.requests || enrichedRequestData as any
  };
};