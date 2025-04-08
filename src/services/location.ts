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
  point1: { latitude: number; longitude: number }, 
  point2: { latitude: number; longitude: number }
): number => {
  const R = 6371; // Rayon de la Terre en km
  const toRad = (value: number) => (value * Math.PI) / 180;
  
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.latitude)) * Math.cos(toRad(point2.latitude)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance en km
  
  return Math.round(distance * 10) / 10; // Arrondi à 1 décimale
};

// Calcul du temps estimé d'arrivée en minutes
export const calculateETA = (distance: number, averageSpeed: number = 30): number => {
  // Vitesse en km/h, distance en km, résultat en minutes
  const timeInHours = distance / averageSpeed;
  const timeInMinutes = timeInHours * 60;
  return Math.round(timeInMinutes);
};

// Mise à jour de la localisation d'un utilisateur dans la base de données
export const updateUserLocation = async (userId: string, location: LocationCoordinates): Promise<void> => {
  try {
    if (!userId || !location) {
      console.error('userId et location doivent être fournis pour updateUserLocation');
      return;
    }
    
    // Vérifier si l'utilisateur a déjà une entrée de localisation
    const { data, error } = await supabase
      .from('user_locations')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (error) {
      console.error('Erreur lors de la vérification de la localisation existante:', error);
      throw error;
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
        throw updateError;
      }
      
      console.log('Localisation mise à jour pour l\'utilisateur', userId);
    } else {
      // Créer une nouvelle entrée de localisation
      const { error: insertError } = await supabase
        .from('user_locations')
        .insert({
          user_id: userId,
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address || null
        });
        
      if (insertError) {
        console.error('Erreur lors de la création de la localisation:', insertError);
        throw insertError;
      }
      
      console.log('Nouvelle localisation créée pour l\'utilisateur', userId);
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la localisation:', error);
    // Ne pas propager l'erreur pour éviter de bloquer l'application
  }
};

// Récupération de la localisation d'un utilisateur
export const getUserLocation = async (userId: string): Promise<LocationCoordinates | null> => {
  try {
    const { data, error } = await supabase
      .from('user_locations')
      .select('latitude, longitude, address, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (error) {
      console.error('Erreur lors de la récupération de la localisation:', error);
      throw error;
    }
    
    if (!data) {
      console.log(`Aucune localisation trouvée pour l'utilisateur ${userId}`);
      return null;
    }
    
    // Vérifier si la localisation est récente (moins de 15 minutes)
    const updatedAt = new Date(data.updated_at);
    const now = new Date();
    const diffMs = now.getTime() - updatedAt.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    
    if (diffMinutes > 15) {
      console.warn(`La localisation de l'utilisateur ${userId} est obsolète (${diffMinutes.toFixed(1)} minutes)`);
    }
    
    return {
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address
    };
  } catch (error) {
    console.error(`Erreur lors de la récupération de la localisation de l'utilisateur ${userId}:`, error);
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