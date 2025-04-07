import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export const useLocation = (options = {}) => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let locationSubscription: Location.LocationSubscription | null = null;

    const getLocation = async () => {
      try {
        setLoading(true);
        
        // Demander la permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status !== 'granted') {
          setError('Permission d\'accès à la localisation refusée');
          setLoading(false);
          return;
        }
        
        // Obtenir la position actuelle
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        
        const { latitude, longitude, accuracy } = currentLocation.coords;
        
        if (isMounted) {
          setLocation({ latitude, longitude, accuracy });
          setError(null);
        }
        
        // Configurer un abonnement pour les mises à jour de position
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,    // 5 secondes
            distanceInterval: 10,  // 10 mètres
          },
          (newLocation) => {
            if (isMounted) {
              const { latitude, longitude, accuracy } = newLocation.coords;
              setLocation({ latitude, longitude, accuracy });
            }
          }
        );
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Une erreur est survenue lors de la récupération de la localisation');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    getLocation();

    // Nettoyage
    return () => {
      isMounted = false;
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  return { location, error, loading };
};

export default useLocation;