import React, { useState, useEffect } from 'react';
import { 
  View, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  Dimensions,
  ScrollView,
  Image,
  StyleSheet
} from 'react-native';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getJobByOfferId, updateJobTrackingStatus, completeJob } from '../../services/api';
import { Job, TrackingStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Text, Card, Button, Badge, Avatar } from '../../components/ui';
import supabase from '../../config/supabase';

const { width } = Dimensions.get('window');

// Fonction pour calculer la distance entre deux points GPS (formule de Haversine)
const calculateDistance = (
  point1: { latitude: number; longitude: number }, 
  point2: { latitude: number; longitude: number }
) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371; // Rayon de la Terre en km
  
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.latitude)) * Math.cos(toRad(point2.latitude)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance en km
  
  return distance.toFixed(1);
};

// Composant pour afficher le statut
const StatusBadge = ({ status }: { status: TrackingStatus }) => {
  const variants: Record<TrackingStatus, { variant: string; label: string }> = {
    not_started: { variant: 'secondary', label: 'Non démarré' },
    en_route: { variant: 'info', label: 'En route' },
    arrived: { variant: 'primary', label: 'Arrivé' },
    in_progress: { variant: 'warning', label: 'En cours' },
    completed: { variant: 'success', label: 'Terminé' },
  };
  
  const { variant, label } = variants[status] || variants.not_started;
  
  return (
    <Badge 
      variant={variant as any} 
      label={label} 
      size="md"
      className="px-3 py-1"
    />
  );
};

const TrackingScreen = ({ route, navigation }: any) => {
  const { offerId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [prestataire, setPrestataire] = useState<{
    id: string;
    name: string;
    avatar?: string;
    location?: { latitude: number; longitude: number };
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [watchId, setWatchId] = useState<any>(null);
  const [eta, setEta] = useState<string | null>(null);

  useEffect(() => {
    fetchJobDetails();
    
    // Lancer le tracking une fois la première fois
    const trackingCleanup = setupLocationTracking();
    
    // Mettre en place un rafraîchissement périodique du statut de la mission
    const statusRefreshInterval = setInterval(() => {
      console.log('Rafraîchissement automatique du statut de la mission...');
      fetchJobDetails();
    }, 15000); // Rafraîchir toutes les 15 secondes
    
    // Nettoyage à la sortie
    return () => {
      if (trackingCleanup && typeof trackingCleanup === 'function') {
        trackingCleanup();
      }
      
      if (watchId && typeof watchId === 'object' && 'remove' in watchId) {
        watchId.remove();
      }
      
      clearInterval(statusRefreshInterval);
    };
  }, [offerId, user]);

  const fetchJobDetails = async () => {
    try {
      const jobData = await getJobByOfferId(offerId);
      
      // Récupérer les informations de l'offre pour obtenir la requête associée
      const { data: offerData, error: offerError } = await supabase
        .from('offers')
        .select(`
          *,
          requests:request_id(
            id,
            service_id,
            location,
            status,
            urgency,
            notes,
            created_at,
            prestataire_status
          )
        `)
        .eq('id', offerId)
        .maybeSingle();
      
      if (offerError) {
        console.error('Erreur lors de la récupération de l\'offre:', offerError);
        throw offerError;
      }
      
      // Vérifier si un job existe pour cette offre
      if (!jobData) {
        console.log('Aucun job trouvé pour cet offerId:', offerId);
        
        // Si l'offre n'existe pas non plus, on crée des données simulées
        if (!offerData) {
          console.log('Offre introuvable également. Création de données simulées.');
          
          setJob({
            id: 'simulated-job-' + Date.now(),
            offer_id: offerId,
            client_id: user?.id || 'client-123',
            prestataire_id: 'prestataire-123',
            tracking_status: 'not_started',
            is_completed: false,
            created_at: new Date().toISOString()
          });
          
          // Récupérer les infos du prestataire (simulé pour l'exemple)
          setPrestataire({
            id: 'prestataire-123',
            name: 'Thomas Martin',
            location: {
              latitude: 48.8566, // Paris
              longitude: 2.3522
            }
          });
          
          // Simuler un ETA
          setEta('15-20 min');
        } else {
          console.log('Offre trouvée, vérification du statut dans la requête:', offerData);
          
          // Utiliser le prestataire_status de la requête si disponible, sinon par défaut 'not_started'
          let prestataireStatus = 'not_started';
          // On vérifie d'abord si la propriété existe avant de l'utiliser
          if (offerData.requests && 'prestataire_status' in offerData.requests) {
            prestataireStatus = offerData.requests.prestataire_status || 'not_started';
            console.log('Statut du prestataire trouvé dans la requête:', prestataireStatus);
          } else {
            console.log('Le champ prestataire_status n\'existe pas encore dans la table requests');
          }
          
          // Créer un job virtuel basé sur les informations de l'offre et de la requête
          setJob({
            id: 'job-for-' + offerId,
            offer_id: offerId,
            client_id: user?.id || offerData.requests?.client_id || 'client-123',
            prestataire_id: offerData.prestataire_id || 'prestataire-123',
            tracking_status: prestataireStatus,
            is_completed: prestataireStatus === 'completed',
            created_at: offerData.created_at || new Date().toISOString(),
            offers: offerData,
            requests: offerData.requests
          });
          
          // Obtenir les informations du prestataire
          if (offerData.prestataire_id) {
            const { data: prestataireData } = await supabase
              .from('users')
              .select('id, email')
              .eq('id', offerData.prestataire_id)
              .maybeSingle();
              
            setPrestataire({
              id: offerData.prestataire_id,
              name: prestataireData?.email?.split('@')[0] || 'Prestataire',
              location: {
                latitude: 48.8566, // Paris
                longitude: 2.3522
              }
            });
          } else {
            setPrestataire({
              id: 'prestataire-123',
              name: 'Thomas Martin',
              location: {
                latitude: 48.8566, // Paris
                longitude: 2.3522
              }
            });
          }
          
          // Déterminer l'ETA basé sur le statut du prestataire
          if (prestataireStatus === 'en_route') {
            setEta('15-20 min');
          } else if (prestataireStatus === 'arrived') {
            setEta('Arrivé');
          } else if (prestataireStatus === 'in_progress') {
            setEta('En cours');
          } else if (prestataireStatus === 'completed') {
            setEta('Terminé');
          } else {
            setEta('En attente');
          }
        }
      } else {
        console.log('Job trouvé dans la base de données:', jobData);
        setJob(jobData);
        
        // Récupérer les infos du prestataire du job
        const { data: prestataireData } = await supabase
          .from('users')
          .select('id, email')
          .eq('id', jobData.prestataire_id)
          .maybeSingle();
          
        setPrestataire({
          id: jobData.prestataire_id,
          name: prestataireData?.email?.split('@')[0] || 'Prestataire',
          location: {
            latitude: 48.8566, // Paris
            longitude: 2.3522
          }
        });
        
        // Simuler un ETA basé sur le statut
        if (jobData.tracking_status === 'en_route') {
          setEta('15-20 min');
        } else if (jobData.tracking_status === 'arrived') {
          setEta('Arrivé');
        } else if (jobData.tracking_status === 'in_progress') {
          setEta('En cours');
        } else if (jobData.tracking_status === 'completed') {
          setEta('Terminé');
        } else {
          setEta('En attente');
        }
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
      Alert.alert('Erreur', 'Impossible de récupérer les détails de la mission');
    } finally {
      setLoading(false);
    }
  };

  const setupLocationTracking = async () => {
    if (!user) return;
    
    // 1. Demander les permissions de localisation (foreground seulement)
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Nous avons besoin de votre position pour le suivi');
      return;
    }
    
    // 2. Obtenir la position actuelle
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      const currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      };
      
      setUserLocation(currentLocation);
      
      // Simuler l'envoi des données de position (broadcast)
      if (job && prestataire) {
        console.log('Position client mise à jour:', currentLocation);
      }
    } catch (error) {
      console.error('Error getting current position:', error);
      Alert.alert('Erreur', 'Impossible d\'obtenir votre position actuelle');
    }
    
    // 3. Configurer le suivi périodique via watchPositionAsync (plus simple)
    try {
      const watchPosition = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // 5 secondes
          distanceInterval: 10 // 10 mètres
        },
        (newLocation) => {
          const position = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude
          };
          
          // Mettre à jour l'état local
          setUserLocation(position);
          
          // Simuler l'envoi des données (log uniquement)
          console.log('Nouvelle position client:', position);
        }
      );
      
      // Stocker la référence pour pouvoir nettoyer
      setWatchId(watchPosition);
    } catch (error) {
      console.error('Error setting up position watching:', error);
    }
    
    // Simuler des mises à jour de position du prestataire
    if (job && prestataire) {
      // Au lieu d'essayer d'utiliser une table inexistante, on simule les données
      console.log('Simulation de position du prestataire...');
      
      // Générer une position légèrement différente pour le prestataire toutes les 10 secondes
      const prestataireUpdateInterval = setInterval(() => {
        // On génère une petite variation aléatoire de la position
        const randomLat = (Math.random() - 0.5) * 0.01; // variation de ±0.005 degrés
        const randomLng = (Math.random() - 0.5) * 0.01;
        
        if (prestataire && prestataire.location) {
          const newLocation = {
            latitude: prestataire.location.latitude + randomLat,
            longitude: prestataire.location.longitude + randomLng
          };
          
          setPrestataire(prev => ({
            ...prev!,
            location: newLocation
          }));
          
          console.log('Nouvelle position du prestataire (simulée):', newLocation);
        }
      }, 10000); // Toutes les 10 secondes
      
      // Stocker l'intervalle pour le nettoyage
      return () => {
        clearInterval(prestataireUpdateInterval);
        if (watchId) {
          if (typeof watchId === 'object' && 'remove' in watchId) {
            watchId.remove();
          }
        }
      };
    }
  };

  const handleStatusUpdate = async (newStatus: TrackingStatus) => {
    if (!job) return;
    
    try {
      setSubmitting(true);
      
      if (newStatus === TrackingStatus.COMPLETED) {
        await completeJob(job.id);
      } else {
        await updateJobTrackingStatus(job.id, newStatus);
      }
      
      // Mettre à jour l'état local
      setJob(prev => prev ? { ...prev, tracking_status: newStatus } : null);
      
      if (newStatus === TrackingStatus.COMPLETED) {
        Alert.alert(
          'Mission terminée',
          'La mission a été marquée comme terminée. Vous allez être redirigé vers l\'écran d\'évaluation.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('ReviewScreen', { jobId: job.id })
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error updating job status:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut de la mission');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.notFoundContainer}>
        <Text variant="h4" color="text-secondary">Mission introuvable</Text>
        <Button 
          label="Retour"
          variant="primary"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        />
      </View>
    );
  }
  
  const getStatusIcon = (status: TrackingStatus) => {
    switch (status) {
      case TrackingStatus.NOT_STARTED:
        return <Ionicons name="time-outline" size={24} color="#6c757d" />;
      case TrackingStatus.EN_ROUTE:
        return <Ionicons name="car-outline" size={24} color="#3F51B5" />;
      case TrackingStatus.ARRIVED:
        return <Ionicons name="location" size={24} color="#9C27B0" />;
      case TrackingStatus.IN_PROGRESS:
        return <Ionicons name="construct-outline" size={24} color="#009688" />;
      case TrackingStatus.COMPLETED:
        return <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />;
      default:
        return <Ionicons name="help-circle-outline" size={24} color="#6c757d" />;
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* En-tête avec statut */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text variant="h4" weight="semibold">Suivi en temps réel</Text>
            <StatusBadge status={job.tracking_status} />
          </View>
          <Text variant="body2" color="text-secondary">
            Mission #{job.id.substring(0, 8)}
          </Text>
        </View>
        
        {/* Carte du prestataire */}
        {prestataire && (
          <Card style={styles.card} elevation="sm">
            <View style={styles.prestataireRow}>
              <Avatar 
                size="lg" 
                initials={prestataire.name.substring(0, 2)} 
                backgroundColor={COLORS.primary}
              />
              <View style={styles.prestataireInfo}>
                <Text variant="h5" weight="semibold">{prestataire.name}</Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={16} color={COLORS.warning} />
                  <Text variant="body2" style={styles.smallMarginLeft}>4.9</Text>
                  <Text variant="body2" color="text-secondary" style={styles.marginLeft}>(128 avis)</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.iconButton} 
                onPress={() => Alert.alert('Contact', 'Fonctionnalité de chat disponible prochainement')}
              >
                <Ionicons name="chatbubble-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.iconButton, styles.marginLeft]} 
                onPress={() => Alert.alert('Appel', 'Fonctionnalité d\'appel disponible prochainement')}
              >
                <Ionicons name="call-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </Card>
        )}
        
        {/* Carte de statut et ETA */}
        <Card style={styles.card} elevation="sm">
          <View style={styles.statusRow}>
            <View style={styles.statusIconContainer}>
              {getStatusIcon(job.tracking_status)}
            </View>
            <View style={styles.statusInfo}>
              <Text variant="body1" weight="medium">
                {job.tracking_status === TrackingStatus.NOT_STARTED && 'En attente de démarrage'}
                {job.tracking_status === TrackingStatus.EN_ROUTE && 'En route vers votre position'}
                {job.tracking_status === TrackingStatus.ARRIVED && 'Arrivé à destination'}
                {job.tracking_status === TrackingStatus.IN_PROGRESS && 'Prestation en cours'}
                {job.tracking_status === TrackingStatus.COMPLETED && 'Prestation terminée'}
              </Text>
              <Text variant="body2" color="text-secondary">
                {job.tracking_status === TrackingStatus.EN_ROUTE && `Arrivée estimée dans ${eta}`}
                {job.tracking_status === TrackingStatus.ARRIVED && 'Le prestataire est arrivé'}
                {job.tracking_status === TrackingStatus.IN_PROGRESS && 'Travail en cours'}
                {job.tracking_status === TrackingStatus.COMPLETED && 'Mission terminée avec succès'}
              </Text>
            </View>
          </View>
        </Card>
        
        {/* Carte de localisation (version texte) */}
        <Card style={styles.card} elevation="sm">
          <View style={styles.sectionHeader}>
            <Text variant="h5" weight="semibold" style={styles.smallMarginBottom}>
              <Ionicons name="location" size={18} color={COLORS.primary} /> Suivi de localisation
            </Text>
          </View>
          
          {userLocation && prestataire?.location ? (
            <View style={styles.locationContent}>
              <View style={styles.marginBottom}>
                <Text variant="body2" weight="medium" color="text-secondary" style={styles.smallMarginBottom}>Votre position</Text>
                <View style={styles.coordinatesContainer}>
                  <Text>
                    {userLocation.latitude.toFixed(5)}, {userLocation.longitude.toFixed(5)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.distanceContainer}>
                <Ionicons name="resize" size={18} color={COLORS.primary} />
                <Text variant="body1" weight="medium" color="primary" style={styles.marginLeft}>
                  Distance: {calculateDistance(userLocation, prestataire.location)} km
                </Text>
              </View>
              
              <View>
                <Text variant="body2" weight="medium" color="text-secondary" style={styles.smallMarginBottom}>Position du prestataire</Text>
                <View style={styles.coordinatesContainer}>
                  <Text>
                    {prestataire.location.latitude.toFixed(5)}, {prestataire.location.longitude.toFixed(5)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
                  <Text variant="body2">Vous</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.danger }]} />
                  <Text variant="body2">Prestataire</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="location-outline" size={36} color={COLORS.textSecondary} />
              <Text variant="body1" color="text-secondary" style={styles.marginTop}>
                En attente de la position...
              </Text>
            </View>
          )}
        </Card>
        
        {/* Instructions et informations supplémentaires */}
        <Card style={[styles.card, styles.marginBottom]} elevation="sm">
          <View style={styles.sectionHeader}>
            <Text variant="h5" weight="semibold" style={styles.smallMarginBottom}>
              <Ionicons name="information-circle" size={18} color={COLORS.primary} /> Informations
            </Text>
          </View>
          
          <View style={styles.infoContent}>
            <Text variant="body2" style={styles.infoText}>
              Vous recevrez une notification lorsque le prestataire arrivera à destination. 
              Veuillez rester disponible pour l'accueillir.
            </Text>
            
            <View style={styles.infoItem}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} style={styles.marginRight} />
              <Text variant="body2">Prestataire vérifié et certifié</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} style={styles.marginRight} />
              <Text variant="body2">Assurance et garantie incluses</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="card" size={20} color={COLORS.secondary} style={styles.marginRight} />
              <Text variant="body2">Paiement sécurisé à la fin de la prestation</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
      
      {/* Boutons d'action */}
      <View style={styles.actionBar}>
        {job.tracking_status === TrackingStatus.ARRIVED && (
          <Button
            variant="success"
            label="Confirmer la fin de la mission"
            loading={submitting}
            style={styles.marginBottom}
            onPress={() => handleStatusUpdate(TrackingStatus.COMPLETED)}
          />
        )}
        
        <Button
          variant="outline"
          label="Urgence / Problème"
          icon={<Ionicons name="alert-circle-outline" size={20} color={COLORS.primary} />}
          onPress={() => Alert.alert('Assistance', 'Fonctionnalité d\'assistance disponible prochainement')}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.background
  },
  backButton: {
    marginTop: SPACING.md,
    width: 120
  },
  header: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.md
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm
  },
  card: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md
  },
  prestataireRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  prestataireInfo: {
    marginLeft: SPACING.md,
    flex: 1
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4
  },
  iconButton: {
    backgroundColor: `${COLORS.primary}20`,
    borderRadius: BORDER_RADIUS.round,
    padding: 10
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: `${COLORS.primaryLight}20`,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusInfo: {
    marginLeft: SPACING.md,
    flex: 1
  },
  sectionHeader: {
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  locationContent: {
    marginTop: SPACING.sm
  },
  coordinatesContainer: {
    backgroundColor: COLORS.backgroundDark,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: `${COLORS.primary}20`,
    borderRadius: BORDER_RADIUS.md
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.md
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: BORDER_RADIUS.round,
    marginRight: SPACING.sm
  },
  emptyStateContainer: {
    paddingVertical: SPACING.xl,
    alignItems: 'center'
  },
  infoContent: {
    marginTop: SPACING.sm
  },
  infoText: {
    marginBottom: SPACING.md
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm
  },
  actionBar: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  marginBottom: {
    marginBottom: SPACING.sm
  },
  smallMarginBottom: {
    marginBottom: 4
  },
  marginTop: {
    marginTop: SPACING.sm
  },
  marginLeft: {
    marginLeft: SPACING.sm
  },
  smallMarginLeft: {
    marginLeft: 4
  },
  marginRight: {
    marginRight: SPACING.sm
  }
});

export default TrackingScreen;