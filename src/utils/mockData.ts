// Ce fichier ne doit pas être utilisé en production.
// Toutes ses fonctions renvoient des erreurs pour éviter son utilisation accidentelle.
// Ce fichier est conservé uniquement pour référence historique.

export const mockServices = [];
export const mockClients = [];
export const mockRequests = [];
export const mockOffers = [];

export const getServiceById = () => {
  console.error('Ne pas utiliser getServiceById de mockData.ts en production');
  throw new Error('Cette fonction ne doit pas être utilisée en production');
};

export const getClientById = () => {
  console.error('Ne pas utiliser getClientById de mockData.ts en production');
  throw new Error('Cette fonction ne doit pas être utilisée en production');
};

export const getOfferById = () => {
  console.error('Ne pas utiliser getOfferById de mockData.ts en production');
  throw new Error('Cette fonction ne doit pas être utilisée en production');
};

export const getRequestById = () => {
  console.error('Ne pas utiliser getRequestById de mockData.ts en production');
  throw new Error('Cette fonction ne doit pas être utilisée en production');
};

export const enrichJobWithMockData = () => {
  console.error('Ne pas utiliser enrichJobWithMockData de mockData.ts en production');
  throw new Error('Cette fonction ne doit pas être utilisée en production');
};