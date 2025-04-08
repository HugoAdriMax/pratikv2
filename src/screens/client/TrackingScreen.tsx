import React, { useState, useEffect, useRef } from 'react';
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
import MapView, { Marker, Polyline } from 'react-native-maps';
import { 
  calculateDistance as calcDistance, 
  updateUserLocation,
  subscribeToUserLocation,
  calculateETA,
  getUserLocation,
  UserLocation
} from '../../services/location';

const { width } = Dimensions.get('window');

// Fonction pour calculer la distance entre deux points GPS 
const calculateDistance = (
  point1: { latitude: number; longitude: number }, 
  point2: { latitude: number; longitude: number }
): string => {
  return calcDistance(point1, point2).toFixed(1);
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
  
  // Référence à la carte pour la suivre avec une animation
  const mapRef = useRef<MapView | null>(null);
  
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
    
    // 2. Obtenir la position actuelle du client 
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      const currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      };
      
      // Obtenir l'adresse pour l'affichage
      try {
        const addressResponse = await Location.reverseGeocodeAsync({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude
        });
        
        if (addressResponse && addressResponse.length > 0) {
          const addressObj = addressResponse[0];
          const addressStr = [
            addressObj.name,
            addressObj.street,
            addressObj.postalCode,
            addressObj.city
          ].filter(Boolean).join(', ');
          
          currentLocation.address = addressStr;
        }
      } catch (addressError) {
        console.error('Error getting address:', addressError);
      }
      
      // Mettre à jour l'état local
      setUserLocation(currentLocation);
      
      // Mise à jour de la localisation du client en base de données avec le nouveau service
      try {
        await updateUserLocation(user.id, currentLocation);
        console.log('Position client mise à jour en base de données');
      } catch (error) {
        console.error('Error updating client location in database:', error);
      }
      
    } catch (error) {
      console.error('Error getting current position:', error);
      Alert.alert('Erreur', 'Impossible d\'obtenir votre position actuelle');
    }
    
    // 3. Configurer le suivi périodique via watchPositionAsync
    try {
      const watchPosition = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // 5 secondes
          distanceInterval: 10 // 10 mètres
        },
        async (newLocation) => {
          const position = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude
          };
          
          // Mettre à jour l'état local
          setUserLocation(position);
          
          // Mise à jour de la localisation du client en base de données avec le nouveau service
          try {
            await updateUserLocation(user.id, position);
            console.log('Position client mise à jour en base de données (watchPosition)');
          } catch (error) {
            console.error('Error updating client location in database:', error);
          }
        }
      );
      
      // Stocker la référence pour pouvoir nettoyer
      setWatchId(watchPosition);
    } catch (error) {
      console.error('Error setting up position watching:', error);
    }
    
    // 4. S'abonner aux mises à jour de position du prestataire en temps réel 
    if (job && job.prestataire_id) {
      console.log(`Configuration du suivi en temps réel pour le prestataire ${job.prestataire_id}`);
      
      // Configuration initiale avec une position par défaut
      let initialPrestataireLocation = {
        latitude: 48.8566, // Paris
        longitude: 2.3522
      };
      
      // Récupérer la position actuelle du prestataire depuis la base de données
      try {
        const prestataireLocation = await getUserLocation(job.prestataire_id);
        
        if (prestataireLocation) {
          console.log('Position initiale du prestataire récupérée:', prestataireLocation);
          initialPrestataireLocation = {
            latitude: prestataireLocation.latitude,
            longitude: prestataireLocation.longitude
          };
          
          // Mettre à jour l'état avec la position initiale du prestataire
          setPrestataire(prev => ({
            ...prev!,
            location: initialPrestataireLocation
          }));
          
          // Calculer l'ETA initial
          if (userLocation) {
            const distanceValue = calcDistance(userLocation, initialPrestataireLocation);
            const etaMinutes = calculateETA(distanceValue);
            
            // Formater l'affichage de l'ETA
            if (etaMinutes <= 1) {
              setEta('Moins d\'1 min');
            } else if (etaMinutes < 60) {
              setEta(`${etaMinutes} min`);
            } else {
              const hours = Math.floor(etaMinutes / 60);
              const mins = etaMinutes % 60;
              setEta(`${hours}h${mins > 0 ? ` ${mins} min` : ''}`);
            }
          }
        } else {
          console.log('Aucune position du prestataire trouvée, utilisation de la position par défaut');
          
          // Mettre à jour l'état avec la position par défaut
          setPrestataire(prev => ({
            ...prev!,
            location: initialPrestataireLocation
          }));
        }
      } catch (error) {
        console.error('Error fetching prestataire location:', error);
        
        // Mettre à jour l'état avec la position par défaut en cas d'erreur
        setPrestataire(prev => ({
          ...prev!,
          location: initialPrestataireLocation
        }));
      }
      
      // S'abonner aux mises à jour de position du prestataire
      const unsubscribe = subscribeToUserLocation(job.prestataire_id, (updatedLocation: UserLocation) => {
        console.log('Mise à jour de position du prestataire reçue:', updatedLocation);
        
        // Mettre à jour l'état avec la nouvelle position
        const newLocation = {
          latitude: updatedLocation.latitude,
          longitude: updatedLocation.longitude
        };
        
        setPrestataire(prev => ({
          ...prev!,
          location: newLocation
        }));
        
        // Mettre à jour le temps d'arrivée estimé
        if (userLocation) {
          const distanceValue = calcDistance(userLocation, newLocation);
          const etaMinutes = calculateETA(distanceValue);
          
          // Formater l'affichage de l'ETA
          if (etaMinutes <= 1) {
            setEta('Moins d\'1 min');
          } else if (etaMinutes < 60) {
            setEta(`${etaMinutes} min`);
          } else {
            const hours = Math.floor(etaMinutes / 60);
            const mins = etaMinutes % 60;
            setEta(`${hours}h${mins > 0 ? ` ${mins} min` : ''}`);
          }
        }
      });
      
      // Retourner une fonction de nettoyage
      return () => {
        console.log('Nettoyage des abonnements de localisation');
        
        // Se désabonner des mises à jour Realtime
        if (unsubscribe) {
          unsubscribe();
        }
        
        // Nettoyer la surveillance de position
        if (watchId && typeof watchId === 'object' && 'remove' in watchId) {
          watchId.remove();
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
        {/* En-tête avec statut - commenté pour éviter la duplication */}
        {/*
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Text variant="h4" weight="semibold">Suivi en temps réel</Text>
            <StatusBadge status={job.tracking_status} />
          </View>
          <Text variant="body2" color="text-secondary">
            Mission #{job.id.substring(0, 8)}
          </Text>
        </View>
        */}
        
        {/* Affichage du statut sous forme de badge en haut de l'écran */}
        <View style={styles.statusContainer}>
          <StatusBadge status={job.tracking_status} />
          <Text variant="body2" color="text-secondary" style={styles.marginLeft}>
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
                onPress={() => navigation.navigate('Chat', { jobId: job.id })}
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
        
        {/* Carte de localisation avec MapView */}
        <Card style={styles.card} elevation="sm">
          <View style={styles.sectionHeader}>
            <Text variant="h5" weight="semibold" style={styles.smallMarginBottom}>
              <Ionicons name="location" size={18} color={COLORS.primary} /> Suivi de localisation
            </Text>
          </View>
          
          {userLocation && prestataire?.location ? (
            <View>
              {/* Carte interactive */}
              <View style={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  initialRegion={{
                    latitude: prestataire.location.latitude,
                    longitude: prestataire.location.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }}
                >
                  {/* Marqueur pour le client */}
                  <Marker
                    coordinate={{
                      latitude: userLocation.latitude,
                      longitude: userLocation.longitude
                    }}
                    title="Votre position"
                    pinColor={COLORS.primary}
                  />

                  {/* Marqueur pour le prestataire */}
                  <Marker
                    coordinate={{
                      latitude: prestataire.location.latitude,
                      longitude: prestataire.location.longitude
                    }}
                    title="Prestataire"
                    pinColor="red"
                  />
                  
                  {/* Ligne qui relie les deux points */}
                  <Polyline
                    coordinates={[
                      { latitude: userLocation.latitude, longitude: userLocation.longitude },
                      { latitude: prestataire.location.latitude, longitude: prestataire.location.longitude }
                    ]}
                    strokeColor="#007AFF"
                    strokeWidth={3}
                  />
                </MapView>
              </View>

              <View style={styles.mapActions}>
                {/* Bouton pour localiser le prestataire */}
                <TouchableOpacity 
                  style={styles.mapButton}
                  onPress={() => {
                    if (prestataire?.location && mapRef.current) {
                      try {
                        mapRef.current.animateToRegion({
                          latitude: prestataire.location.latitude,
                          longitude: prestataire.location.longitude,
                          latitudeDelta: 0.02,
                          longitudeDelta: 0.02,
                        }, 1000);
                      } catch (e) {
                        console.log('Erreur d\'animation:', e);
                      }
                    }
                  }}
                >
                  <Ionicons name="locate" size={18} color={COLORS.primary} />
                  <Text variant="caption" color="primary" style={styles.smallMarginLeft}>
                    Suivre le prestataire
                  </Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.distanceContainer}>
                <Ionicons name="resize" size={18} color={COLORS.primary} />
                <Text variant="body1" weight="medium" color="primary" style={styles.marginLeft}>
                  Distance: {calculateDistance(userLocation, prestataire.location)} km
                </Text>
              </View>
              
              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
                  <Text variant="body2">Vous</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "red" }]} />
                  <Text variant="body2">Prestataire</Text>
                </View>
              </View>
              
              {/* Information d'estimation d'arrivée au lieu des coordonnées */}
              {job.tracking_status === TrackingStatus.EN_ROUTE && (
                <View style={styles.etaContainer}>
                  <Ionicons name="time-outline" size={20} color={COLORS.info} style={styles.marginRight} />
                  <Text variant="body1" weight="medium">
                    Temps d'arrivée estimé: <Text color="primary">{eta || '15-20 min'}</Text>
                  </Text>
                </View>
              )}
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  mapActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${COLORS.info}15`,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
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
  // Nouveaux styles pour la carte
  mapContainer: {
    height: 250,
    marginVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden'
  },
  map: {
    width: '100%',
    height: '100%'
  },
  markerContainer: {
    alignItems: 'center'
  },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5
  },
  coordinatesInfo: {
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.backgroundDark,
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
    marginVertical: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border
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
  },
  smallMarginRight: {
    marginRight: 4
  }
});

export default TrackingScreen;