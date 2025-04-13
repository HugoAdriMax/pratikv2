import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  SafeAreaView
} from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../../utils/theme';
import { Text, Card, Button } from '../../components/ui';
import supabase from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';

const ActivationPendingScreen = () => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activationStatus, setActivationStatus] = useState<'pending' | 'rejected' | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const { user, signOut, refreshProfile } = useAuth();

  // Vérifier le statut de l'activation avec une meilleure gestion des erreurs
  const checkActivationStatus = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Vérifier d'abord si l'utilisateur est déjà activé via refreshProfile
      // Cela permet de s'assurer que nous avons les informations les plus récentes
      await refreshProfile();
      
      // Si l'utilisateur est actif après le rafraîchissement du profil, on peut sortir immédiatement
      if (user.is_active) {
        console.log('User is now active, redirecting to main interface');
        return;
      }
      
      // Vérifier si l'utilisateur a une demande d'activation
      const { data, error } = await supabase
        .from('prestataire_activations')
        .select('status, notes')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('Error fetching activation status:', error);
        setActivationStatus('pending');
        return;
      }
      
      // Mettre à jour le statut
      if (data && data.length > 0) {
        setActivationStatus(data[0].status as 'pending' | 'rejected');
        setNotes(data[0].notes);
        
        console.log(`Found activation with status: ${data[0].status}`);
        
        // Si le statut est "approved" mais que l'utilisateur n'est pas actif,
        // essayer de mettre à jour son profil
        if (data[0].status === 'approved' && !user.is_active) {
          console.log('Activation is approved but user is not active, refreshing profile again');
          await refreshProfile();
        }
      } else {
        // Si aucune demande n'existe, on considère que c'est en attente
        console.log('No activation request found, setting status to pending');
        setActivationStatus('pending');
        
        // Important: NE PAS essayer de créer une entrée ici pour éviter les erreurs RLS
        // Les admins doivent créer manuellement l'entrée d'activation
        console.log('Admin will need to create activation entry manually');
      }
      
    } catch (error) {
      console.error('Error checking activation status:', error);
      setActivationStatus('pending');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await checkActivationStatus();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Déconnexion', 
          style: 'destructive',
          onPress: () => signOut()
        }
      ]
    );
  };

  // Vérifier le statut au chargement de l'écran
  useEffect(() => {
    checkActivationStatus();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          <Image
            source={{ uri: 'https://i.imgur.com/dIQNopI.png' }}
            style={styles.logo}
            resizeMode="contain"
          />
          
          {loading && !refreshing ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
          ) : (
            <>
              <View style={styles.iconContainer}>
                <Image
                  source={{ uri: 'https://i.imgur.com/VhfSTEy.png' }} 
                  style={styles.waitingIcon}
                  resizeMode="contain"
                />
              </View>
              
              <Text variant="h2" weight="semibold" color="primary" align="center" style={styles.titleSpacing}>
                {activationStatus === 'rejected' 
                  ? 'Compte non approuvé'
                  : 'Compte en attente d\'activation'}
              </Text>
              
              <Text variant="body1" color="text" align="center" style={styles.messageSpacing}>
                {activationStatus === 'rejected' 
                  ? 'Votre demande d\'activation de compte prestataire a été refusée.'
                  : 'Votre compte prestataire est en cours d\'examen par notre équipe administrative. Nous vérifions vos informations pour garantir la qualité de notre service.'}
              </Text>
              
              {activationStatus === 'rejected' && notes && (
                <Card style={styles.notesContainer} elevation="sm">
                  <Text variant="h4" weight="semibold" color="danger" style={styles.notesTitle}>
                    Raison du refus :
                  </Text>
                  <Text variant="body2" color="text">
                    {notes}
                  </Text>
                </Card>
              )}
              
              <Text variant="body2" color="text-secondary" align="center" style={styles.infoText}>
                {activationStatus === 'rejected'
                  ? 'Vous pouvez contacter notre support pour plus d\'informations ou vous inscrire à nouveau.'
                  : 'Ce processus peut prendre jusqu\'à 48 heures ouvrables. Vous recevrez une notification dès que votre compte sera activé.'}
              </Text>
              
              <Text 
                variant="body2" 
                color="text-secondary" 
                align="center" 
                style={[styles.instructionText, { fontStyle: 'italic' }]}
              >
                Tirez vers le bas pour actualiser et vérifier le statut de votre compte.
              </Text>
              
              <Button
                label="Se déconnecter"
                onPress={handleLogout}
                variant="outline"
                style={styles.logoutButton}
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    flexGrow: 1,
    padding: SIZES.padding,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.padding * 2,
  },
  logo: {
    width: 150,
    height: 75,
    marginBottom: SIZES.padding * 2,
  },
  loader: {
    marginVertical: SIZES.padding * 2,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.light,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.padding,
    ...SHADOWS.medium,
    overflow: 'hidden', // Pour s'assurer que l'image ne déborde pas du cercle
  },
  waitingIcon: {
    width: 100,
    height: 100,
  },
  titleSpacing: {
    marginBottom: SIZES.padding,
  },
  messageSpacing: {
    marginBottom: SIZES.padding,
    paddingHorizontal: SIZES.padding,
  },
  notesContainer: {
    backgroundColor: COLORS.lightRed,
    marginVertical: SIZES.padding,
    width: '100%',
  },
  notesTitle: {
    marginBottom: SIZES.base,
  },
  infoText: {
    marginBottom: SIZES.padding * 2,
    paddingHorizontal: SIZES.padding,
  },
  instructionText: {
    marginBottom: SIZES.padding * 2,
  },
  logoutButton: {
    width: '80%',
    marginTop: SIZES.padding,
  },
});

export default ActivationPendingScreen;