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
import supabase from '../../config/supabase';
import { Job, TrackingStatus, PaymentStatus } from '../../types';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Badge, Card, Button } from '../../components/ui';
import { getServiceById, getClientById } from '../../services/api';

const MyJobsScreen = ({ navigation }: any) => {
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [completedJobs, setCompletedJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const fetchJobs = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Récupérer les missions du prestataire
      console.log(`Récupération des jobs pour le prestataire ID: ${user.id}`);
      
      // Requête pour récupérer les jobs avec les relations correctes
      // Utiliser les relations imbriquées pour accéder aux requêtes via les offres
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          offers:offer_id (
            id, 
            price, 
            status, 
            payment_status,
            request_id,
            requests:request_id (
              id,
              service_id,
              location,
              status,
              urgency,
              notes,
              created_at
            )
          ),
          clients:client_id (
            id,
            email
          )
        `)
        .eq('prestataire_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Erreur lors de la récupération des jobs:', error);
        throw error;
      }
      
      // Vérifier si des données ont été récupérées
      if (!data || data.length === 0) {
        console.log('Aucun job trouvé');
        // Ne pas créer de données fictives en production
        setActiveJobs([]);
        setCompletedJobs([]);
        setLoading(false);
        return;
      }
      
      // Traiter les jobs directement sans enrichissement externe
      const processJobs = () => {
        const active: Job[] = [];
        const completed: Job[] = [];
        
        // Utiliser les données telles quelles
        (data as Job[]).forEach(job => {
          if (job.is_completed) {
            completed.push(job);
          } else {
            active.push(job);
          }
        });
        
        setActiveJobs(active);
        setCompletedJobs(completed);
        setLoading(false);
      };
      
      processJobs();
    } catch (error) {
      console.error('Error fetching jobs:', error);
      Alert.alert('Erreur', 'Impossible de récupérer vos missions');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
  };

  // Utiliser un effet pour récupérer les missions et s'abonner aux changements
  useEffect(() => {
    // Fonction pour récupérer les missions
    const loadJobs = async () => {
      await fetchJobs();
    };
    
    // Charger les missions au démarrage
    loadJobs();
    
    // Rafraîchir lors du focus sur l'écran
    const unsubscribe = navigation.addListener('focus', () => {
      loadJobs();
    });
    
    // Mettre en place un canal en temps réel pour écouter les changements de jobs
    const jobsChannel = supabase
      .channel('jobs-changes')
      .on('postgres_changes', {
        event: '*',  // tous les événements (insert, update, delete)
        schema: 'public',
        table: 'jobs',
        filter: `prestataire_id=eq.${user?.id}`
      }, () => {
        // Rafraîchir les données à chaque changement
        loadJobs();
      })
      .subscribe();
    
    // Rafraîchissement périodique
    const refreshInterval = setInterval(() => {
      loadJobs();
      console.log('Rafraîchissement automatique des missions...');
    }, 30000); // Toutes les 30 secondes
    
    // Nettoyer les abonnements lors du démontage du composant
    return () => {
      unsubscribe();
      supabase.removeChannel(jobsChannel);
      clearInterval(refreshInterval);
    };
  }, [navigation, user]);

  const getStatusBadgeProps = (status: TrackingStatus) => {
    switch (status) {
      case TrackingStatus.NOT_STARTED:
        return { variant: 'secondary', label: 'Non démarré' };
      case TrackingStatus.EN_ROUTE:
        return { variant: 'info', label: 'En route' };
      case TrackingStatus.ARRIVED:
        return { variant: 'primary', label: 'Arrivé' };
      case TrackingStatus.IN_PROGRESS:
        return { variant: 'warning', label: 'En cours' };
      case TrackingStatus.COMPLETED:
        return { variant: 'success', label: 'Terminé' };
      default:
        return { variant: 'secondary', label: 'Inconnu' };
    }
  };
  
  const getJobIcon = (job: Job) => {
    // Si le service est disponible, récupérer l'icône du service
    if (job.offers?.requests?.service_id) {
      const serviceName = job.offers.requests.service_id.split('-')[0].toLowerCase();
      
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
    }
    
    // Icône par défaut basée sur le statut de la mission
    switch(job.tracking_status) {
      case TrackingStatus.NOT_STARTED:
        return 'time';
      case TrackingStatus.EN_ROUTE:
        return 'car';
      case TrackingStatus.ARRIVED:
        return 'location';
      case TrackingStatus.IN_PROGRESS:
        return 'construct';
      case TrackingStatus.COMPLETED:
        return 'checkmark-circle';
      default:
        return 'help-circle';
    }
  };

  const renderJobItem = ({ item }: { item: Job }) => {
    // Formater la date
    const date = new Date(item.created_at);
    const formattedDate = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
    
    // Récupérer les informations du client
    const clientName = item.clients?.email?.split('@')[0] || 'Client';
    
    // Récupérer le prix de l'offre
    const price = item.offers?.price?.toString() || '0';
    
    // Récupérer le nom du service
    const serviceName = item.offers?.requests?.services?.name || 
                       item.offers?.requests?.service_id?.replace(/-/g, ' ').split(' ')[0].charAt(0).toUpperCase() + 
                       item.offers?.requests?.service_id?.replace(/-/g, ' ').split(' ')[0].slice(1) || 
                       'Service';
    
    const location = item.offers?.requests?.location?.address || 'Adresse non précisée';
    
    const statusBadgeProps = getStatusBadgeProps(item.tracking_status);
    const jobIcon = getJobIcon(item);
    
    // Vérifier si la mission est payée mais pas encore démarrée
    const isPaidButNotStarted = 
      item.tracking_status === TrackingStatus.NOT_STARTED && 
      item.offers?.payment_status === PaymentStatus.COMPLETED;
    
    // Vérifier si la mission est en cours (en route, arrivé ou en progrès)
    const isInProgress = 
      item.tracking_status === TrackingStatus.EN_ROUTE || 
      item.tracking_status === TrackingStatus.ARRIVED || 
      item.tracking_status === TrackingStatus.IN_PROGRESS;
    
    // Vérifier si la mission est terminée
    const isCompleted = item.tracking_status === TrackingStatus.COMPLETED;
    
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate('JobTracking', { jobId: item.id })}
      >
        <Card 
          style={[
            styles.jobCard,
            isPaidButNotStarted && styles.paidJobCard,
            isInProgress && styles.inProgressCard,
            isCompleted && styles.completedCard
          ]}
          elevation="sm"
        >
          <View style={styles.cardHeader}>
            {/* Icône et nom du client */}
            <View style={styles.clientSection}>
              <View style={[
                styles.iconContainer,
                isPaidButNotStarted && styles.paidIconContainer,
                isInProgress && styles.inProgressIconContainer,
                isCompleted && styles.completedIconContainer
              ]}>
                <Ionicons 
                  name={jobIcon} 
                  size={20} 
                  color="#FFFFFF" 
                />
              </View>
              <Text variant="subtitle1" weight="bold" style={styles.clientName}>
                {clientName}
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
          
          {/* Indicateur spécial pour missions payées */}
          {isPaidButNotStarted && (
            <View style={styles.paidIndicator}>
              <Ionicons name="wallet" size={14} color={COLORS.success} />
              <Text variant="caption" weight="medium" color="success" style={styles.indicatorText}>
                Paiement confirmé - Prêt à démarrer
              </Text>
            </View>
          )}
          
          {/* Indicateur pour missions en cours */}
          {isInProgress && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: item.tracking_status === TrackingStatus.EN_ROUTE ? '30%' : 
                             item.tracking_status === TrackingStatus.ARRIVED ? '60%' : '85%'
                    }
                  ]} 
                />
              </View>
              <Text variant="caption" color="text-secondary" style={styles.progressLabel}>
                {item.tracking_status === TrackingStatus.EN_ROUTE ? 'En route vers le client' : 
                 item.tracking_status === TrackingStatus.ARRIVED ? 'Arrivé chez le client' : 'Travail en cours'}
              </Text>
            </View>
          )}
          
          {/* Service et prix */}
          <View style={styles.infoRow}>
            <View style={styles.serviceContainer}>
              <Ionicons name="briefcase" size={14} color={COLORS.primary} />
              <Text variant="body2" weight="medium" style={styles.serviceText}>
                {serviceName}
              </Text>
            </View>
            
            <View style={[
              styles.priceContainer,
              isPaidButNotStarted && styles.paidPriceContainer,
              isInProgress && styles.inProgressPriceContainer,
              isCompleted && styles.completedPriceContainer
            ]}>
              <Text variant="body2" weight="semibold" color="light">
                {price} €
              </Text>
            </View>
          </View>
          
          {/* Adresse */}
          <View style={styles.locationRow}>
            <Ionicons name="location" size={14} color={COLORS.textSecondary} />
            <Text variant="caption" color="text-secondary" style={styles.locationText} numberOfLines={1}>
              {location}
            </Text>
          </View>
          
          {/* Pied de carte avec date et bouton selon le statut */}
          <View style={styles.cardFooter}>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={12} color={COLORS.textSecondary} />
              <Text variant="caption" color="text-secondary" style={{marginLeft: 4}}>
                {formattedDate}
              </Text>
            </View>
            
            {isPaidButNotStarted && (
              <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
                <Text variant="caption" weight="semibold" color="success">
                  Démarrer la mission
                </Text>
                <Ionicons name="play" size={12} color={COLORS.success} style={{marginLeft: 2}} />
              </TouchableOpacity>
            )}
            
            {isInProgress && (
              <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
                <Text variant="caption" weight="semibold" color="primary">
                  Continuer
                </Text>
                <Ionicons name="arrow-forward" size={12} color={COLORS.primary} style={{marginLeft: 2}} />
              </TouchableOpacity>
            )}
            
            {isCompleted && (
              <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
                <Text variant="caption" weight="semibold" color="success">
                  Voir le détail
                </Text>
                <Ionicons name="chevron-forward" size={12} color={COLORS.success} style={{marginLeft: 2}} />
              </TouchableOpacity>
            )}
            
            {!isPaidButNotStarted && !isInProgress && !isCompleted && (
              <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
                <Text variant="caption" weight="semibold" color="text-secondary">
                  Voir détails
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
        <Text variant="h3" weight="semibold">Mes missions</Text>
        
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[
              styles.tab, 
              activeTab === 'active' && styles.activeTab
            ]}
            onPress={() => setActiveTab('active')}
            activeOpacity={0.8}
          >
            <View style={styles.tabContent}>
              <Ionicons 
                name="briefcase" 
                size={16} 
                color={activeTab === 'active' ? COLORS.primary : COLORS.textSecondary} 
              />
              <Text 
                variant="body2" 
                weight={activeTab === 'active' ? 'semibold' : 'regular'}
                color={activeTab === 'active' ? 'primary' : 'text-secondary'}
                style={{marginLeft: 4}}
              >
                En cours
              </Text>
              {activeJobs.length > 0 && (
                <View style={styles.counterBadge}>
                  <Text variant="caption" weight="semibold" color="light">
                    {activeJobs.length}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.tab, 
              activeTab === 'completed' && styles.activeTab
            ]}
            onPress={() => setActiveTab('completed')}
            activeOpacity={0.8}
          >
            <View style={styles.tabContent}>
              <Ionicons 
                name="checkmark-circle" 
                size={16} 
                color={activeTab === 'completed' ? COLORS.primary : COLORS.textSecondary} 
              />
              <Text 
                variant="body2" 
                weight={activeTab === 'completed' ? 'semibold' : 'regular'}
                color={activeTab === 'completed' ? 'primary' : 'text-secondary'}
                style={{marginLeft: 4}}
              >
                Terminées
              </Text>
              {completedJobs.length > 0 && (
                <View style={styles.counterBadge}>
                  <Text variant="caption" weight="semibold" color="light">
                    {completedJobs.length}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
      
      {(activeTab === 'active' && activeJobs.length === 0) || 
       (activeTab === 'completed' && completedJobs.length === 0) ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons 
              name={activeTab === 'active' ? 'briefcase-outline' : 'checkmark-done-outline'} 
              size={60} 
              color={COLORS.textSecondary} 
            />
          </View>
          <Text 
            variant="body1" 
            color="text-secondary" 
            style={styles.emptyText}
          >
            {activeTab === 'active' 
              ? 'Vous n\'avez pas de missions en cours' 
              : 'Vous n\'avez pas encore de missions terminées'}
          </Text>
          
          {activeTab === 'active' && (
            <Button
              variant="primary"
              label="Parcourir les demandes"
              onPress={() => navigation.navigate('RequestList')}
              style={styles.browseButton}
              leftIcon={<Ionicons name="search" size={18} color="#FFFFFF" />}
            />
          )}
        </View>
      ) : (
        <FlatList
          data={activeTab === 'active' ? activeJobs : completedJobs}
          renderItem={renderJobItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
    marginBottom: SPACING.sm,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    marginTop: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: `${COLORS.primary}20`,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  activeTab: {
    backgroundColor: `${COLORS.primary}15`,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBadge: {
    backgroundColor: COLORS.primary,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  listContainer: {
    padding: SPACING.md,
    paddingTop: SPACING.xs,
  },
  
  // Styles des cartes de mission
  jobCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
  },
  paidJobCard: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
  },
  inProgressCard: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
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
  clientSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  paidIconContainer: {
    backgroundColor: COLORS.success,
  },
  inProgressIconContainer: {
    backgroundColor: COLORS.primary,
  },
  completedIconContainer: {
    backgroundColor: COLORS.success,
  },
  clientName: {
    marginLeft: SPACING.xs,
    fontSize: 14,
    textTransform: 'capitalize',
    flex: 1,
  },
  
  // Indicateurs d'état
  paidIndicator: {
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
  
  // Barre de progression
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
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  progressLabel: {
    textAlign: 'right',
    fontSize: 10,
  },
  
  // Ligne d'informations
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  serviceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serviceText: {
    marginLeft: 4,
    fontSize: 12,
  },
  priceContainer: {
    backgroundColor: COLORS.primary,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  paidPriceContainer: {
    backgroundColor: COLORS.success,
  },
  inProgressPriceContainer: {
    backgroundColor: COLORS.primary,
  },
  completedPriceContainer: {
    backgroundColor: COLORS.success,
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
  browseButton: {
    paddingHorizontal: SPACING.lg,
    ...SHADOWS.small,
  }
});

export default MyJobsScreen;