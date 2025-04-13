import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { COLORS, SHADOWS } from '../utils/theme';
import { supabase } from '../config/supabase';

// Écrans d'authentification
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Écrans pour les clients
import ChatbotScreen from '../screens/client/ChatbotScreen';
import RequestsScreen from '../screens/client/RequestsScreen';
import RequestDetailScreen from '../screens/client/RequestDetailScreen';
import TrackingScreen from '../screens/client/TrackingScreen';
import ReviewScreen from '../screens/client/ReviewScreen';

// Écrans pour les prestataires
import RequestListScreen from '../screens/prestataire/RequestListScreen';
import PrestataireRequestDetailScreen from '../screens/prestataire/RequestDetailScreen';
import MyJobsScreen from '../screens/prestataire/MyJobsScreen';
import JobTrackingScreen from '../screens/prestataire/JobTrackingScreen';
import ReviewsScreen from '../screens/prestataire/ReviewsScreen';
import StatisticsScreen from '../screens/prestataire/StatisticsScreen';

// Écran d'édition de profil
import SimpleEditProfileScreen from '../screens/common/SimpleEditProfileScreen';

// Écrans pour les administrateurs
import DashboardScreen from '../screens/admin/DashboardScreen';
import KycVerificationScreen from '../screens/admin/KycVerificationScreen';
import PrestatairesScreen from '../screens/admin/PrestatairesScreen';

// Écrans spécifiques pour les prestataires
import ActivationPendingScreen from '../screens/prestataire/ActivationPendingScreen';
import KycSubmissionScreen from '../screens/prestataire/KycSubmissionScreen';
import StripeConnectScreen from '../screens/prestataire/StripeConnectScreen';

// Écrans communs
import ProfileScreen from '../screens/common/ProfileScreen';
import NotificationSettingsScreen from '../screens/common/NotificationSettingsScreen';
import NotificationsListScreen from '../screens/common/NotificationsListScreen';
import ChatScreen from '../screens/common/ChatScreen';
import ServiceSelectionScreen from '../screens/prestataire/ServiceSelectionScreen';
import DesignSystemTestScreen from '../screens/common/DesignSystemTestScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Navigation pour les clients
const ClientTabs = () => (
  <Tab.Navigator
    screenOptions={{
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textSecondary,
      headerShown: false,
      tabBarStyle: styles.tabBar,
      tabBarLabelStyle: styles.tabBarLabel,
      tabBarItemStyle: styles.tabBarItem,
      tabBarShowLabel: true,
    }}
  >
    <Tab.Screen 
      name="Chatbot" 
      component={ChatbotScreen} 
      options={{
        tabBarLabel: 'Nouvelle',
        tabBarIcon: ({ color, size }) => (
          <View style={styles.tabIconContainer}>
            <Ionicons name="add-circle" size={size} color={color} />
          </View>
        ),
      }}
    />
    <Tab.Screen 
      name="Requests" 
      component={RequestsScreen} 
      options={{
        tabBarLabel: 'Demandes',
        tabBarIcon: ({ color, size }) => (
          <View style={styles.tabIconContainer}>
            <Ionicons name="list" size={size} color={color} />
          </View>
        ),
      }}
    />
    <Tab.Screen 
      name="Profile" 
      component={ProfileScreen} 
      options={{
        tabBarLabel: 'Profil',
        tabBarIcon: ({ color, size }) => (
          <View style={styles.tabIconContainer}>
            <Ionicons name="person" size={size} color={color} />
            {/* Notification badge will be added in the future */}
          </View>
        ),
      }}
    />
  </Tab.Navigator>
);

// Navigation pour les prestataires
const PrestataireTabs = () => (
  <Tab.Navigator
    screenOptions={{
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textSecondary,
      headerShown: false,
      tabBarStyle: styles.tabBar,
      tabBarLabelStyle: styles.tabBarLabel,
      tabBarItemStyle: styles.tabBarItem,
      tabBarShowLabel: true,
    }}
  >
    <Tab.Screen 
      name="RequestList" 
      component={RequestListScreen} 
      options={{
        tabBarLabel: 'Demandes',
        tabBarIcon: ({ color, size }) => (
          <View style={styles.tabIconContainer}>
            <Ionicons name="search" size={size} color={color} />
          </View>
        ),
      }}
    />
    <Tab.Screen 
      name="MyJobs" 
      component={MyJobsScreen} 
      options={{
        tabBarLabel: 'Missions',
        tabBarIcon: ({ color, size }) => (
          <View style={styles.tabIconContainer}>
            <Ionicons name="briefcase" size={size} color={color} />
          </View>
        ),
      }}
    />
    <Tab.Screen 
      name="Statistics" 
      component={StatisticsScreen} 
      options={{
        tabBarLabel: 'Statistiques',
        tabBarIcon: ({ color, size }) => (
          <View style={styles.tabIconContainer}>
            <Ionicons name="stats-chart" size={size} color={color} />
          </View>
        ),
      }}
    />
    <Tab.Screen 
      name="Profile" 
      component={ProfileScreen} 
      options={{
        tabBarLabel: 'Profil',
        tabBarIcon: ({ color, size }) => (
          <View style={styles.tabIconContainer}>
            <Ionicons name="person" size={size} color={color} />
            {/* Notification badge will be added in the future */}
          </View>
        ),
      }}
    />
  </Tab.Navigator>
);

// Navigation pour les administrateurs
const AdminTabs = () => (
  <Tab.Navigator
    screenOptions={{
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textSecondary,
      headerShown: false,
      tabBarStyle: styles.tabBar,
      tabBarLabelStyle: styles.tabBarLabel,
      tabBarItemStyle: styles.tabBarItem,
      tabBarShowLabel: true,
    }}
  >
    <Tab.Screen 
      name="Dashboard" 
      component={DashboardScreen} 
      options={{
        tabBarLabel: 'Dashboard',
        tabBarIcon: ({ color, size }) => (
          <View style={styles.tabIconContainer}>
            <Ionicons name="home" size={size} color={color} />
          </View>
        ),
      }}
    />
    <Tab.Screen 
      name="KycVerification" 
      component={KycVerificationScreen} 
      options={{
        tabBarLabel: 'KYC',
        tabBarIcon: ({ color, size }) => (
          <View style={styles.tabIconContainer}>
            <Ionicons name="shield-checkmark" size={size} color={color} />
          </View>
        ),
      }}
    />
    <Tab.Screen 
      name="Prestataires" 
      component={PrestatairesScreen} 
      options={{
        tabBarLabel: 'Prestataires',
        tabBarIcon: ({ color, size }) => (
          <View style={styles.tabIconContainer}>
            <Ionicons name="people" size={size} color={color} />
          </View>
        ),
      }}
    />
    <Tab.Screen 
      name="Profile" 
      component={ProfileScreen} 
      options={{
        tabBarLabel: 'Profil',
        tabBarIcon: ({ color, size }) => (
          <View style={styles.tabIconContainer}>
            <Ionicons name="person" size={size} color={color} />
            {/* Notification badge will be added in the future */}
          </View>
        ),
      }}
    />
  </Tab.Navigator>
);

const AppNavigator = () => {
  const { user, loading } = useAuth();

  // Afficher un écran de chargement pendant la vérification de l'état d'authentification
  if (loading) {
    return null; // Ou un composant de chargement
  }

  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        headerStyle: styles.header,
        headerShadowVisible: false,
        headerTitleStyle: styles.headerTitle,
        headerBackTitleVisible: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      {user ? (
        // Utilisateur connecté
        <>
          {user.role === UserRole.CLIENT && (
            <>
              <Stack.Screen name="ClientTabs" component={ClientTabs} />
              <Stack.Screen 
                name="RequestDetail" 
                component={RequestDetailScreen}
                options={{ 
                  headerShown: true,
                  title: 'Détails de la demande'
                }}
              />
              <Stack.Screen 
                name="TrackingScreen" 
                component={TrackingScreen}
                options={{ 
                  headerShown: true,
                  title: 'Suivi en temps réel',
                }}
              />
              <Stack.Screen 
                name="ReviewScreen" 
                component={ReviewScreen}
                options={{ 
                  headerShown: true,
                  title: 'Évaluation',
                }}
              />
              <Stack.Screen 
                name="NotificationSettings" 
                component={NotificationSettingsScreen}
                options={{ 
                  headerShown: false, // Suppression du header
                }}
              />
              <Stack.Screen 
                name="NotificationsList" 
                component={NotificationsListScreen}
                options={{ 
                  headerShown: true,
                  title: 'Notifications',
                }}
              />
              <Stack.Screen 
                name="Chat" 
                component={ChatScreen}
                options={{ 
                  headerShown: true,
                  title: 'Conversation',
                }}
              />
              <Stack.Screen 
                name="EditProfile" 
                component={SimpleEditProfileScreen}
                options={{ 
                  headerShown: false,
                }}
              />
            </>
          )}
          
          {user.role === UserRole.PRESTAIRE && (
            <>
              {(() => {
                // Le statut d'un prestataire peut être :
                // 1. Actif (is_active=true) - Montre l'interface normale
                // 2. Inactif (is_active=false) et a soumis KYC (kyc_submitted=true) - Montre l'écran d'attente
                // 3. Inactif (is_active=false) et n'a pas soumis KYC - Montre l'écran de soumission KYC
                
                // Vérifier si le prestataire est actif
                if (user.is_active) {
                  console.log("Prestataire actif, affichage de l'interface normale");
                  return (
                    <>
                      <Stack.Screen name="PrestataireTabs" component={PrestataireTabs} />
                      <Stack.Screen 
                        name="RequestDetail" 
                        component={PrestataireRequestDetailScreen}
                        options={{ 
                          headerShown: true,
                          title: 'Détails de la demande'
                        }}
                      />
                      <Stack.Screen 
                        name="JobTracking" 
                        component={JobTrackingScreen}
                        options={{ 
                          headerShown: true,
                          title: 'Suivi de mission',
                        }}
                      />
                      <Stack.Screen 
                        name="Reviews" 
                        component={ReviewsScreen}
                        options={{ 
                          headerShown: true,
                          title: 'Évaluations',
                        }}
                      />
                      <Stack.Screen 
                        name="NotificationSettings" 
                        component={NotificationSettingsScreen}
                        options={{ 
                          headerShown: false, // Suppression du header
                        }}
                      />
                      <Stack.Screen 
                        name="NotificationsList" 
                        component={NotificationsListScreen}
                        options={{ 
                          headerShown: true,
                          title: 'Notifications',
                        }}
                      />
                      <Stack.Screen 
                        name="Chat" 
                        component={ChatScreen}
                        options={{ 
                          headerShown: true,
                          title: 'Conversation',
                        }}
                      />
                      <Stack.Screen 
                        name="ServiceSelection" 
                        component={ServiceSelectionScreen}
                        options={{ 
                          headerShown: true,
                          title: 'Mes services',
                        }}
                      />
                      <Stack.Screen 
                        name="StripeConnect" 
                        component={StripeConnectScreen}
                        options={{ 
                          headerShown: true,
                          title: 'Configuration des paiements',
                        }}
                      />
                      <Stack.Screen 
                        name="EditProfile" 
                        component={SimpleEditProfileScreen}
                        options={{ 
                          headerShown: false,
                        }}
                      />
                    </>
                  );
                }
                
                // Vérification du statut KYC - essayer plusieurs méthodes pour être sûr
                const hasSubmittedKyc = user.kyc_submitted || false;
                
                // Vérifier aussi s'il y a une entrée dans la table kyc ou prestataire_activations
                const checkKycStatus = async () => {
                  try {
                    const { data: kycData } = await supabase
                      .from('kyc')
                      .select('id')
                      .eq('user_id', user.id)
                      .maybeSingle();
                    
                    const { data: activationData } = await supabase
                      .from('prestataire_activations')
                      .select('id')
                      .eq('user_id', user.id)
                      .maybeSingle();
                    
                    return Boolean(kycData || activationData);
                  } catch (e) {
                    console.error("Erreur lors de la vérification du statut KYC:", e);
                    return hasSubmittedKyc;
                  }
                };
                
                // Option par défaut - diriger vers l'écran de soumission KYC
                console.log("Prestataire inactif, vérification du statut KYC");
                
                // Si on a déjà une indication que le KYC a été soumis, montrer l'écran d'attente
                if (hasSubmittedKyc) {
                  console.log("KYC déjà soumis selon user.kyc_submitted, affichage de l'écran d'attente");
                  return (
                    <Stack.Screen 
                      name="ActivationPending" 
                      component={ActivationPendingScreen}
                      options={{
                        headerShown: false
                      }}
                    />
                  );
                }
                
                // Par défaut, montrer l'écran de soumission KYC
                console.log("KYC pas encore soumis, affichage de l'écran de soumission KYC");
                return (
                  <Stack.Screen 
                    name="KycSubmission" 
                    component={KycSubmissionScreen}
                    options={{
                      headerShown: false,
                      title: 'Vérification de votre compte'
                    }}
                  />
                );
              })()}
            </>
          )}
          
          {user.role === UserRole.ADMIN && (
            <>
              <Stack.Screen 
                name="AdminTabs" 
                component={AdminTabs} 
                options={{
                  headerShown: false
                }}
              />
              <Stack.Screen 
                name="NotificationSettings" 
                component={NotificationSettingsScreen}
                options={{ 
                  headerShown: false, // Suppression du header
                }}
              />
              <Stack.Screen 
                name="NotificationsList" 
                component={NotificationsListScreen}
                options={{ 
                  headerShown: true,
                  title: 'Notifications',
                }}
              />
              <Stack.Screen 
                name="Chat" 
                component={ChatScreen}
                options={{ 
                  headerShown: true,
                  title: 'Conversation',
                }}
              />
              <Stack.Screen 
                name="EditProfile" 
                component={SimpleEditProfileScreen}
                options={{ 
                  headerShown: false,
                }}
              />
            </>
          )}
          
          {/* Écran commun à tous les types d'utilisateurs */}
          <Stack.Screen 
            name="DesignSystem" 
            component={DesignSystemTestScreen}
            options={{ 
              headerShown: true,
              title: 'Design System'
            }}
          />
        </>
      ) : (
        // Utilisateur non connecté
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    elevation: 0,
    shadowOpacity: 0,
    borderTopColor: COLORS.border,
    height: 85,
    paddingTop: 8,
    paddingBottom: 24, // Augmenté pour accommoder la barre home de l'iPhone
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 0,
  },
  tabBarItem: {
    paddingVertical: 0,
    height: 45,
  },
  tabIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  header: {
    backgroundColor: COLORS.white,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
  },
});

export default AppNavigator;