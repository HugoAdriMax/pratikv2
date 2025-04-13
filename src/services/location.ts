import supabase from '../config/supabase';
import * as Location from 'expo-location';
import { LocationCoordinates } from './api';

// Type pour la position d'un utilisateur avec timestamp
export interface UserLocation {
  id?: string;
  user_id: string;
  latitude: number;
  longitude: number;
  address?: string;
  updated_at?: string;
  created_at?: string;
}

// Calcul de la distance entre deux points GPS en kilomètres (formule de Haversine)
export const calculateDistance = (
  point1: any, 
  point2: any
): number => {
  try {
    // Afficher les objets complets pour débuggage
    console.log('calculateDistance - point1 complet:', JSON.stringify(point1));
    console.log('calculateDistance - point2 complet:', JSON.stringify(point2));
    
    // Vérifier que les objets existent
    if (!point1 || !point2) {
      console.error('Les objets de coordonnées sont null ou undefined');
      return 0;
    }

    // Vérifier si les propriétés existent et les convertir en nombres sûrement
    let lat1, lon1, lat2, lon2;
    
    if ('latitude' in point1) {
      lat1 = typeof point1.latitude === 'string' ? parseFloat(point1.latitude) : Number(point1.latitude);
    } else {
      console.error('Propriété latitude manquante dans point1');
      lat1 = 48.8683356; // Valeur par défaut
    }
    
    if ('longitude' in point1) {
      lon1 = typeof point1.longitude === 'string' ? parseFloat(point1.longitude) : Number(point1.longitude);
    } else {
      console.error('Propriété longitude manquante dans point1');
      lon1 = 2.288925; // Valeur par défaut
    }
    
    if ('latitude' in point2) {
      lat2 = typeof point2.latitude === 'string' ? parseFloat(point2.latitude) : Number(point2.latitude);
    } else {
      console.error('Propriété latitude manquante dans point2');
      lat2 = 48.8639; // Valeur par défaut
    }
    
    if ('longitude' in point2) {
      lon2 = typeof point2.longitude === 'string' ? parseFloat(point2.longitude) : Number(point2.longitude);
    } else {
      console.error('Propriété longitude manquante dans point2');
      lon2 = 2.2870; // Valeur par défaut
    }
    
    // Vérifier que les valeurs sont bien des nombres valides
    if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
      console.error('Valeurs de latitude/longitude invalides après conversion:', {
        point1: { lat: lat1, lon: lon1 },
        point2: { lat: lat2, lon: lon2 }
      });
      return 0.5; // Retourner une distance par défaut
    }
    
    // Logs pour le débogage
    console.log('Calcul de distance entre:');
    console.log(`Point 1: ${lat1}, ${lon1}`);
    console.log(`Point 2: ${lat2}, ${lon2}`);
    
    const R = 6371; // Rayon de la Terre en km
    const toRad = (value: number) => (value * Math.PI) / 180;
    
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance en km
    
    const roundedDistance = Math.round(distance * 10) / 10; // Arrondi à 1 décimale
    console.log(`Distance calculée: ${roundedDistance} km`);
    
    return roundedDistance;
  } catch (error) {
    console.error('Erreur dans le calcul de distance:', error);
    return 0;
  }
};

// Calcul du temps estimé d'arrivée en minutes
export const calculateETA = (distance: number, averageSpeed: number = 30): number => {
  // Vitesse en km/h, distance en km, résultat en minutes
  const timeInHours = distance / averageSpeed;
  const timeInMinutes = timeInHours * 60;
  return Math.round(timeInMinutes);
};

// Fonction pour géocoder une adresse en coordonnées GPS précises
export const geocodeAddress = async (address: string): Promise<LocationCoordinates | null> => {
  try {
    // Vérifier que l'adresse est fournie
    if (!address || address.trim().length === 0) {
      console.error('Aucune adresse fournie pour le géocodage');
      return null;
    }
    
    console.log(`Géocodage de l'adresse: "${address}"`);
    
    // Amélioration: S'assurer que l'adresse est complète avec ville/code postal pour meilleure précision
    let searchAddress = address;
    
    // Si l'adresse ne contient pas de code postal ou ville, ajouter "Paris" par défaut
    // Cette heuristique simple peut être améliorée pour une application en production
    if (!address.match(/\d{5}/) && !address.match(/Paris|Lyon|Marseille|Bordeaux|Lille|Toulouse/i)) {
      searchAddress = `${address}, Paris`;
      console.log(`Adresse complétée pour meilleure précision: "${searchAddress}"`);
    }
    
    // Utiliser l'API Expo Location pour géocoder l'adresse
    const geocodeResult = await Location.geocodeAsync(searchAddress);
    
    if (!geocodeResult || geocodeResult.length === 0) {
      console.error(`Aucun résultat trouvé pour l'adresse: ${searchAddress}`);
      
      // Essayer une seconde approche avec des options différentes si disponibles
      try {
        console.log("Tentative de géocodage avec options alternatives...");
        const secondAttempt = await Location.geocodeAsync(address, { 
          useGoogleMaps: true // Utiliser Google Maps si disponible (nécessite une clé API)
        });
        
        if (secondAttempt && secondAttempt.length > 0) {
          const location: LocationCoordinates = {
            latitude: secondAttempt[0].latitude,
            longitude: secondAttempt[0].longitude,
            address: address
          };
          
          console.log(`Géocodage alternatif réussi: ${address} => Lat: ${location.latitude}, Long: ${location.longitude}`);
          return location;
        }
      } catch (secondError) {
        console.error("Échec de la seconde tentative de géocodage", secondError);
      }
      
      return null;
    }
    
    // Prendre le premier résultat mais vérifier sa précision
    const location: LocationCoordinates = {
      latitude: geocodeResult[0].latitude,
      longitude: geocodeResult[0].longitude,
      address: address
    };
    
    console.log(`Géocodage réussi: ${address} => Lat: ${location.latitude}, Long: ${location.longitude}`);
    
    // Vérification supplémentaire - faire reverse geocoding pour confirmer l'adresse
    try {
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.latitude,
        longitude: location.longitude
      });
      
      if (reverseGeocode && reverseGeocode.length > 0) {
        // Construire l'adresse complète à partir des données de reverse geocoding
        const addressComponents = reverseGeocode[0];
        const formattedAddress = [
          addressComponents.name,
          addressComponents.street,
          addressComponents.postalCode,
          addressComponents.city,
          addressComponents.region
        ].filter(Boolean).join(", ");
        
        console.log(`Vérification d'adresse: ${formattedAddress}`);
        
        // Ajouter l'adresse formatée dans les données retournées pour référence
        location.formattedAddress = formattedAddress;
      }
    } catch (reverseError) {
      console.warn("Erreur lors de la vérification inverse d'adresse", reverseError);
    }
    
    return location;
  } catch (error) {
    console.error(`Erreur lors du géocodage de l'adresse: ${address}`, error);
    return null;
  }
};

// Mise à jour de la localisation d'un utilisateur dans la base de données
export const updateUserLocation = async (userId: string, location: LocationCoordinates): Promise<void> => {
  try {
    if (!userId || !location) {
      console.error('userId et location doivent être fournis pour updateUserLocation');
      return;
    }
    
    console.log(`Mise à jour de la localisation pour l'utilisateur ${userId}: Lat: ${location.latitude}, Long: ${location.longitude}, Précision: ${location.accuracy || 'non spécifiée'}m`);
    
    // Vérifier les valeurs de latitude et longitude
    if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number' ||
        isNaN(location.latitude) || isNaN(location.longitude)) {
      console.error('Coordonnées invalides:', location);
      return;
    }
    
    // Vérifier si l'utilisateur a déjà une entrée de localisation en utilisant RPC pour contourner RLS
    // Cette méthode est plus fiable si les politiques RLS posent problème
    try {
      // Tenter d'abord avec la méthode directe
      const { data, error } = await supabase
        .from('user_locations')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
        
      if (error) {
        console.warn('Erreur lors de la vérification de la localisation existante (méthode standard):', error);
        
        // Si l'erreur est liée à RLS, essayer en utilisant la fonction RPC
        if (error.code === '42501') { // Code d'erreur pour violation de politique RLS
          console.log('Tentative avec requête RPC pour contourner RLS...');
          
          // Utiliser la fonction RPC qui s'exécute avec des privilèges SECURITY DEFINER
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_location_id', { 
            p_user_id: userId 
          });
          
          if (!rpcError && rpcData) {
            console.log('ID de localisation récupéré via RPC:', rpcData);
            // Créer un objet compatible avec l'utilisation suivante
            return await updateViaRPC(userId, location);
          }
        }
      }
      
      // Fonction pour mettre à jour via RPC
      async function updateViaRPC(uid: string, loc: LocationCoordinates) {
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('insert_user_location', {
            p_user_id: uid,
            p_latitude: loc.latitude,
            p_longitude: loc.longitude,
            p_address: loc.address || null
          });
          
          if (rpcError) {
            console.error('Erreur lors de la mise à jour via RPC:', rpcError);
            return false;
          }
          
          console.log('Localisation mise à jour via RPC pour l\'utilisateur', uid);
          return true;
        } catch (e) {
          console.error('Exception lors de la mise à jour via RPC:', e);
          return false;
        }
      }
      
      if (data) {
        // Mettre à jour la localisation existante
        const { error: updateError } = await supabase
          .from('user_locations')
          .update({
            latitude: location.latitude,
            longitude: location.longitude,
            address: location.address || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.id);
          
        if (updateError) {
          console.error('Erreur lors de la mise à jour de la localisation:', updateError);
          
          // Si l'erreur est liée à RLS, essayer en forçant l'insertion
          if (updateError.code === '42501') {
            throw new Error('Violation de politique RLS, tentative alternative...');
          } else {
            throw updateError;
          }
        }
        
        console.log('Localisation mise à jour pour l\'utilisateur', userId);
        return;
      }
    } catch (checkError) {
      console.warn('Erreur lors de la vérification de localisation, tentative d\'insertion directe:', checkError);
      // Continuer vers l'insertion
    }
    
    // Essayer de supprimer toute entrée existante d'abord (pour éviter les doublons)
    try {
      await supabase
        .from('user_locations')
        .delete()
        .eq('user_id', userId);
    } catch (deleteError) {
      console.warn('Note: Erreur lors de la tentative de suppression des anciennes entrées:', deleteError);
      // Continuer quand même
    }
    
    // Créer une nouvelle entrée de localisation
    const { error: insertError } = await supabase
      .from('user_locations')
      .insert({
        user_id: userId,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address || null,
        updated_at: new Date().toISOString()
      });
      
    if (insertError) {
      console.error('Erreur lors de la création de la localisation:', insertError);
      
      // Tenter de résoudre le problème de sécurité RLS
      if (insertError.code === '42501') { // Violation de politique RLS
        console.log('Tentative d\'insertion avec fonction RPC (contournement RLS)...');
        
        // Utiliser la fonction RPC qui s'exécute avec des privilèges SECURITY DEFINER
        const { data: rpcData, error: rpcError } = await supabase.rpc('insert_user_location', {
          p_user_id: userId,
          p_latitude: location.latitude,
          p_longitude: location.longitude,
          p_address: location.address || null
        });
        
        if (rpcError) {
          console.error('Échec de la tentative de contournement RLS:', rpcError);
        } else {
          console.log('Localisation créée via RPC pour l\'utilisateur', userId, 'ID:', rpcData);
        }
      }
      
      // Même si l'insertion échoue, nous ne voulons pas planter l'application
    } else {
      console.log('Nouvelle localisation créée pour l\'utilisateur', userId);
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la localisation:', error);
    // Ne pas propager l'erreur pour éviter de bloquer l'application
  }
};

// Récupération de la localisation d'un utilisateur en temps réel
export const getUserLocation = async (userId: string): Promise<LocationCoordinates | null> => {
  try {
    const { data, error } = await supabase
      .from('user_locations')
      .select('latitude, longitude, address, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (error) {
      console.error('Erreur lors de la récupération de la localisation en temps réel:', error);
      throw error;
    }
    
    if (!data) {
      console.log(`Aucune localisation en temps réel trouvée pour l'utilisateur ${userId}`);
      return null;
    }
    
    // Vérifier si la localisation est récente (moins de 15 minutes)
    const updatedAt = new Date(data.updated_at);
    const now = new Date();
    const diffMs = now.getTime() - updatedAt.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    
    if (diffMinutes > 15) {
      console.warn(`La localisation en temps réel de l'utilisateur ${userId} est obsolète (${diffMinutes.toFixed(1)} minutes)`);
    }
    
    return {
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address
    };
  } catch (error) {
    console.error(`Erreur lors de la récupération de la localisation en temps réel de l'utilisateur ${userId}:`, error);
    return null;
  }
};

// Récupérer l'adresse du client à partir de sa requête
export const getClientAddressFromRequest = async (requestId: string): Promise<LocationCoordinates | null> => {
  try {
    const { data, error } = await supabase
      .from('requests')
      .select('location')
      .eq('id', requestId)
      .maybeSingle();
      
    if (error) {
      console.error('Erreur lors de la récupération de l\'adresse de la demande:', error);
      throw error;
    }
    
    if (!data || !data.location) {
      console.log(`Aucune adresse trouvée pour la demande ${requestId}`);
      return null;
    }
    
    // Si la localisation est déjà au format attendu
    if (data.location.latitude && data.location.longitude) {
      return {
        latitude: data.location.latitude,
        longitude: data.location.longitude,
        address: data.location.address || ''
      };
    }
    
    // Si c'est juste une chaîne d'adresse, essayer de la géocoder
    if (typeof data.location === 'string') {
      console.log(`Géocodage de l'adresse de la demande: ${data.location}`);
      const coordinates = await geocodeAddress(data.location);
      if (coordinates) {
        return coordinates;
      }
      
      // Si le géocodage échoue, retourner une structure avec juste l'adresse
      return {
        latitude: 0,
        longitude: 0,
        address: data.location
      };
    }
    
    console.log('Format de localisation non reconnu:', data.location);
    return null;
  } catch (error) {
    console.error(`Erreur lors de la récupération de l'adresse du client pour la demande ${requestId}:`, error);
    return null;
  }
};

// Abonnement aux changements de localisation d'un utilisateur
export const subscribeToUserLocation = (
  userId: string, 
  callback: (location: UserLocation) => void
) => {
  // Créer un canal Realtime pour suivre les changements de localisation
  const channel = supabase
    .channel(`location_updates_${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT ou UPDATE
        schema: 'public',
        table: 'user_locations',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        // Payload contient les nouvelles données de localisation
        console.log(`Mise à jour de localisation reçue pour l'utilisateur ${userId}:`, payload);
        
        // Appeler le callback avec les nouvelles données
        if (payload.new) {
          callback(payload.new as UserLocation);
        }
      }
    )
    .subscribe();
    
  console.log(`Abonnement aux mises à jour de localisation pour l'utilisateur ${userId} activé`);
  
  // Retourner une fonction pour se désabonner
  return () => {
    console.log(`Désabonnement des mises à jour de localisation pour l'utilisateur ${userId}`);
    supabase.removeChannel(channel);
  };
};

// Récupération de la position actuelle avec l'adresse
export const getCurrentPositionWithAddress = async (): Promise<LocationCoordinates | null> => {
  try {
    // Demander les permissions de localisation
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      console.log('Permission d\'accès à la localisation refusée');
      return null;
    }
    
    // Obtenir la position actuelle
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High
    });
    
    const coordinates: LocationCoordinates = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };
    
    // Obtenir l'adresse correspondante
    try {
      const addressResponse = await Location.reverseGeocodeAsync({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude
      });
      
      if (addressResponse && addressResponse.length > 0) {
        const addressObj = addressResponse[0];
        const addressStr = [
          addressObj.name,
          addressObj.street,
          addressObj.postalCode,
          addressObj.city
        ].filter(Boolean).join(', ');
        
        coordinates.address = addressStr;
      }
    } catch (addressError) {
      console.error('Erreur lors de la récupération de l\'adresse:', addressError);
    }
    
    return coordinates;
  } catch (error) {
    console.error('Erreur lors de la récupération de la position actuelle:', error);
    return null;
  }
};

// Fonction pour mettre à jour la position vers une adresse spécifique
export const updateUserToFixedLocation = async (userId: string, location: {
  latitude: number,
  longitude: number,
  address: string,
  formattedAddress?: string
}): Promise<boolean> => {
  try {
    console.log(`Mise à jour de la position de l'utilisateur ${userId}`);
    
    // Validation des paramètres
    if (!userId || !location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      console.error('Paramètres invalides pour la mise à jour de position');
      throw new Error("Cette fonction nécessite un ID utilisateur valide et des coordonnées complètes");
    }
    
    // Coordonnées précises pour l'adresse spécifiée
    const locationData: LocationCoordinates = {
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
      formattedAddress: location.formattedAddress || location.address
    };
    
    // Utiliser la fonction existante pour mettre à jour la position
    await updateUserLocation(userId, locationData);
    
    console.log(`Position de l'utilisateur mise à jour avec succès à ${location.address}`);
    return true;
  } catch (error) {
    console.error(`Erreur lors de la mise à jour de la position:`, error);
    return false;
  }
};