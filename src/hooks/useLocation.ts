import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Alert, Platform } from 'react-native';
import { LocationCoordinates } from '../services/api';
import { updateUserLocation, calculateDistance as calcDistance } from '../services/location';

// Type pour les options de localisation
interface LocationOptions {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
  distanceInterval?: number;
  timeInterval?: number;
  updateUserPosition?: boolean;
}

// Type pour le résultat du hook
interface LocationResult {
  location: LocationCoordinates | null;
  address: string | null;
  error: string | null;
  loading: boolean;
  requestPermission: () => Promise<boolean>;
  getCurrentPosition: () => Promise<LocationCoordinates | null>;
  startWatchingPosition: () => Promise<void>;
  stopWatchingPosition: () => void;
}

// Exporter le calcul de distance depuis le service de localisation
export const calculateDistance = (
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number => {
  return calcDistance(
    { latitude: lat1, longitude: lon1 },
    { latitude: lat2, longitude: lon2 }
  );
};

// Hook pour gérer la localisation
export const useLocation = (
  userId?: string,
  options: LocationOptions = {}
): LocationResult => {
  const [location, setLocation] = useState<LocationCoordinates | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [watcher, setWatcher] = useState<Location.LocationSubscription | null>(null);

  const {
    enableHighAccuracy = true,
    maximumAge = 10000,
    timeout = 15000,
    distanceInterval = 50, // mètres
    timeInterval = 10000, // 10 secondes
    updateUserPosition = false
  } = options;

  // Demander la permission d'accès à la localisation
  const requestPermission = async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setError('La permission d\'accéder à la localisation a été refusée');
        Alert.alert(
          'Permission requise',
          'Nous avons besoin de votre localisation pour vous montrer les demandes à proximité',
          [{ text: 'OK' }]
        );
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setError('Erreur lors de la demande de permission de localisation');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Récupérer la position actuelle
  const getCurrentPosition = async (): Promise<LocationCoordinates | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const hasPermission = await requestPermission();
      if (!hasPermission) return null;
      
      const locationOptions = {
        accuracy: Location.Accuracy.High,
        maximumAge,
        timeout
      };
      
      const position = await Location.getCurrentPositionAsync(locationOptions);
      
      const newLocation: LocationCoordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      
      // Récupérer l'adresse
      try {
        const addressResponse = await Location.reverseGeocodeAsync({
          latitude: newLocation.latitude,
          longitude: newLocation.longitude
        });
        
        if (addressResponse && addressResponse.length > 0) {
          const addressObj = addressResponse[0];
          const addressStr = [
            addressObj.name,
            addressObj.street,
            addressObj.postalCode,
            addressObj.city
          ].filter(Boolean).join(', ');
          
          setAddress(addressStr);
          newLocation.address = addressStr;
        }
      } catch (addressError) {
        console.error('Error getting address:', addressError);
      }
      
      setLocation(newLocation);
      
      // Mettre à jour la position de l'utilisateur dans la base de données
      if (updateUserPosition && userId) {
        try {
          await updateUserLocation(userId, newLocation);
        } catch (updateError) {
          console.error('Error updating user location:', updateError);
        }
      }
      
      return newLocation;
    } catch (error) {
      console.error('Error getting current position:', error);
      setError('Erreur lors de la récupération de la position');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Commencer à surveiller la position
  const startWatchingPosition = async (): Promise<void> => {
    if (watcher) {
      console.log('Already watching position');
      return;
    }
    
    const hasPermission = await requestPermission();
    if (!hasPermission) return;
    
    try {
      // Récupérer d'abord la position actuelle pour une mise à jour immédiate
      const initialPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      const initialLocation: LocationCoordinates = {
        latitude: initialPosition.coords.latitude,
        longitude: initialPosition.coords.longitude
      };
      
      // Obtenir l'adresse pour la position initiale
      try {
        const addressResponse = await Location.reverseGeocodeAsync({
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude
        });
        
        if (addressResponse && addressResponse.length > 0) {
          const addressObj = addressResponse[0];
          const addressStr = [
            addressObj.name,
            addressObj.street,
            addressObj.postalCode,
            addressObj.city
          ].filter(Boolean).join(', ');
          
          setAddress(addressStr);
          initialLocation.address = addressStr;
        }
      } catch (addressError) {
        console.error('Error getting initial address:', addressError);
      }
      
      // Mettre à jour l'état local avec la position initiale
      setLocation(initialLocation);
      
      // Mettre à jour la position de l'utilisateur dans la base de données immédiatement
      if (updateUserPosition && userId) {
        try {
          await updateUserLocation(userId, initialLocation);
          console.log('Position initiale mise à jour dans la base de données');
        } catch (updateError) {
          console.error('Error updating initial user location:', updateError);
        }
      }
      
      // Démarrer la surveillance continue de la position
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval,
          timeInterval
        },
        async (position) => {
          const newLocation: LocationCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          
          // On ne récupère l'adresse que si la distance a changé significativement (> 100m)
          // pour économiser des appels d'API
          let shouldUpdateAddress = false;
          
          if (location) {
            const distance = calculateDistance(
              location.latitude, 
              location.longitude, 
              newLocation.latitude, 
              newLocation.longitude
            );
            
            shouldUpdateAddress = distance > 0.1; // > 100m
          } else {
            shouldUpdateAddress = true;
          }
          
          if (shouldUpdateAddress) {
            try {
              const addressResponse = await Location.reverseGeocodeAsync({
                latitude: newLocation.latitude,
                longitude: newLocation.longitude
              });
              
              if (addressResponse && addressResponse.length > 0) {
                const addressObj = addressResponse[0];
                const addressStr = [
                  addressObj.name,
                  addressObj.street,
                  addressObj.postalCode,
                  addressObj.city
                ].filter(Boolean).join(', ');
                
                setAddress(addressStr);
                newLocation.address = addressStr;
              }
            } catch (addressError) {
              console.error('Error getting address:', addressError);
            }
          } else if (location?.address) {
            // Réutiliser l'adresse précédente si nous ne récupérons pas une nouvelle
            newLocation.address = location.address;
          }
          
          setLocation(newLocation);
          
          // Mettre à jour la position de l'utilisateur dans la base de données
          if (updateUserPosition && userId) {
            try {
              await updateUserLocation(userId, newLocation);
              console.log('Position mise à jour dans la base de données:', 
                `Lat: ${newLocation.latitude.toFixed(6)}, Long: ${newLocation.longitude.toFixed(6)}`);
            } catch (updateError) {
              console.error('Error updating user location:', updateError);
            }
          }
        }
      );
      
      setWatcher(subscription);
      console.log('Surveillance de la position démarrée avec succès');
    } catch (error) {
      console.error('Error watching position:', error);
      setError('Erreur lors de la surveillance de la position');
    }
  };

  // Arrêter de surveiller la position
  const stopWatchingPosition = (): void => {
    if (watcher) {
      watcher.remove();
      setWatcher(null);
    }
  };

  // Nettoyer lors du démontage du composant
  useEffect(() => {
    return () => {
      stopWatchingPosition();
    };
  }, []);

  return {
    location,
    address,
    error,
    loading,
    requestPermission,
    getCurrentPosition,
    startWatchingPosition,
    stopWatchingPosition
  };
};