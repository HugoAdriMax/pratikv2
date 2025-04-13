/**
 * Script pour désactiver le bandeau "rafraîchir" tout en conservant le rechargement à chaud
 */

// Configuration des outils de développement en mode développement
if (__DEV__) {
  console.log('Configuration du bandeau de développement...');
  
  // Désactiver uniquement le bandeau de développement d'Expo si disponible
  if (global.__EXPO_DEVTOOLS__) {
    global.__EXPO_DEVTOOLS__.showBanner = false;
  }
  
  try {
    // Importations dynamiques pour éviter les erreurs si les modules ne sont pas disponibles
    const { DevMenu } = require('expo-dev-client');
    
    // Désactiver uniquement le bandeau de rafraîchissement, mais garder le rechargement à chaud
    DevMenu && DevMenu.hideDevMenu();
    
    // Ne pas désactiver le contrôle de rafraîchissement pour permettre le rechargement à chaud
    // DevMenu && DevMenu.setDisableRefreshControl(false);
    
    console.log('Bandeau de rafraîchissement masqué, rechargement à chaud actif!');
  } catch (error) {
    console.log('Erreur lors de la configuration du menu de développement:', error);
  }
}