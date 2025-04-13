import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, NavigationContainerRef } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { StripeProvider } from '@stripe/stripe-react-native';
import { COLORS } from './src/utils/theme';
import { LogBox, Platform, View, AppState, Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import SplashScreen from './src/screens/common/SplashScreen';
import * as Updates from 'expo-updates';
import * as Device from 'expo-device';
import { DevMenu } from 'expo-dev-client';

// Ignorer les avertissements non critiques
LogBox.ignoreLogs([
  'Text strings must be rendered within a <Text> component',
  'Warning: Cannot update a component',
  'Overwriting fontFamily style attribute preprocessor',
  'Warning: Failed prop type',
  'Cannot read property \'bubblingEventTypes\' of null',
  'Warning: Each child in a list should have a unique "key" prop',
  'TypeError: Cannot read property \'bubblingEventTypes\' of null'
]);

// Thème personnalisé pour la navigation
const MyTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    background: COLORS.background,
    card: COLORS.card,
    text: COLORS.text,
    border: COLORS.border,
    notification: COLORS.danger,
  },
};

// Fonction utilitaire pour accéder au stockage sécurisé
const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.error('Error retrieving data from localStorage:', error);
        return null;
      }
    } else {
      try {
        return await SecureStore.getItemAsync(key);
      } catch (error) {
        console.error('Error retrieving data from SecureStore:', error);
        return null;
      }
    }
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('Error removing data from localStorage:', error);
      }
    } else {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (error) {
        console.error('Error removing data from SecureStore:', error);
      }
    }
  }
};

// Récupération des clés Stripe depuis les variables d'environnement
const STRIPE_PUBLISHABLE_KEY = Constants.expoConfig?.extra?.stripePublishableKey || 'pk_test_51ORozkLw25R2aqxP90kYGXpHXhWGophuuoUGMxnRuoHLrcM7nuUb5EXvePdx7mrQhX5AOQIwyfbfYGWTaLjXOAj700BcFaYqL1';
const STRIPE_MERCHANT_ID = Constants.expoConfig?.extra?.stripeMerchantId || 'merchant.com.yourcompany.clientprestations';

// Log pour déboguer
console.log('Clé publique Stripe utilisée:', STRIPE_PUBLISHABLE_KEY);

// Désactiver le bandeau de rafraîchissement en mode développement
if (__DEV__) {
  // Désactiver tous les logs et avertissements
  LogBox.ignoreAllLogs();
  
  // Désactiver le bandeau de rafraîchissement si disponible dans le contexte global
  if (global.__EXPO_DEVTOOLS__) {
    global.__EXPO_DEVTOOLS__.showBanner = false;
  }
}

export default function App() {
  // État pour contrôler l'affichage du splash screen
  const [showSplash, setShowSplash] = useState(true);
  
  // Référence à l'objet de navigation
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  
  // Effet pour masquer uniquement le bandeau de rafraîchissement
  useEffect(() => {
    // Configurer le bandeau de développement
    const configureDevTools = () => {
      if (__DEV__) {
        // On garde les logs utiles mais on ignore les warnings fréquents
        // LogBox.ignoreAllLogs();
        
        // Si la propriété existe, désactiver le bandeau de développement
        if (global.__EXPO_DEVTOOLS__) {
          global.__EXPO_DEVTOOLS__.showBanner = false;
        }
        
        // Désactiver uniquement le bandeau de développement d'Expo
        try {
          DevMenu.hideDevMenu();
          // Ne pas désactiver ces fonctionnalités pour permettre le rechargement à chaud
          // DevMenu.disableLogBox();
          // DevMenu.setDisableRefreshControl(true);
        } catch (error) {
          console.log("Erreur lors de la configuration du menu de développement:", error);
        }
      }
    };
    
    configureDevTools();
    
    // Appliquer à chaque fois que l'app devient active
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        configureDevTools();
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, []);

  // Effet pour vérifier les navigations en attente (après les clics de notification)
  useEffect(() => {
    const checkPendingNavigation = async () => {
      try {
        const pendingNavStr = await secureStorage.getItem('pendingNavigation');
        if (pendingNavStr) {
          const pendingNav = JSON.parse(pendingNavStr);
          const now = new Date().getTime();
          
          // Vérifier si la navigation est récente (moins de 10 secondes)
          if (pendingNav.timestamp && now - pendingNav.timestamp < 10000) {
            console.log('Exécution de la navigation en attente:', pendingNav);
            
            // Supprimer la navigation en attente pour éviter les doublons
            await secureStorage.removeItem('pendingNavigation');
            
            // Effectuer la navigation si la référence est disponible
            if (navigationRef.current && pendingNav.screen) {
              // Attendre un peu que la navigation soit prête
              setTimeout(() => {
                // Gérer la navigation imbriquée si nécessaire
                if (pendingNav.params && pendingNav.params.screen) {
                  // Navigation imbriquée
                  navigationRef.current?.navigate(pendingNav.screen, pendingNav.params);
                } else {
                  // Navigation simple
                  navigationRef.current?.navigate(pendingNav.screen, pendingNav.params || {});
                }
              }, 500);
            }
          } else {
            // Nettoyer les navigations trop anciennes
            await secureStorage.removeItem('pendingNavigation');
          }
        }
      } catch (error) {
        console.error('Erreur lors de la vérification des navigations en attente:', error);
      }
    };
    
    // Vérifier au démarrage
    checkPendingNavigation();
    
    // Vérifier périodiquement (toutes les 2 secondes)
    const interval = setInterval(checkPendingNavigation, 2000);
    
    return () => clearInterval(interval);
  }, []);

  // Rendu conditionnel en fonction de l'état du splash screen
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer 
          ref={navigationRef}
          theme={MyTheme}
          onReady={() => {
            console.log('Navigation prête, vérification des navigations en attente...');
          }}
        >
          <StatusBar style="auto" translucent={false} />
          <AuthProvider>
            <StripeProvider
              publishableKey="pk_test_51RBfQBGCiyrDqa9RuKVHhXGHQaB7TmZtNJSbuuv3uAD1S2yNtFRb8yLX6Lpvm0fi45d3FnBtXVyAtwcTE2T5jmOm00uB96WoLs"
              merchantIdentifier={STRIPE_MERCHANT_ID}
              urlScheme="clientprestations"
            >
              <AppNavigator />
            </StripeProvider>
          </AuthProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}