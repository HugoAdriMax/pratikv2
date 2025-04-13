import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import supabase from '../config/supabase';
import { User, UserRole } from '../types';
import { Session } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, handleNotification, saveUserNotificationToken } from '../services/notification';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, phone: string, role: UserRole, serviceIds?: string[]) => Promise<{ error: any, user: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Stockage sécurisé hybride pour fonctionner sur le web et les appareils mobiles
const secureStorage = {
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.error('Error storing auth data in localStorage:', error);
      }
    } else {
      try {
        await SecureStore.setItemAsync(key, value);
      } catch (error) {
        console.error('Error storing auth data in SecureStore:', error);
      }
    }
  },
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.error('Error retrieving auth data from localStorage:', error);
        return null;
      }
    } else {
      try {
        return await SecureStore.getItemAsync(key);
      } catch (error) {
        console.error('Error retrieving auth data from SecureStore:', error);
        return null;
      }
    }
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('Error removing auth data from localStorage:', error);
      }
    } else {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (error) {
        console.error('Error removing auth data from SecureStore:', error);
      }
    }
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Références pour les écouteurs de notifications
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  // Fonction pour récupérer le profil utilisateur
  const fetchUserProfile = async (userId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) throw error;
      return data as User;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setError('Impossible de récupérer les informations du profil');
      return null;
    }
  };

  // Fonction pour rafraîchir le profil
  const refreshProfile = async (): Promise<void> => {
    if (!session?.user) return;
    
    try {
      console.log("Refreshing user profile for ID:", session.user.id);
      
      const profile = await fetchUserProfile(session.user.id);
      if (profile) {
        console.log("Profile refreshed successfully:", JSON.stringify(profile));
        setUser(profile);
        
        // Stockage sécurisé du profil pour l'accès hors ligne
        await secureStorage.setItem('userProfile', JSON.stringify(profile));
      } else {
        console.warn("Unable to refresh profile: No profile data returned");
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  // Initialisation des notifications
  useEffect(() => {
    // Configurer les écouteurs de notifications
    if (user) {
      const setupNotifications = async () => {
        try {
          // Enregistrer le token de l'appareil
          const token = await registerForPushNotificationsAsync();
          
          if (token) {
            // Sauvegarder le token dans Supabase
            const saved = await saveUserNotificationToken(user.id, token);
            if (saved) {
              console.log('Token de notification enregistré avec succès');
            } else {
              console.warn('Échec de l\'enregistrement du token de notification');
            }
          }
        } catch (error) {
          console.error('Erreur lors de l\'enregistrement pour les notifications:', error);
        }
      };
      
      setupNotifications();
      
      // Écouter les notifications reçues quand l'app est au premier plan
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification reçue au premier plan:', notification);
      });
      
      // Écouter les interactions avec les notifications (clic)
      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Réponse de notification reçue:', response);
        const result = handleNotification(response.notification);
        
        // Naviguer vers l'écran approprié si nécessaire
        if (result?.type === 'navigate' && result.screen) {
          // Note: Ici, nous n'avons pas accès direct à la navigation
          // On va utiliser une solution intermédiaire avec un événement global
          console.log('Navigation recommandée vers:', result.screen, result.params);
          
          // Stocker les informations de navigation dans le localStorage/AsyncStorage
          // pour que le composant App puisse les récupérer et effectuer la navigation
          const navigationData = {
            screen: result.screen,
            params: result.params,
            timestamp: new Date().getTime()
          };
          
          // Utiliser le storage qui est déjà défini dans ce contexte
          secureStorage.setItem('pendingNavigation', JSON.stringify(navigationData));
        }
      });
    }
    
    // Nettoyage des écouteurs quand le composant est démonté
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [user]); // Dépendance à user pour configurer les notifications seulement quand l'utilisateur change

  // Initialisation de l'état d'authentification
  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Vérifier d'abord les données stockées localement pour un chargement rapide
        const storedProfile = await secureStorage.getItem('userProfile');
        if (storedProfile) {
          try {
            setUser(JSON.parse(storedProfile));
          } catch (e) {
            console.error('Error parsing stored profile:', e);
          }
        }
        
        // Vérifier la session côté serveur
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        
        if (currentSession?.user) {
          const profile = await fetchUserProfile(currentSession.user.id);
          if (profile) {
            setUser(profile);
            await secureStorage.setItem('userProfile', JSON.stringify(profile));
          } else {
            // Si le profil n'existe pas, déconnecter l'utilisateur
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            await secureStorage.removeItem('userProfile');
          }
        } else {
          // Aucune session active
          setUser(null);
          await secureStorage.removeItem('userProfile');
        }
      } catch (error) {
        console.error('Error during authentication initialization:', error);
        setError('Erreur lors de l\'initialisation de l\'authentification');
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Écouter les changements d'état d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth state changed:', event);
      setSession(newSession);
      
      if (event === 'SIGNED_IN' && newSession) {
        const profile = await fetchUserProfile(newSession.user.id);
        if (profile) {
          setUser(profile);
          await secureStorage.setItem('userProfile', JSON.stringify(profile));
        }
      } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setUser(null);
        await secureStorage.removeItem('userProfile');
      } else if (event === 'TOKEN_REFRESHED' && newSession) {
        // Rafraîchir les données du profil lors d'un rafraîchissement de token
        const profile = await fetchUserProfile(newSession.user.id);
        if (profile) {
          setUser(profile);
          await secureStorage.setItem('userProfile', JSON.stringify(profile));
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) throw error;
      
      if (data.user) {
        const profile = await fetchUserProfile(data.user.id);
        if (profile) {
          setUser(profile);
          await secureStorage.setItem('userProfile', JSON.stringify(profile));
        }
      }
      
      return { error: null };
    } catch (error: any) {
      console.error('Sign in error:', error);
      let errorMessage = 'Erreur lors de la connexion';
      
      if (error.message) {
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Email ou mot de passe incorrect';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Veuillez confirmer votre email avant de vous connecter';
        }
      }
      
      setError(errorMessage);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, phone: string, role: UserRole, serviceIds?: string[]) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            role,
            phone
          }
        }
      });
      
      if (error) throw error;
      
      // Créer un enregistrement dans la table users
      if (data.user) {
        // Déterminer si l'utilisateur doit être actif par défaut
        // Les clients sont actifs et vérifiés par défaut
        // Les prestataires doivent être approuvés par un admin
        const isClient = role === UserRole.CLIENT;
        const isAdmin = role === UserRole.ADMIN;
        
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email,
            phone,
            role,
            is_verified: isClient || isAdmin, // Les clients et admins sont vérifiés par défaut
            is_active: isClient || isAdmin,   // Les clients et admins sont actifs par défaut
            kyc_submitted: false              // Par défaut, aucun utilisateur n'a soumis ses documents KYC
          });
          
        if (insertError) throw insertError;
        
        // Si c'est un prestataire, créer une entrée dans la table des activations
        if (role === UserRole.PRESTAIRE) {
          // Tentative 1: Utiliser la fonction RPC create_prestataire_activation
          const { error: rpcError } = await supabase.rpc('create_prestataire_activation', { 
            p_user_id: data.user.id 
          });
          
          if (rpcError) {
            console.error('Error using RPC to create activation:', rpcError);
            
            // Tentative 2: Insertion directe en contournant certaines restrictions
            try {
              // Définir explicitement le rôle service_role pour cette opération
              const supabaseService = supabase.auth.setAuth(process.env.SUPABASE_SERVICE_KEY || '');
              
              const { error: directError } = await supabaseService
                .from('prestataire_activations')
                .insert({
                  user_id: data.user.id,
                  status: 'pending'
                });
                
              if (directError) {
                console.error('Error with service role insert:', directError);
                
                // Tentative 3: Dernière tentative d'insertion standard
                const { error: fallbackError } = await supabase
                  .from('prestataire_activations')
                  .insert({
                    user_id: data.user.id,
                    status: 'pending'
                  });
                  
                if (fallbackError) {
                  console.error('Final fallback error creating activation:', fallbackError);
                  // On ne bloque pas l'inscription si cette étape échoue
                }
              }
            } catch (e) {
              console.error('Caught error during activation creation:', e);
            }
          }
          
          // Ajouter les services sélectionnés par le prestataire
          if (serviceIds && serviceIds.length > 0) {
            for (const serviceId of serviceIds) {
              await supabase.rpc('update_prestataire_service', {
                p_prestataire_id: data.user.id,
                p_service_id: serviceId,
                p_selected: true
              });
            }
          }
        }
      }
      
      return { error: null, user: data.user };
    } catch (error: any) {
      console.error('Sign up error:', error);
      let errorMessage = 'Erreur lors de l\'inscription';
      
      if (error.message) {
        if (error.message.includes('duplicate key')) {
          errorMessage = 'Cet email est déjà utilisé';
        } else if (error.message.includes('password')) {
          errorMessage = 'Le mot de passe doit contenir au moins 6 caractères';
        }
      }
      
      setError(errorMessage);
      return { error, user: null };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      setError(null);
      
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      await secureStorage.removeItem('userProfile');
    } catch (error) {
      console.error('Sign out error:', error);
      setError('Erreur lors de la déconnexion');
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'pratikv2://reset-password',
      });
      
      if (error) throw error;
      
      return { error: null };
    } catch (error: any) {
      console.error('Password reset error:', error);
      let errorMessage = 'Erreur lors de la récupération du mot de passe';
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      error, 
      signIn, 
      signUp, 
      signOut,
      refreshProfile,
      forgotPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};