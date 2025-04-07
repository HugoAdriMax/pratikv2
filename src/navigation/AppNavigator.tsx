import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { COLORS, SHADOWS } from '../utils/theme';

// Écrans d'authentification
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

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

// Écrans pour les administrateurs
import DashboardScreen from '../screens/admin/DashboardScreen';
import KycVerificationScreen from '../screens/admin/KycVerificationScreen';

// Écrans communs
import ProfileScreen from '../screens/common/ProfileScreen';

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
      name="Profile" 
      component={ProfileScreen} 
      options={{
        tabBarLabel: 'Profil',
        tabBarIcon: ({ color, size }) => (
          <View style={styles.tabIconContainer}>
            <Ionicons name="person" size={size} color={color} />
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
        tabBarLabel: 'Vérification',
        tabBarIcon: ({ color, size }) => (
          <View style={styles.tabIconContainer}>
            <Ionicons name="shield-checkmark" size={size} color={color} />
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
            </>
          )}
          
          {user.role === UserRole.PRESTAIRE && (
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
            </>
          )}
          
          {user.role === UserRole.ADMIN && (
            <Stack.Screen name="AdminTabs" component={AdminTabs} />
          )}
        </>
      ) : (
        // Utilisateur non connecté
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
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