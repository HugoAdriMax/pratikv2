import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { getClientRequests } from '../../services/api';
import { Request, RequestStatus } from '../../types';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Card, Badge, Button } from '../../components/ui';

/**
 * Écran des demandes de service pour un client utilisant le design system
 * Version hybride qui combine StyleSheet et composants du design system
 */
const RequestsScreen = ({ navigation }: any) => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [activeRequests, setActiveRequests] = useState<Request[]>([]);
  const [cancelledRequests, setCancelledRequests] = useState<Request[]>([]);
  const [showCancelled, setShowCancelled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const fetchRequests = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const data = await getClientRequests(user.id);
      
      // Séparer les demandes actives et annulées
      const active = data.filter(req => req.status !== RequestStatus.CANCELLED);
      const cancelled = data.filter(req => req.status === RequestStatus.CANCELLED);
      
      setRequests(data);
      setActiveRequests(active);
      setCancelledRequests(cancelled);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchRequests();
    
    // Refresh on screen focus
    const unsubscribe = navigation.addListener('focus', () => {
      fetchRequests();
    });

    // Set up periodic refresh to check for new offers
    const refreshInterval = setInterval(() => {
      fetchRequests();
      console.log('Rafraîchissement automatique des demandes...');
    }, 10000); // Check every 10 seconds

    return () => {
      unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [navigation, user]);

  const getStatusBadgeProps = (request: Request) => {
    // Si la demande a un statut prestataire, on l'affiche prioritairement
    if (request.prestataire_status) {
      switch (request.prestataire_status) {
        case 'en_route':
          return { variant: 'info', label: 'Prestataire en route' };
        case 'arrived':
          return { variant: 'primary', label: 'Prestataire arrivé' };
        case 'in_progress':
          return { variant: 'warning', label: 'Travail en cours' };
        case 'completed':
          return { variant: 'success', label: 'Travail terminé' };
      }
    }
    
    // Sinon, on utilise le statut de la demande
    switch (request.status) {
      case RequestStatus.PENDING:
        return { variant: 'warning', label: 'En attente' };
      case RequestStatus.OFFERED:
        return { variant: 'info', label: 'Offres reçues' };
      case RequestStatus.ACCEPTED:
        return { variant: 'primary', label: 'En cours' };
      case RequestStatus.COMPLETED:
        return { variant: 'success', label: 'Terminé' };
      case RequestStatus.CANCELLED:
        return { variant: 'danger', label: 'Annulé' };
      default:
        return { variant: 'secondary', label: 'Inconnu' };
    }
  };

  const getServiceIcon = (serviceId: string) => {
    // Convert serviceId to a readable service name
    const serviceName = serviceId.split('-')[0].toLowerCase();
    
    // Match appropriate icon based on service type
    if (serviceName.includes('plomb')) return 'water';
    if (serviceName.includes('electr')) return 'flash';
    if (serviceName.includes('menuis')) return 'construct';
    if (serviceName.includes('peinture')) return 'color-palette';
    if (serviceName.includes('jardin')) return 'leaf';
    if (serviceName.includes('nettoy')) return 'sparkles';
    
    // Default icon
    return 'build';
  };

  const renderItem = ({ item }: { item: Request }) => {
    // Format date
    const date = new Date(item.created_at);
    const formattedDate = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
    
    const badgeProps = getStatusBadgeProps(item);
    const serviceIcon = getServiceIcon(item.service_id);
    const hasOffers = item.status === RequestStatus.OFFERED;
    const isCompleted = item.status === RequestStatus.COMPLETED || item.prestataire_status === 'completed';
    const isInProgress = item.prestataire_status === 'in_progress' || item.prestataire_status === 'arrived' || item.prestataire_status === 'en_route';
    
    // Style simple et efficace
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate('RequestDetail', { requestId: item.id })}
      >
        <Card 
          style={[
            styles.requestCard,
            hasOffers && styles.offersCard,
            isInProgress && styles.inProgressCard,
            isCompleted && styles.completedCard
          ]}
          elevation="sm"
        >
          <View style={styles.cardHeader}>
            {/* Icône et nom du service */}
            <View style={styles.serviceSection}>
              <View style={[
                styles.iconContainer,
                hasOffers && styles.offersIcon,
                isInProgress && styles.inProgressIcon,
                isCompleted && styles.completedIcon
              ]}>
                <Ionicons 
                  name={serviceIcon as any} 
                  size={20} 
                  color="#FFFFFF" 
                />
              </View>
              <Text variant="subtitle1" weight="bold" style={styles.serviceTitle}>
                {item.services?.name || item.service_id.replace(/-/g, ' ').split(' ')[0]}
              </Text>
            </View>
            
            {/* Badge de statut */}
            <Badge
              variant={badgeProps.variant as any}
              label={badgeProps.label}
              size="sm"
              border
            />
          </View>
          
          {/* Indicateur spécial pour offres disponibles */}
          {hasOffers && (
            <View style={styles.offersIndicator}>
              <Ionicons name="people" size={14} color={COLORS.info} />
              <Text variant="caption" weight="medium" color="info" style={styles.indicatorText}>
                Des prestataires ont répondu à votre demande
              </Text>
            </View>
          )}
          
          {/* Indicateur de progression pour travaux en cours */}
          {isInProgress && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { 
                      width: item.prestataire_status === 'en_route' ? '30%' : 
                             item.prestataire_status === 'arrived' ? '60%' : '85%'
                    }
                  ]} 
                />
              </View>
              <Text variant="caption" color="text-secondary" style={styles.progressLabel}>
                {item.prestataire_status === 'en_route' ? 'Prestataire en route' : 
                 item.prestataire_status === 'arrived' ? 'Prestataire arrivé' : 'Travail en cours'}
              </Text>
            </View>
          )}
          
          {/* Rappel d'évaluation pour travaux terminés - uniquement si pas encore évalué */}
          {isCompleted && !item.is_reviewed && (
            <View style={styles.reviewReminder}>
              <Ionicons name="star-outline" size={14} color={COLORS.success} />
              <Text variant="caption" weight="medium" color="success" style={styles.indicatorText}>
                N'oubliez pas d'évaluer cette prestation
              </Text>
            </View>
          )}
          
          {/* Adresse */}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
            <Text variant="caption" color="text-secondary" style={styles.locationText} numberOfLines={1}>
              {item.location.address}
            </Text>
          </View>
          
          {/* Pied de carte avec date et bouton/indicateur selon le statut */}
          <View style={styles.cardFooter}>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={12} color={COLORS.textSecondary} />
              <Text variant="caption" color="text-secondary" style={{marginLeft: 4}}>
                {formattedDate}
              </Text>
            </View>
            
            {hasOffers && (
              <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
                <Text variant="caption" weight="semibold" color="info">
                  Voir les offres
                </Text>
                <Ionicons name="chevron-forward" size={12} color={COLORS.info} style={{marginLeft: 2}} />
              </TouchableOpacity>
            )}
            
            {isInProgress && (
              <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
                <Text variant="caption" weight="semibold" color="primary">
                  {item.prestataire_status === 'en_route' ? 'Suivre' : 'Voir détails'}
                </Text>
                <Ionicons 
                  name={item.prestataire_status === 'en_route' ? 'map-outline' : 'eye-outline'} 
                  size={12} 
                  color={COLORS.primary} 
                  style={{marginLeft: 2}} 
                />
              </TouchableOpacity>
            )}
            
            {isCompleted && !item.is_reviewed && (
              <TouchableOpacity 
                style={styles.actionButton} 
                activeOpacity={0.8} 
                onPress={() => navigation.navigate('ReviewScreen', { jobId: item.id })}
              >
                <Text variant="caption" weight="semibold" color="success">
                  Évaluer
                </Text>
                <Ionicons name="star-outline" size={12} color={COLORS.success} style={{marginLeft: 2}} />
              </TouchableOpacity>
            )}
            
            {(isCompleted && item.is_reviewed) || (!hasOffers && !isInProgress && !isCompleted) && (
              <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
                <Text variant="caption" weight="semibold" color="text-secondary">
                  Détails
                </Text>
                <Ionicons name="chevron-forward" size={12} color={COLORS.textSecondary} style={{marginLeft: 2}} />
              </TouchableOpacity>
            )}
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text variant="h3" weight="semibold">Mes demandes</Text>
        
        {cancelledRequests.length > 0 && (
          <TouchableOpacity 
            style={styles.toggleButton} 
            onPress={() => setShowCancelled(!showCancelled)}
          >
            <Text variant="caption" color={showCancelled ? "primary" : "text-secondary"}>
              {showCancelled ? "Masquer les annulées" : `Afficher les annulées (${cancelledRequests.length})`}
            </Text>
            <Ionicons 
              name={showCancelled ? "chevron-up-outline" : "chevron-down-outline"} 
              size={16} 
              color={showCancelled ? COLORS.primary : COLORS.textSecondary} 
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        )}
      </View>
      
      {activeRequests.length === 0 && !showCancelled ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="document-text-outline" size={60} color={COLORS.textSecondary} />
          </View>
          <Text variant="body1" color="text-secondary" style={styles.emptyText}>
            Vous n'avez pas encore de demandes
          </Text>
          <Button
            variant="primary"
            label="Nouvelle demande"
            onPress={() => navigation.navigate('Chatbot')}
            style={styles.newRequestButton}
          />
        </View>
      ) : (
        <>
          {/* Demandes actives */}
          <FlatList
            data={showCancelled ? cancelledRequests : activeRequests}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={showCancelled ? (
              <View style={styles.sectionHeader}>
                <Text variant="h5" weight="semibold" color="danger">Demandes annulées</Text>
                <Text variant="body2" color="text-secondary" style={styles.sectionSubtitle}>
                  Ces demandes ont été annulées et ne sont plus visibles par les prestataires
                </Text>
              </View>
            ) : undefined}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={handleRefresh} 
                colors={[COLORS.primary]}
                tintColor={COLORS.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyListContainer}>
                <Text variant="body2" color="text-secondary">
                  {showCancelled 
                    ? "Aucune demande annulée"
                    : "Aucune demande active"
                  }
                </Text>
              </View>
            }
          />
        </>
      )}
      
      <TouchableOpacity
        style={[
          styles.fab, 
          { bottom: 20 + (insets.bottom > 0 ? insets.bottom - 10 : 0) }
        ]}
        onPress={() => navigation.navigate('Chatbot')}
        activeOpacity={0.9}
      >
        <Ionicons name="add" size={24} color={COLORS.white} />
      </TouchableOpacity>
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
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    backgroundColor: `${COLORS.backgroundDark}50`,
    borderRadius: BORDER_RADIUS.md,
  },
  sectionHeader: {
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
    backgroundColor: `${COLORS.danger}08`,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  sectionSubtitle: {
    marginTop: SPACING.xs,
  },
  emptyListContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  listContainer: {
    padding: SPACING.md,
    paddingTop: SPACING.xs,
  },
  
  // Styles pour l'interface de la liste vide
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  emptyIconContainer: {
    backgroundColor: `${COLORS.textSecondary}15`,
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyText: {
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  newRequestButton: {
    paddingHorizontal: SPACING.lg,
  },
  
  // Bouton flottant d'ajout
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: COLORS.primary,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  
  // Styles des cartes de demande
  requestCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
  },
  offersCard: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.info,
  },
  inProgressCard: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  completedCard: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
  },
  
  // En-tête de carte
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  serviceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serviceTitle: {
    marginLeft: SPACING.xs,
    fontSize: 14,
    textTransform: 'capitalize',
    flex: 1,
  },
  
  // Conteneur d'icône
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  offersIcon: {
    backgroundColor: COLORS.info,
  },
  inProgressIcon: {
    backgroundColor: COLORS.warning,
  },
  completedIcon: {
    backgroundColor: COLORS.success,
  },
  
  // Indicateurs d'état spécifiques
  offersIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.info}15`,
    padding: 6,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.xs,
  },
  reviewReminder: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.success}15`,
    padding: 6,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.xs,
  },
  indicatorText: {
    marginLeft: 4,
  },
  
  // Barre de progression pour travaux en cours
  progressContainer: {
    marginBottom: SPACING.xs,
  },
  progressBar: {
    height: 4,
    backgroundColor: `${COLORS.backgroundDark}30`,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 3,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.warning,
    borderRadius: 2,
  },
  progressLabel: {
    textAlign: 'right',
    fontSize: 10,
  },
  
  // Ligne d'adresse
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  locationText: {
    marginLeft: 4,
    flex: 1,
  },
  
  // Pied de carte
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: `${COLORS.border}50`,
    paddingTop: SPACING.xs,
    marginTop: SPACING.xs,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.backgroundDark}15`,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
});

export default RequestsScreen;