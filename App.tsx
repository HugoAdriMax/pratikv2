import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { StripeProvider } from '@stripe/stripe-react-native';
import { COLORS } from './src/utils/theme';
import { LogBox } from 'react-native';

// Ignorer les avertissements non critiques
LogBox.ignoreLogs([
  'Text strings must be rendered within a <Text> component',
  'Warning: Cannot update a component',
  'Overwriting fontFamily style attribute preprocessor',
  'Warning: Failed prop type',
  'Cannot read property \'bubblingEventTypes\' of null'
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

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={MyTheme}>
          <StatusBar style="auto" />
          <AuthProvider>
            <StripeProvider
              publishableKey="pk_test_placeholder" // À remplacer par votre clé Stripe réelle
              urlScheme="your-app-scheme" // À configurer selon votre app
            >
              <AppNavigator />
            </StripeProvider>
          </AuthProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}