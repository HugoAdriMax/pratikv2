import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Card, Button, Avatar, Badge } from '../../components/ui';
import supabase from '../../config/supabase';
import { getSelectedServices, Service } from '../../services/prestataire-services';

const PrestataireProfileScreen = ({ navigation }: any) => {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [earnings, setEarnings] = useState({
    totalEarnings: 0,
    pendingPayments: 0,
    completedJobs: 0,
  });
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (user) {
      // Démonstration - normalement, cette fonction devrait récupérer les données réelles
      fetchStatistics();
      
      // Charger les services sélectionnés par le prestataire
      const loadServices = async () => {
        try {
          const services = await getSelectedServices(user.id);
          setSelectedServices(services);
          console.log('Services chargés:', services.length);
        } catch (error) {
          console.error('Erreur lors du chargement des services:', error);
        }
      };
      
      loadServices();
    }
  }, [user]);

  const fetchStatistics = async () => {
    // En situation réelle, vous feriez une requête à Supabase ici
    // Par exemple:
    // const { data, error } = await supabase
    //   .from('jobs')
    //   .select('*')
    //   .eq('prestataire_id', user.id)
    //   .eq('is_completed', true);
    
    // Pour cette démonstration, nous utilisons des données fictives
    setEarnings({
      totalEarnings: 1250.50,
      pendingPayments: 320.00,
      completedJobs: 8,
    });
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la déconnexion');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text variant="body2" color="text-secondary" style={styles.marginTop}>
          Chargement du profil...
        </Text>
      </View>
    );
  }

  const userInitials = user.email ? user.email.charAt(0).toUpperCase() : "?";
  const displayName = user.name || user.email || "Prestataire";

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text variant="h3" weight="semibold">Profil Prestataire</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Card style={styles.profileCard} elevation="sm">
          <View style={styles.profileHeader}>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Photo de profil',
                  'Ajouter une photo de profil ?',
                  [
                    {
                      text: 'Annuler',
                      style: 'cancel'
                    },
                    {
                      text: 'Prendre une photo',
                      onPress: () => {
                        Alert.alert('Information', 'Cette fonctionnalité sera disponible dans la prochaine mise à jour.');
                      }
                    },
                    {
                      text: 'Choisir une photo',
                      onPress: () => {
                        Alert.alert('Information', 'Cette fonctionnalité sera disponible dans la prochaine mise à jour.');
                      }
                    }
                  ]
                );
              }}
            >
              <View style={styles.avatarContainer}>
                <Avatar 
                  size="xl"
                  initials={userInitials}
                  backgroundColor={COLORS.primary}
                />
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="camera" size={14} color={COLORS.white} />
                </View>
              </View>
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text variant="h4" weight="semibold">{displayName}</Text>
              <View style={styles.badgeContainer}>
                <Badge
                  variant="secondary"
                  label="Prestataire"
                  leftIcon={<Ionicons name="briefcase" size={14} color={COLORS.secondary} />}
                  border
                />
                
                {selectedServices.length > 0 ? (
                  // Afficher les badges des services sélectionnés
                  <>
                    {selectedServices.slice(0, 2).map((service) => (
                      <Badge
                        key={service.id}
                        variant="success"
                        label={service.name}
                        leftIcon={<Ionicons name="checkmark-circle" size={12} color={COLORS.success} />}
                        style={{
                          backgroundColor: `${COLORS.success}15`,
                          borderColor: COLORS.success,
                          borderWidth: 1,
                        }}
                      />
                    ))}
                    {selectedServices.length > 2 && (
                      <Badge
                        variant="primary"
                        label={`+${selectedServices.length - 2}`}
                        style={{
                          backgroundColor: COLORS.primary
                        }}
                      />
                    )}
                  </>
                ) : (
                  // Afficher le badge "Aucun service" si aucun service n'est sélectionné
                  <Badge
                    variant="warning"
                    label="Aucun service"
                    leftIcon={<Ionicons name="alert-circle" size={14} color={COLORS.warning} />}
                    style={{
                      backgroundColor: `${COLORS.warning}15`,
                      borderColor: COLORS.warning,
                      borderWidth: 1
                    }}
                  />
                )}
              </View>
            </View>
          </View>

          <View style={styles.separator} />

          <View>
            <TouchableOpacity 
              style={styles.profileAction} 
              activeOpacity={0.7}
              onPress={() => {
                Alert.alert(
                  'Fonctionnalité à venir',
                  'La modification du profil incluant l\'ajout d\'une photo sera disponible dans la prochaine mise à jour.'
                );
              }}
            >
              <Ionicons name="create-outline" size={22} color={COLORS.primary} />
              <Text variant="body2" weight="medium" style={styles.marginLeft}>
                Modifier mon profil
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.profileAction} 
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ServiceSelection')}
            >
              <Ionicons name="list-outline" size={22} color={COLORS.primary} />
              <Text variant="body2" weight="medium" style={styles.marginLeft}>
                Gérer mes services proposés
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.profileAction} 
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Reviews')}
            >
              <Ionicons name="star-outline" size={22} color={COLORS.primary} />
              <Text variant="body2" weight="medium" style={styles.marginLeft}>
                Mes évaluations
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.profileAction} 
              activeOpacity={0.7}
              onPress={() => navigation.navigate('StripeConnect')}
            >
              <Ionicons name="card-outline" size={22} color={COLORS.primary} />
              <Text variant="body2" weight="medium" style={styles.marginLeft}>
                Configurer mes paiements
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Nouvelles statistiques pour prestataires */}
        <Card style={styles.sectionCard} elevation="sm">
          <View style={styles.sectionHeader}>
            <Ionicons name="analytics-outline" size={22} color={COLORS.primary} />
            <Text variant="h5" weight="semibold" style={styles.marginLeft}>
              Mes statistiques
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text variant="h3" weight="bold" color="primary">{earnings.totalEarnings.toFixed(2)}€</Text>
              <Text variant="caption" color="text-secondary">Gains totaux</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text variant="h3" weight="bold" color="warning">{earnings.pendingPayments.toFixed(2)}€</Text>
              <Text variant="caption" color="text-secondary">En attente</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text variant="h3" weight="bold" color="success">{earnings.completedJobs}</Text>
              <Text variant="caption" color="text-secondary">Jobs terminés</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.statsButton}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Information', 'Détails des statistiques disponibles dans la prochaine mise à jour.')}
          >
            <Text variant="button" weight="medium" color="primary">Voir tous les détails</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.primary} style={styles.marginLeft} />
          </TouchableOpacity>
        </Card>

        <Card style={styles.sectionCard} elevation="sm">
          <View style={styles.sectionHeader}>
            <Ionicons name="person-circle-outline" size={22} color={COLORS.primary} />
            <Text variant="h5" weight="semibold" style={styles.marginLeft}>
              Informations personnelles
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoItem}>
            <Text variant="body2" color="text-secondary">Email</Text>
            <Text variant="body2" weight="medium">{user.email}</Text>
          </View>

          {user.phone && (
            <View style={styles.infoItem}>
              <Text variant="body2" color="text-secondary">Téléphone</Text>
              <Text variant="body2" weight="medium">{user.phone}</Text>
            </View>
          )}

          <View style={styles.infoItem}>
            <Text variant="body2" color="text-secondary">Compte vérifié</Text>
            <Badge 
              variant={user.is_verified ? 'success' : 'warning'}
              label={user.is_verified ? 'Vérifié' : 'Non vérifié'}
              size="sm"
              border
            />
          </View>
        </Card>

        <Card style={styles.sectionCard} elevation="sm">
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={22} color={COLORS.primary} />
            <Text variant="h5" weight="semibold" style={styles.marginLeft}>
              Documents
            </Text>
          </View>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.documentItem} activeOpacity={0.7}>
            <View style={styles.documentIconContainer}>
              <Ionicons name="card-outline" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.documentInfo}>
              <Text variant="body2" weight="medium">Pièce d'identité</Text>
              <Text variant="caption" color="text-secondary">Ajouter ou mettre à jour</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.documentItem} activeOpacity={0.7}>
            <View style={styles.documentIconContainer}>
              <Ionicons name="home-outline" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.documentInfo}>
              <Text variant="body2" weight="medium">Justificatif de domicile</Text>
              <Text variant="caption" color="text-secondary">Ajouter ou mettre à jour</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.documentItem} activeOpacity={0.7}>
            <View style={styles.documentIconContainer}>
              <Ionicons name="briefcase-outline" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.documentInfo}>
              <Text variant="body2" weight="medium">Attestation professionnelle</Text>
              <Text variant="caption" color="text-secondary">Ajouter ou mettre à jour</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </Card>

        <View style={[styles.actionsContainer, { marginBottom: insets.bottom > 0 ? 0 : 20 }]}>
          <Button
            variant="outline"
            label="Se déconnecter"
            icon={<Ionicons name="log-out-outline" size={20} color={COLORS.primary} />}
            onPress={handleSignOut}
            loading={loading}
            style={styles.signOutButton}
          />
        </View>
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
  avatarContainer: {
    position: 'relative',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
    ...SHADOWS.small,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  profileCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  profileAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  sectionCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.xs,
    marginHorizontal: 2,
  },
  statsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  documentIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.round,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}15`,
    marginRight: SPACING.sm,
  },
  documentInfo: {
    flex: 1,
  },
  actionsContainer: {
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  signOutButton: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
  },
  marginLeft: {
    marginLeft: SPACING.sm,
  },
  marginTop: {
    marginTop: SPACING.md,
  },
  marginTopXs: {
    marginTop: SPACING.xs,
  },
  badgeContainer: {
    flexDirection: 'row',
    marginTop: SPACING.xs,
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6, // Espacement uniforme entre les badges
  },
});

export default PrestataireProfileScreen;