import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Linking,
  Platform
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Card, Button, Badge } from '../../components/ui';
import supabase from '../../config/supabase';
import { createStripeAccount, generateOnboardingLink } from '../../services/stripe/stripeService';

const StripeConnectScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [stripeAccountInfo, setStripeAccountInfo] = useState<{
    hasAccount: boolean;
    accountId?: string;
    isEnabled?: boolean;
    onboardingComplete?: boolean;
  }>({
    hasAccount: false
  });

  useEffect(() => {
    if (user) {
      checkStripeAccount();
    }
  }, [user]);

  // Vérifier si le prestataire a déjà un compte Stripe Connect
  const checkStripeAccount = async () => {
    try {
      setLoading(true);
      
      if (!user) {
        console.error('Utilisateur non connecté');
        return;
      }
      
      // Appeler la fonction RPC pour vérifier le compte Stripe
      const { data, error } = await supabase.rpc('check_prestataire_stripe_account', {
        prestataire_id: user.id
      });
      
      if (error) {
        console.error('Erreur lors de la vérification du compte Stripe:', error);
        // En cas d'erreur, vérifier directement dans la table users
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('stripe_account_id, stripe_account_enabled')
          .eq('id', user.id)
          .single();
          
        if (userError) {
          console.error('Erreur lors de la récupération des infos utilisateur:', userError);
          // Si on ne peut pas non plus récupérer les infos de l'utilisateur, on suppose qu'il n'a pas de compte
          setStripeAccountInfo({
            hasAccount: false
          });
        } else {
          // Utiliser les données de l'utilisateur pour déterminer s'il a un compte Stripe
          setStripeAccountInfo({
            hasAccount: userData.stripe_account_id ? true : false,
            accountId: userData.stripe_account_id,
            isEnabled: userData.stripe_account_enabled || false,
            onboardingComplete: userData.stripe_account_enabled || false
          });
        }
      } else {
        // Utiliser les données retournées par la fonction RPC
        setStripeAccountInfo({
          hasAccount: data.hasAccount || false,
          accountId: data.accountId,
          isEnabled: data.isEnabled || false,
          onboardingComplete: data.isEnabled || false
        });
      }
    } catch (e) {
      console.error('Erreur inattendue lors de la vérification du compte Stripe:', e);
      Alert.alert('Erreur', 'Impossible de vérifier votre compte Stripe. Veuillez réessayer plus tard.');
    } finally {
      setLoading(false);
    }
  };

  // Créer un nouveau compte Stripe Connect pour le prestataire
  const handleCreateStripeAccount = async () => {
    try {
      setCreatingAccount(true);
      
      if (!user || !user.email) {
        Alert.alert('Erreur', 'Informations utilisateur manquantes');
        return;
      }
      
      const result = await createStripeAccount(
        user.id,
        user.email,
        user.name || user.email.split('@')[0]
      );
      
      console.log('Compte Stripe créé:', result);
      
      // Mettre à jour les informations du compte
      setStripeAccountInfo({
        hasAccount: true,
        accountId: result.accountId,
        isEnabled: false,
        onboardingComplete: false
      });
      
      Alert.alert(
        'Compte créé avec succès',
        'Votre compte de paiement a été créé. Vous devez maintenant compléter la configuration pour recevoir des paiements.',
        [
          {
            text: 'Configurer maintenant',
            onPress: () => handleOpenOnboarding()
          },
          {
            text: 'Plus tard',
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('Erreur lors de la création du compte Stripe:', error);
      Alert.alert('Erreur', 'Impossible de créer votre compte Stripe. Veuillez réessayer plus tard.');
    } finally {
      setCreatingAccount(false);
    }
  };

  // Ouvrir le lien d'onboarding Stripe pour finir la configuration du compte
  const handleOpenOnboarding = async () => {
    try {
      setLoading(true);
      
      if (!stripeAccountInfo.accountId) {
        Alert.alert('Erreur', 'Aucun compte Stripe trouvé');
        return;
      }
      
      // Générer un lien d'onboarding
      const onboardingData = await generateOnboardingLink(stripeAccountInfo.accountId);
      
      if (onboardingData && onboardingData.url) {
        // Ouvrir le lien dans le navigateur
        await Linking.openURL(onboardingData.url);
        
        // Afficher un message indiquant à l'utilisateur de rafraîchir après avoir terminé
        setTimeout(() => {
          Alert.alert(
            'Configuration en cours',
            'Une fois que vous avez terminé la configuration dans le navigateur, revenez dans l\'application et appuyez sur "Rafraîchir" pour mettre à jour votre statut.',
            [
              {
                text: 'Rafraîchir',
                onPress: checkStripeAccount
              }
            ]
          );
        }, 1000);
      } else {
        throw new Error('Lien d\'onboarding non disponible');
      }
    } catch (error) {
      console.error('Erreur lors de l\'ouverture du lien d\'onboarding:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir la page de configuration. Veuillez réessayer plus tard.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text variant="body2" color="text-secondary" style={styles.marginTop}>
          Vérification de votre compte Stripe...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]}>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Carte d'information sur Stripe Connect */}
        <Card style={styles.infoCard} elevation="sm">
          <View style={styles.cardHeader}>
            <Ionicons name="card-outline" size={24} color={COLORS.primary} />
            <Text variant="h5" weight="semibold" style={styles.marginLeft}>
              Recevez vos paiements avec Stripe
            </Text>
          </View>
          
          <View style={styles.separator} />
          
          <Text variant="body2" style={styles.cardText}>
            Connectez votre compte bancaire pour recevoir directement les paiements de vos clients.
            La configuration est simple et sécurisée. Une commission de 10% sera prélevée sur chaque transaction.
          </Text>
          
          <View style={styles.benefitsContainer}>
            <View style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <Text variant="body2" style={styles.marginLeft}>Recevez vos paiements automatiquement</Text>
            </View>
            <View style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <Text variant="body2" style={styles.marginLeft}>Protection contre la fraude incluse</Text>
            </View>
            <View style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <Text variant="body2" style={styles.marginLeft}>Commissions transparentes (10%)</Text>
            </View>
          </View>
        </Card>
        
        {/* Statut du compte Stripe */}
        <Card style={styles.statusCard} elevation="sm">
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle-outline" size={24} color={COLORS.primary} />
            <Text variant="h5" weight="semibold" style={styles.marginLeft}>
              Statut de votre compte
            </Text>
          </View>
          
          <View style={styles.separator} />
          
          <View style={styles.statusContainer}>
            <View style={styles.statusInfo}>
              <Text variant="body2" color="text-secondary">Compte Stripe</Text>
              <Badge 
                variant={stripeAccountInfo.hasAccount ? 'success' : 'warning'} 
                label={stripeAccountInfo.hasAccount ? 'Créé' : 'Non créé'} 
                border 
                size="sm" 
              />
            </View>
            
            {stripeAccountInfo.hasAccount && (
              <>
                <View style={styles.statusInfo}>
                  <Text variant="body2" color="text-secondary">Configuration</Text>
                  <Badge 
                    variant={stripeAccountInfo.onboardingComplete ? 'success' : 'warning'} 
                    label={stripeAccountInfo.onboardingComplete ? 'Complète' : 'Incomplète'} 
                    border 
                    size="sm" 
                  />
                </View>
                
                <View style={styles.statusInfo}>
                  <Text variant="body2" color="text-secondary">Paiements activés</Text>
                  <Badge 
                    variant={stripeAccountInfo.isEnabled ? 'success' : 'warning'} 
                    label={stripeAccountInfo.isEnabled ? 'Activés' : 'Désactivés'} 
                    border 
                    size="sm" 
                  />
                </View>
              </>
            )}
          </View>
        </Card>
        
        {/* Actions */}
        <Card style={styles.actionsCard} elevation="sm">
          <View style={styles.cardHeader}>
            <Ionicons name="cog-outline" size={24} color={COLORS.primary} />
            <Text variant="h5" weight="semibold" style={styles.marginLeft}>
              Actions
            </Text>
          </View>
          
          <View style={styles.separator} />
          
          {!stripeAccountInfo.hasAccount ? (
            <>
              <Text variant="body2" style={styles.cardText}>
                Créez votre compte Stripe pour commencer à recevoir des paiements directement sur votre compte bancaire.
              </Text>
              <Button
                variant="primary"
                label="Créer mon compte Stripe"
                icon={<Ionicons name="add-circle-outline" size={20} color={COLORS.white} />}
                onPress={handleCreateStripeAccount}
                loading={creatingAccount}
                style={styles.actionButton}
              />
            </>
          ) : !stripeAccountInfo.onboardingComplete ? (
            <>
              <Text variant="body2" style={styles.cardText}>
                Vous avez déjà créé un compte Stripe, mais vous devez terminer la configuration pour recevoir des paiements.
              </Text>
              <Button
                variant="primary"
                label="Compléter la configuration"
                icon={<Ionicons name="arrow-forward-circle-outline" size={20} color={COLORS.white} />}
                onPress={handleOpenOnboarding}
                loading={loading}
                style={styles.actionButton}
              />
            </>
          ) : (
            <>
              <Text variant="body2" style={styles.successMessage}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} /> Votre compte Stripe est configuré et prêt à recevoir des paiements.
              </Text>
              
              <Button
                variant="outline"
                label="Voir mes détails de paiement"
                icon={<Ionicons name="card-outline" size={20} color={COLORS.primary} />}
                onPress={() => Alert.alert('Information', 'Cette fonctionnalité sera disponible dans une prochaine mise à jour.')}
                style={styles.outlineButton}
              />
            </>
          )}
          
          <Button
            variant="text"
            label="Rafraîchir le statut"
            onPress={checkStripeAccount}
            style={styles.refreshButton}
          />
        </Card>
        
        {/* Informations de commission */}
        <Card style={[styles.commissionCard, styles.marginBottom]} elevation="sm">
          <View style={styles.cardHeader}>
            <Ionicons name="cash-outline" size={24} color={COLORS.primary} />
            <Text variant="h5" weight="semibold" style={styles.marginLeft}>
              Commissions et frais
            </Text>
          </View>
          
          <View style={styles.separator} />
          
          <Text variant="body2" style={styles.cardText}>
            Pour chaque transaction, une commission de 10% est prélevée pour couvrir les frais de service et de plateforme.
          </Text>
          
          <View style={styles.feeExample}>
            <Text variant="body2" weight="medium" style={styles.exampleTitle}>Exemple:</Text>
            <View style={styles.exampleRow}>
              <Text variant="body2">Pour une prestation de</Text>
              <Text variant="body2" weight="semibold" color="success">100€</Text>
            </View>
            <View style={styles.exampleRow}>
              <Text variant="body2">Vous recevez</Text>
              <Text variant="body2" weight="semibold" color="success">90€</Text>
            </View>
            <View style={styles.exampleRow}>
              <Text variant="body2">Commission plateforme</Text>
              <Text variant="body2" weight="semibold" color="warning">10€</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  infoCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    backgroundColor: COLORS.white,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    backgroundColor: COLORS.white,
  },
  statusContainer: {
    marginTop: SPACING.xs,
  },
  statusInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  actionsCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    backgroundColor: COLORS.white,
  },
  actionButton: {
    marginTop: SPACING.md,
  },
  outlineButton: {
    marginTop: SPACING.md,
    borderColor: COLORS.primary,
    borderWidth: 1.5,
  },
  refreshButton: {
    marginTop: SPACING.sm,
    alignSelf: 'center',
  },
  commissionCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    backgroundColor: COLORS.white,
  },
  cardText: {
    marginBottom: SPACING.sm,
    lineHeight: 22,
  },
  benefitsContainer: {
    marginTop: SPACING.sm,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  feeExample: {
    backgroundColor: `${COLORS.primary}10`,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.xs,
  },
  exampleTitle: {
    marginBottom: SPACING.xs,
  },
  exampleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  successMessage: {
    color: COLORS.success,
    fontWeight: '500',
    marginVertical: SPACING.sm,
  },
  marginLeft: {
    marginLeft: SPACING.sm,
  },
  marginTop: {
    marginTop: SPACING.md,
  },
  marginBottom: {
    marginBottom: SPACING.xl,
  },
});

export default StripeConnectScreen;