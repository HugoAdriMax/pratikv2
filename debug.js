console.log('User:', JSON.stringify(user));

// Functions to debug location issues in development
import { updateUserToFixedLocation } from './src/services/location';
import { useAuth } from './src/context/AuthContext';

// Expose these functions to the global scope for debugging
if (global.__DEV__) {
  // Give these functions more explicit names for debugging
  global.fixPrestataireLocation = async () => {
    try {
      // This needs to be called in a component with access to authentication context
      const { user } = useAuth();
      if (!user) {
        console.error('Vous devez être connecté pour utiliser cette fonction');
        return false;
      }
      
      // Coordonnées pour 5 rue des Sablons
      const sablonsLocation = {
        latitude: 48.8639,
        longitude: 2.2870,
        address: "5 rue des Sablons, 75016 Paris"
      };
      
      const success = await updateUserToFixedLocation(user.id, sablonsLocation);
      console.log('Mise à jour de position prestataire:', success ? 'RÉUSSIE' : 'ÉCHOUÉE');
      
      return success;
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la position prestataire:', error);
      return false;
    }
  };
  
  global.fixClientLocation = async () => {
    try {
      // This needs to be called in a component with access to authentication context
      const { user } = useAuth();
      if (!user) {
        console.error('Vous devez être connecté pour utiliser cette fonction');
        return false;
      }
      
      // Coordonnées pour 74 bis rue Lauriston
      const lauristonLocation = {
        latitude: 48.8683356,
        longitude: 2.288925,
        address: "74 bis rue Lauriston, 75016 Paris"
      };
      
      const success = await updateUserToFixedLocation(user.id, lauristonLocation);
      console.log('Mise à jour de position client:', success ? 'RÉUSSIE' : 'ÉCHOUÉE');
      
      return success;
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la position client:', error);
      return false;
    }
  };
  
  // Function to fix location by providing the user ID directly - useful for cross-profile debugging
  global.fixLocationByUserId = async (userId, isPrestataire = true) => {
    try {
      if (!userId) {
        console.error('Vous devez fournir un ID utilisateur');
        return false;
      }
      
      let success;
      
      if (isPrestataire) {
        // Coordonnées pour 5 rue des Sablons (prestataire)
        const sablonsLocation = {
          latitude: 48.8639,
          longitude: 2.2870,
          address: "5 rue des Sablons, 75016 Paris"
        };
        
        success = await updateUserToFixedLocation(userId, sablonsLocation);
        console.log('Mise à jour de position prestataire:', success ? 'RÉUSSIE' : 'ÉCHOUÉE');
      } else {
        // Coordonnées pour 74 bis rue Lauriston (client)
        const lauristonLocation = {
          latitude: 48.8683356,
          longitude: 2.288925,
          address: "74 bis rue Lauriston, 75016 Paris"
        };
        
        success = await updateUserToFixedLocation(userId, lauristonLocation);
        console.log('Mise à jour de position client:', success ? 'RÉUSSIE' : 'ÉCHOUÉE');
      }
      
      return success;
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la position:', error);
      return false;
    }
  };
  
  console.log('Fonctions de debug pour la localisation chargées:');
  console.log('- global.fixPrestataireLocation() : Corrige la position prestataire à 5 rue des Sablons');
  console.log('- global.fixClientLocation() : Corrige la position client à 74 bis rue Lauriston');
  console.log('- global.fixLocationByUserId(userId, isPrestataire) : Corrige la position d\'un utilisateur spécifique');
}
