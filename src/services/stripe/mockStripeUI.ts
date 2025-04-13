// Fichier de simulation d'interface Stripe pour le développement
import { Alert } from 'react-native';

/**
 * Affiche une alerte simulant l'interface de paiement Stripe
 * pour tester le flux sans vrai Stripe
 */
export const showMockStripePaymentSheet = async (): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    // Simuler un délai comme si l'interface se chargeait
    setTimeout(() => {
      Alert.alert(
        'Simulation de paiement',
        'Choisissez le résultat du paiement:',
        [
          {
            text: 'Paiement réussi (4242)',
            onPress: () => {
              console.log('Simulation: Paiement réussi');
              resolve({ success: true });
            },
            style: 'default',
          },
          {
            text: 'Paiement refusé (9995)',
            onPress: () => {
              console.log('Simulation: Paiement refusé');
              resolve({ 
                success: false, 
                error: 'Simulation: La carte a été refusée'
              });
            },
            style: 'destructive',
          },
          {
            text: 'Annuler',
            onPress: () => {
              console.log('Simulation: Paiement annulé');
              resolve({ 
                success: false, 
                error: 'Paiement annulé par l\'utilisateur'
              });
            },
            style: 'cancel',
          },
        ],
        { cancelable: false }
      );
    }, 500);
  });
};