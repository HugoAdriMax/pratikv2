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
import { Job, TrackingStatus } from '../../types';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Badge, Card } from '../../components/ui';
import { getServiceById, getClientById, enrichJobWithMockData } from '../../utils/mockData';

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
      
      // Séparer les missions actives et terminées
      const active: Job[] = [];
      const completed: Job[] = [];
      
      // Vérifier si des données ont été récupérées
      if (!data || data.length === 0) {
        console.log('Aucun job trouvé - utilisation de données simulées pour les tests');
        
        // Créer des jobs fictifs pour les tests, y compris un job pour chaque offre acceptée
        const mockJobs = [];
        
        // Récupérer toutes les offres, en priorité les offres acceptées
        try {
          // Connexion à Supabase pour vérification
          const status = await supabase.auth.getSession();
          console.log('Statut de la connexion Supabase:', status.data.session ? 'Connecté' : 'Non connecté');
          
          // 1. D'abord, vérifier s'il y a des offres acceptées
          const { data: acceptedOffers, error: offerError } = await supabase
            .from('offers')
            .select('*, requests:request_id(*)')
            .eq('prestataire_id', user.id)
            .eq('status', 'accepted');
            
          if (offerError) {
            console.error('Erreur lors de la récupération des offres acceptées:', offerError);
          } else {
            console.log(`[CRITIQUE] Offres acceptées trouvées pour ce prestataire: ${acceptedOffers?.length || 0}`);
            
            // Pour chaque offre acceptée, créer un job simulé
            if (acceptedOffers && acceptedOffers.length > 0) {
              console.log('Détails des offres acceptées:');
              acceptedOffers.forEach((offer, index) => {
                console.log(`Offre ${index+1}: ID=${offer.id}, Request=${offer.request_id}, Prix=${offer.price}`);
                
                // Créer un job pour cette offre
                mockJobs.push({
                  id: `auto-job-${index}`,
                  offer_id: offer.id,
                  client_id: offer.requests?.client_id || 'auto-client',
                  prestataire_id: user.id,
                  tracking_status: 'not_started',
                  is_completed: false,
                  created_at: offer.created_at || new Date().toISOString()
                });
              });
            }
          }
        } catch (error) {
          console.error('Exception lors de la récupération des offres acceptées:', error);
        }
        
        // Si aucune offre acceptée n'a été trouvée, ajouter quelques jobs fictifs de base
        if (mockJobs.length === 0) {
          console.log('Aucune offre acceptée trouvée, ajout de jobs fictifs de démonstration');
          
          // Job standard pour les tests
          mockJobs.push({
            id: 'mock-job-1',
            offer_id: 'mock-offer-1',
            client_id: 'client-123',
            prestataire_id: user.id,
            tracking_status: 'not_started',
            is_completed: false,
            created_at: new Date().toISOString()
          });
          
          // Deuxième mission fictive pour les tests
          mockJobs.push({
            id: 'mock-job-2',
            offer_id: 'mock-offer-2',
            client_id: 'client-456',
            prestataire_id: user.id,
            tracking_status: 'en_route',
            is_completed: false,
            created_at: new Date(Date.now() - 86400000).toISOString() // Hier
          });
        }
        
        // Enrichir les jobs simulés avec des données
        console.log(`Création de ${mockJobs.length} jobs simulés`);
        const enrichedJobs = mockJobs.map(job => enrichJobWithMockData(job as Job));
        setActiveJobs(enrichedJobs);
        setCompletedJobs([]);
        return;
      }
      
      // Enrichir les jobs avec des données simulées
      const enrichedJobs = (data as Job[]).map(job => enrichJobWithMockData(job));
      
      enrichedJobs.forEach(job => {
        if (job.is_completed) {
          completed.push(job);
        } else {
          active.push(job);
        }
      });
      
      setActiveJobs(active);
      setCompletedJobs(completed);
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
    
    // Nettoyer les abonnements lors du démontage du composant
    return () => {
      unsubscribe();
      supabase.removeChannel(jobsChannel);
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
    // Adapter pour la nouvelle structure nested où requests est dans offers
    if (job.offers?.requests?.service_id) {
      const serviceIcons: Record<string, string> = {
        '1': 'construct',   // Plomberie
        '2': 'flash',       // Électricité
        '3': 'leaf',        // Jardinage
        '4': 'home',        // Ménage
        '5': 'hammer',      // Bricolage
        '6': 'color-palette', // Peinture
        '7': 'car',         // Déménagement
      };
      
      // Vérifier si on a une icône pour ce service
      const serviceId = job.offers.requests.service_id.charAt(0);
      if (serviceId && !isNaN(parseInt(serviceId)) && parseInt(serviceId) <= 7) {
        return serviceIcons[serviceId];
      }
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
    // Formatez la date
    const date = new Date(item.created_at);
    const formattedDate = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Récupérer les informations du client
    let clientName = 'Client';
    if (item.clients && item.clients.email) {
      clientName = item.clients.email.split('@')[0] || 'Client';
    } else {
      const mockClient = getClientById(item.client_id);
      clientName = mockClient?.name || 'Client';
    }
    
    // Récupérer le prix de l'offre
    // Log pour vérifier les données reçues
    console.log(`Debug - Données de l'offre:`, item.offers);
    
    // S'assurer que le prix est correctement récupéré de l'offre
    let price = '0';
    if (item.offers && typeof item.offers.price !== 'undefined') {
      price = item.offers.price.toString();
      console.log(`Prix trouvé dans l'offre: ${price}`);
    }
    
    // Récupérer le service si disponible
    let serviceName = '';
    // Adapter pour la nouvelle structure nested où requests est dans offers
    if (item.offers?.requests?.service_id) {
      const service = getServiceById(item.offers.requests.service_id);
      serviceName = service?.name || '';
    }
    
    const badgeProps = getStatusBadgeProps(item.tracking_status);
    const jobIcon = getJobIcon(item);
    
    return (
      <Card
        style={styles.jobCard}
        elevation="sm"
        onPress={() => navigation.navigate('JobTracking', { jobId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.leftContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name={jobIcon} size={20} color={COLORS.primary} />
            </View>
            <View style={styles.clientInfo}>
              <Text variant="h5" weight="semibold">{clientName}</Text>
              <Badge 
                variant={badgeProps.variant as any} 
                label={badgeProps.label} 
                size="sm"
                border
                style={styles.marginTopXs}
              />
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text variant="body1" weight="semibold" color="success">
              {price} €
            </Text>
          </View>
        </View>
        
        <View style={styles.separator} />
        
        {serviceName && (
          <View style={styles.serviceRow}>
            <Ionicons name="briefcase-outline" size={16} color={COLORS.textSecondary} />
            <Text 
              variant="body2" 
              color="text" 
              style={styles.marginLeft}
              weight="medium"
            >
              {serviceName}
            </Text>
          </View>
        )}
        
        <View style={styles.infoRow}>
          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
            <Text 
              variant="caption" 
              color="text-secondary" 
              style={styles.marginLeft}
            >
              {formattedDate}
            </Text>
          </View>
          
          <View style={styles.detailsLink}>
            <Text variant="caption" color="primary" weight="medium">
              Voir détails
            </Text>
            <Ionicons 
              name="chevron-forward" 
              size={14} 
              color={COLORS.primary} 
              style={styles.marginLeftXs} 
            />
          </View>
        </View>
      </Card>
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="h3" weight="semibold">Mes missions</Text>
      </View>
      
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[
            styles.tab, 
            activeTab === 'active' && styles.activeTab
          ]}
          onPress={() => setActiveTab('active')}
          activeOpacity={0.7}
        >
          <Text 
            variant="body2" 
            weight={activeTab === 'active' ? 'semibold' : 'regular'}
            color={activeTab === 'active' ? 'primary' : 'text-secondary'}
          >
            En cours ({activeJobs.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.tab, 
            activeTab === 'completed' && styles.activeTab
          ]}
          onPress={() => setActiveTab('completed')}
          activeOpacity={0.7}
        >
          <Text 
            variant="body2" 
            weight={activeTab === 'completed' ? 'semibold' : 'regular'}
            color={activeTab === 'completed' ? 'primary' : 'text-secondary'}
          >
            Terminées ({completedJobs.length})
          </Text>
        </TouchableOpacity>
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
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => navigation.navigate('RequestList')}
              activeOpacity={0.8}
            >
              <Text variant="button" weight="semibold" color="light">
                Parcourir les demandes
              </Text>
            </TouchableOpacity>
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
  header: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    ...SHADOWS.small,
    marginBottom: SPACING.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.primary,
  },
  listContainer: {
    padding: SPACING.md,
    paddingTop: SPACING.sm,
  },
  jobCard: {
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  clientInfo: {
    flex: 1,
  },
  priceContainer: {
    backgroundColor: `${COLORS.success}15`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
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
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.small,
  },
  marginLeft: {
    marginLeft: SPACING.sm,
  },
  marginLeftXs: {
    marginLeft: 4,
  },
  marginTopXs: {
    marginTop: SPACING.xs,
  },
});

export default MyJobsScreen;