import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  SafeAreaView
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Request, RequestStatus } from '../../types';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Badge, Card } from '../../components/ui';
import { getNearbyRequests, getServiceById } from '../../services/api';

const RequestListScreen = ({ navigation }: any) => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Request[]>([]);
  const [offeredRequests, setOfferedRequests] = useState<Request[]>([]);
  const [showOffered, setShowOffered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const fetchNearbyRequests = async () => {
    if (!user) {
      setError("Aucun utilisateur connecté");
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Récupérer les demandes à proximité depuis Supabase
      const requestsData = await getNearbyRequests(user.id);
      
      if (requestsData && requestsData.length > 0) {
        console.log(`Nombre total de demandes récupérées: ${requestsData.length}`);
        
        // Séparer les demandes en attente et celles avec offre
        const pending = requestsData.filter(req => req.status === RequestStatus.PENDING);
        const offered = requestsData.filter(req => req.status === RequestStatus.OFFERED);
        
        setRequests(requestsData);
        setPendingRequests(pending);
        setOfferedRequests(offered);
      } else {
        console.log('Aucune demande trouvée');
        setRequests([]);
        setPendingRequests([]);
        setOfferedRequests([]);
      }
    } catch (error) {
      console.error('Error fetching nearby requests:', error);
      setError("Impossible de récupérer les demandes. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNearbyRequests();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchNearbyRequests();
    
    // Rafraîchir lors du focus sur l'écran
    const unsubscribe = navigation.addListener('focus', () => {
      fetchNearbyRequests();
    });
    
    // Rafraîchissement périodique pour les nouvelles demandes
    const refreshInterval = setInterval(() => {
      fetchNearbyRequests();
      console.log('Rafraîchissement automatique des demandes...');
    }, 15000); // Toutes les 15 secondes

    return () => {
      unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [navigation, user]);

  const getStatusBadgeProps = (status: string) => {
    switch (status) {
      case RequestStatus.PENDING:
        return { variant: 'warning', label: 'En attente' };
      case RequestStatus.OFFERED:
        return { variant: 'info', label: 'Offre envoyée' };
      case RequestStatus.ACCEPTED:
        return { variant: 'primary', label: 'Acceptée' };
      case RequestStatus.COMPLETED:
        return { variant: 'success', label: 'Terminée' };
      case RequestStatus.CANCELLED:
        return { variant: 'danger', label: 'Annulée' };
      default:
        return { variant: 'secondary', label: 'Inconnu' };
    }
  };

  const getServiceIcon = (serviceId: string) => {
    // Extraire le nom du service à partir de l'ID
    const serviceName = serviceId.split('-')[0].toLowerCase();
    
    // Associer les icônes appropriées basées sur le type de service
    if (serviceName.includes('plomb')) return 'water';
    if (serviceName.includes('electr')) return 'flash';
    if (serviceName.includes('menuis')) return 'construct';
    if (serviceName.includes('peinture')) return 'color-palette';
    if (serviceName.includes('jardin')) return 'leaf';
    if (serviceName.includes('nettoy')) return 'sparkles';
    if (serviceName.includes('clim')) return 'thermometer';
    if (serviceName.includes('serr')) return 'key';
    if (serviceName.includes('demenag')) return 'cube';
    if (serviceName.includes('informa')) return 'laptop';
    
    // Icône par défaut
    return 'build';
  };

  const renderItem = ({ item }: { item: Request }) => {
    // Formatage de la date
    const date = new Date(item.created_at);
    const formattedDate = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
    
    // Récupérer le nom du service
    const serviceName = item.services?.name || 
                        item.service_id.replace(/-/g, ' ').split(' ')[0].charAt(0).toUpperCase() + 
                        item.service_id.replace(/-/g, ' ').split(' ')[0].slice(1);
    
    // Calculer la distance (simulée pour l'instant)
    const distance = Math.floor(Math.random() * 5) + 1; // 1-5 km
    
    const statusBadgeProps = getStatusBadgeProps(item.status);
    const serviceIcon = getServiceIcon(item.service_id);
    const hasOffered = item.status === RequestStatus.OFFERED;
    
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate('RequestDetail', { requestId: item.id })}
      >
        <Card 
          style={[
            styles.requestCard,
            hasOffered && styles.offeredCard
          ]}
          elevation="sm"
        >
          <View style={styles.cardHeader}>
            {/* Icône et nom du service */}
            <View style={styles.serviceSection}>
              <View style={[
                styles.iconContainer,
                hasOffered && styles.offeredIcon
              ]}>
                <Ionicons 
                  name={serviceIcon as any} 
                  size={20} 
                  color="#FFFFFF" 
                />
              </View>
              <Text variant="subtitle1" weight="bold" style={styles.serviceTitle}>
                {serviceName}
              </Text>
            </View>
            
            {/* Badge de statut */}
            <Badge
              variant={statusBadgeProps.variant as any}
              label={statusBadgeProps.label}
              size="sm"
              border
            />
          </View>
          
          {/* Indicateur spécial pour offres envoyées */}
          {hasOffered && (
            <View style={styles.offeredIndicator}>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.info} />
              <Text variant="caption" weight="medium" color="info" style={styles.indicatorText}>
                Vous avez déjà répondu à cette demande
              </Text>
            </View>
          )}
          
          {/* Distance et urgence */}
          <View style={styles.infoRow}>
            <View style={styles.distanceContainer}>
              <Ionicons name="location" size={14} color={COLORS.primary} />
              <Text variant="body2" weight="medium" color="primary" style={styles.distanceText}>
                {distance} km
              </Text>
            </View>
            
            <View style={styles.urgencyContainer}>
              <Text variant="caption" color="text-secondary" style={styles.urgencyLabel}>
                Urgence:
              </Text>
              <View style={styles.urgencyDots}>
                {[1, 2, 3, 4, 5].map(dot => (
                  <View
                    key={dot}
                    style={[
                      styles.urgencyDot,
                      dot <= item.urgency ? 
                        (item.urgency >= 4 ? styles.highUrgencyDot : 
                         item.urgency >= 3 ? styles.mediumUrgencyDot : styles.lowUrgencyDot) 
                        : styles.inactiveDot
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
          
          {/* Adresse */}
          <View style={styles.locationRow}>
            <Ionicons name="navigate" size={14} color={COLORS.textSecondary} />
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
            
            {hasOffered ? (
              <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
                <Text variant="caption" weight="semibold" color="info">
                  Voir offre
                </Text>
                <Ionicons name="chevron-forward" size={12} color={COLORS.info} style={{marginLeft: 2}} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
                <Text variant="caption" weight="semibold" color="primary">
                  Répondre
                </Text>
                <Ionicons name="send" size={12} color={COLORS.primary} style={{marginLeft: 2}} />
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
        <Text variant="h3" weight="semibold">Demandes</Text>
        
        {offeredRequests.length > 0 && (
          <TouchableOpacity 
            style={styles.toggleButton} 
            onPress={() => setShowOffered(!showOffered)}
          >
            <Text variant="caption" color={showOffered ? "primary" : "text-secondary"}>
              {showOffered ? "Masquer mes offres" : `Voir mes offres (${offeredRequests.length})`}
            </Text>
            <Ionicons 
              name={showOffered ? "chevron-up-outline" : "chevron-down-outline"} 
              size={16} 
              color={showOffered ? COLORS.primary : COLORS.textSecondary} 
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        )}
      </View>
      
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={24} color={COLORS.danger} />
          <Text variant="body2" color="danger" style={styles.marginLeft}>
            {error}
          </Text>
        </View>
      )}
      
      {!error && requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="search-outline" size={60} color={COLORS.textSecondary} />
          </View>
          <Text variant="body1" color="text-secondary" style={styles.emptyText}>
            Aucune demande à proximité pour le moment
          </Text>
          
          <TouchableOpacity
            style={styles.emptyRefreshButton}
            onPress={handleRefresh}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" style={{marginRight: 8}} />
            <Text variant="button" weight="semibold" color="light">
              Actualiser
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.filterBar}>
            <View style={styles.requestCountContainer}>
              <Ionicons name="location" size={16} color={COLORS.primary} />
              <Text variant="body2" weight="medium" style={styles.marginLeft}>
                {refreshing 
                  ? "Actualisation..."
                  : showOffered
                    ? `${offeredRequests.length} demande${offeredRequests.length > 1 ? 's' : ''} avec offres`
                    : `${pendingRequests.length} demande${pendingRequests.length > 1 ? 's' : ''} disponible${pendingRequests.length > 1 ? 's' : ''}`
                }
              </Text>
            </View>
            
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={handleRefresh}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={16} color="#FFFFFF" />
              <Text variant="caption" weight="semibold" color="light" style={styles.refreshButtonText}>
                Actualiser
              </Text>
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={showOffered ? offeredRequests : pendingRequests}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={showOffered ? (
              <View style={styles.sectionHeader}>
                <Text variant="h5" weight="semibold" color="info">Mes offres envoyées</Text>
                <Text variant="body2" color="text-secondary" style={styles.sectionSubtitle}>
                  Demandes auxquelles vous avez déjà répondu
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
                  {showOffered 
                    ? "Vous n'avez envoyé aucune offre"
                    : "Aucune demande disponible pour le moment"
                  }
                </Text>
              </View>
            }
          />
        </>
      )}
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
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: `${COLORS.backgroundDark}15`,
    marginBottom: SPACING.sm,
  },
  requestCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    ...SHADOWS.small,
  },
  refreshButtonText: {
    marginLeft: 4,
  },
  sectionHeader: {
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
    backgroundColor: `${COLORS.info}08`,
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
  
  // Styles pour les cartes de demande
  requestCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
  },
  offeredCard: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.info,
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
  offeredIcon: {
    backgroundColor: COLORS.info,
  },
  
  // Indicateurs d'état spécifiques
  offeredIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.info}15`,
    padding: 6,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.xs,
  },
  indicatorText: {
    marginLeft: 4,
  },
  
  // Ligne d'informations
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}15`,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  distanceText: {
    marginLeft: 4,
    fontSize: 12,
  },
  urgencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  urgencyLabel: {
    marginRight: SPACING.xs,
  },
  urgencyDots: {
    flexDirection: 'row',
  },
  urgencyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  lowUrgencyDot: {
    backgroundColor: COLORS.success,
  },
  mediumUrgencyDot: {
    backgroundColor: COLORS.warning,
  },
  highUrgencyDot: {
    backgroundColor: COLORS.danger,
  },
  inactiveDot: {
    backgroundColor: COLORS.border,
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
  
  // Styles pour l'interface vide
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${COLORS.textSecondary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyText: {
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  emptyRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.small,
  },
  
  // Conteneur d'erreur
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.danger}15`,
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
  },
  
  // Styles utilitaires
  marginLeft: {
    marginLeft: SPACING.sm,
  },
  marginTopXs: {
    marginTop: SPACING.xs,
  },
});

export default RequestListScreen;