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
import { getJobByOfferId, updateJobTrackingStatus, completeJob, getUserReviewStats } from '../../services/api';
import { Job, TrackingStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Text, Card, Button, Badge, Avatar } from '../../components/ui';
import supabase from '../../config/supabase';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { 
  calculateDistance as calcDistance, 
  updateUserLocation,
  subscribeToUserLocation,
  calculateETA,
  getUserLocation,
  getClientAddressFromRequest,
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
      border
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
  // Initialiser userLocation avec des valeurs par défaut
  const [userLocation, setUserLocation] = useState<{ 
    latitude: number; 
    longitude: number;
    address?: string;
  }>({
    latitude: 48.8683356,
    longitude: 2.288925,
    address: "74 bis rue Lauriston, 75016 Paris"
  });
  
  // Initialiser prestataire avec des valeurs par défaut
  const [prestataire, setPrestataire] = useState<{
    id: string;
    name: string;
    avatar?: string;
    location: { 
      latitude: number; 
      longitude: number;
      address?: string;
    };
    reviewStats?: {
      average_rating: number;
      review_count: number;
    };
  }>({
    id: 'default-prestataire',
    name: 'Prestataire',
    location: {
      latitude: 48.8639,
      longitude: 2.2870,
      address: "5 rue des Sablons, 75016 Paris"
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [watchId, setWatchId] = useState<any>(null);
  const [eta, setEta] = useState<string | null>(null);

  useEffect(() => {
    // Fonction pour récupérer les détails et définir les positions
    const fetchDetailsAndSetPositions = async () => {
      // D'abord récupérer les détails du job
      const jobData = await fetchJobDetails();
      
      if (jobData) {
        try {
          // Récupérer l'adresse du client depuis sa demande
          if (jobData.offers && jobData.offers.request_id) {
            const clientAddress = await getClientAddressFromRequest(jobData.offers.request_id);
            
            if (clientAddress) {
              console.log("Adresse du client récupérée depuis la demande:", clientAddress);
              setUserLocation(clientAddress);
              
              // Mettre à jour la position du client dans la base de données pour référence
              if (user && user.id) {
                await updateUserLocation(user.id, clientAddress);
              }
            } else {
              console.log("Aucune adresse trouvée dans la demande, utilisation de l'adresse par défaut");
              // Utiliser l'adresse par défaut si aucune adresse n'est trouvée
              const clientDefaultLocation = {
                latitude: 48.8683356,
                longitude: 2.288925,
                address: "74 bis rue Lauriston, 75016 Paris"
              };
              setUserLocation(clientDefaultLocation);
            }
          } else {
            console.log("Impossible de trouver la demande associée au job, utilisation de l'adresse par défaut");
            // Utiliser l'adresse par défaut si aucune demande n'est trouvée
            const clientDefaultLocation = {
              latitude: 48.8683356,
              longitude: 2.288925,
              address: "74 bis rue Lauriston, 75016 Paris"
            };
            setUserLocation(clientDefaultLocation);
          }
        } catch (error) {
          console.error("Erreur lors de la récupération de l'adresse du client:", error);
          // Utiliser l'adresse par défaut en cas d'erreur
          const clientDefaultLocation = {
            latitude: 48.8683356,
            longitude: 2.288925,
            address: "74 bis rue Lauriston, 75016 Paris"
          };
          setUserLocation(clientDefaultLocation);
        }
      }
      
      // Définir la position fixe du prestataire
      // Récupérer le prestataire avec ses vraies informations
      const fetchPrestataireDetails = async () => {
        if (job && job.prestataire_id) {
          try {
            const { data, error } = await supabase
              .from('users')
              .select('id, email, name, profile_picture, profile_picture_base64')
              .eq('id', job.prestataire_id)
              .single();
            
            if (error) throw error;
            
            // Récupérer les statistiques de reviews du prestataire
            const reviewStats = await getUserReviewStats(job.prestataire_id);
            
            setPrestataire(prev => {
              return {
                ...prev!,
                id: data.id,
                name: data.name || data.email?.split('@')[0] || 'Prestataire',
                avatar: data.profile_picture_base64 
                  ? data.profile_picture_base64 
                  : data.profile_picture,
                location: {
                  latitude: 48.8639, // 5 rue des Sablons
                  longitude: 2.2870
                },
                reviewStats: {
                  average_rating: reviewStats?.average_rating || 0,
                  review_count: reviewStats?.review_count || 0
                }
              };
            });
          } catch (error) {
            console.error('Erreur lors de la récupération des informations du prestataire:', error);
            // Valeurs par défaut en cas d'erreur
            setPrestataire(prev => {
              return {
                ...prev!,
                location: {
                  latitude: 48.8639,
                  longitude: 2.2870
                }
              };
            });
          }
        }
      };
      
      fetchPrestataireDetails();
    };
    
    // Exécuter la fonction
    fetchDetailsAndSetPositions();
    
    // Lancer le tracking une fois la première fois
    const trackingCleanup = setupLocationTracking();
    
    // Mettre en place un rafraîchissement périodique du statut de la mission
    const statusRefreshInterval = setInterval(() => {
      console.log('Rafraîchissement automatique du statut de la mission...');
      fetchJobDetails();
      
      // Réappliquer les positions fixes après chaque rafraîchissement
      setUserLocation({
        latitude: 48.8683356,
        longitude: 2.288925,
        address: "74 bis rue Lauriston, 75016 Paris"
      });
      
      // Récupérer le prestataire avec ses vraies informations
      const fetchPrestataireDetails = async () => {
        if (job && job.prestataire_id) {
          try {
            const { data, error } = await supabase
              .from('users')
              .select('id, email, name, profile_picture, profile_picture_base64')
              .eq('id', job.prestataire_id)
              .single();
            
            if (error) throw error;
            
            // Récupérer les statistiques de reviews du prestataire
            const reviewStats = await getUserReviewStats(job.prestataire_id);
            
            setPrestataire(prev => {
              return {
                ...prev!,
                id: data.id,
                name: data.name || data.email?.split('@')[0] || 'Prestataire',
                avatar: data.profile_picture_base64 
                  ? data.profile_picture_base64 
                  : data.profile_picture,
                location: {
                  latitude: 48.8639, // 5 rue des Sablons
                  longitude: 2.2870
                },
                reviewStats: {
                  average_rating: reviewStats?.average_rating || 0,
                  review_count: reviewStats?.review_count || 0
                }
              };
            });
          } catch (error) {
            console.error('Erreur lors de la récupération des informations du prestataire:', error);
            // Valeurs par défaut en cas d'erreur
            setPrestataire(prev => {
              return {
                ...prev!,
                location: {
                  latitude: 48.8639,
                  longitude: 2.2870
                }
              };
            });
          }
        }
      };
      
      fetchPrestataireDetails();
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
          
          const simulatedJob = {
            id: 'simulated-job-' + Date.now(),
            offer_id: offerId,
            client_id: user?.id || 'client-123',
            prestataire_id: 'prestataire-123',
            tracking_status: 'not_started',
            is_completed: false,
            created_at: new Date().toISOString()
          };
          
          setJob(simulatedJob);
          
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
          
          return simulatedJob;
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
          const virtualJob = {
            id: 'job-for-' + offerId,
            offer_id: offerId,
            client_id: user?.id || offerData.requests?.client_id || 'client-123',
            prestataire_id: offerData.prestataire_id || 'prestataire-123',
            tracking_status: prestataireStatus,
            is_completed: prestataireStatus === 'completed',
            created_at: offerData.created_at || new Date().toISOString(),
            offers: offerData,
            requests: offerData.requests
          };
          
          setJob(virtualJob);
          
          // Obtenir les informations du prestataire
          if (offerData.prestataire_id) {
            const { data: prestataireData } = await supabase
              .from('users')
              .select('id, email')
              .eq('id', offerData.prestataire_id)
              .maybeSingle();
              
            // Récupérer les vraies informations du prestataire
            const { data: prestataireInfo, error: prestataireError } = await supabase
              .from('users')
              .select('id, email, name, profile_picture, profile_picture_base64')
              .eq('id', offerData.prestataire_id)
              .single();
            
            if (prestataireError) {
              console.error('Erreur lors de la récupération des informations du prestataire:', prestataireError);
            }
            
            // Récupérer les statistiques de reviews du prestataire
            const reviewStats = await getUserReviewStats(offerData.prestataire_id);
            
            // Récupérer la position réelle du prestataire
            const prestataireLocation = await getUserLocation(offerData.prestataire_id);
            
            setPrestataire({
              id: offerData.prestataire_id,
              name: prestataireInfo?.name || prestataireInfo?.email?.split('@')[0] || 'Prestataire',
              avatar: prestataireInfo?.profile_picture_base64 
                ? prestataireInfo.profile_picture_base64 
                : prestataireInfo?.profile_picture,
              location: prestataireLocation || {
                latitude: 48.8639, // 5 rue des Sablons (position par défaut)
                longitude: 2.2870
              },
              reviewStats: {
                average_rating: reviewStats?.average_rating || 0,
                review_count: reviewStats?.review_count || 0
              }
            });
          } else {
            // Utiliser un prestataire par défaut si on n'a pas trouvé celui de l'offre
            setPrestataire({
              id: 'prestataire-123',
              name: 'Prestataire par défaut',
              location: {
                latitude: 48.8639, // 5 rue des Sablons
                longitude: 2.2870
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
          
          return virtualJob;
        }
      } else {
        console.log('Job trouvé dans la base de données:', jobData);
        setJob(jobData);
        
        // Récupérer les vraies informations du prestataire
        const { data: prestataireInfo, error: prestataireError } = await supabase
          .from('users')
          .select('id, email, name, profile_picture, profile_picture_base64')
          .eq('id', jobData.prestataire_id)
          .single();
        
        if (prestataireError) {
          console.error('Erreur lors de la récupération des informations du prestataire:', prestataireError);
        }
        
        // Récupérer les statistiques de reviews du prestataire
        const reviewStats = await getUserReviewStats(jobData.prestataire_id);
        
        // Récupérer la position réelle du prestataire
        const prestataireLocation = await getUserLocation(jobData.prestataire_id);
        
        setPrestataire({
          id: jobData.prestataire_id,
          name: prestataireInfo?.name || prestataireInfo?.email?.split('@')[0] || 'Prestataire',
          avatar: prestataireInfo?.profile_picture_base64 
            ? prestataireInfo.profile_picture_base64 
            : prestataireInfo?.profile_picture,
          location: prestataireLocation || {
            latitude: 48.8639, // 5 rue des Sablons (position par défaut)
            longitude: 2.2870
          },
          reviewStats: {
            average_rating: reviewStats?.average_rating || 0,
            review_count: reviewStats?.review_count || 0
          }
        });
        
        // Déterminer l'ETA basé sur le statut et la distance
        if (jobData.tracking_status === 'en_route' && userLocation && prestataire?.location) {
          const distance = calcDistance(userLocation, prestataire.location);
          const etaMinutes = calculateETA(distance);
          
          if (etaMinutes <= 1) {
            setEta('Moins d\'1 min');
          } else if (etaMinutes < 60) {
            setEta(`${etaMinutes} min`);
          } else {
            const hours = Math.floor(etaMinutes / 60);
            const mins = etaMinutes % 60;
            setEta(`${hours}h${mins > 0 ? ` ${mins} min` : ''}`);
          }
        } else if (jobData.tracking_status === 'arrived') {
          setEta('Arrivé');
        } else if (jobData.tracking_status === 'in_progress') {
          setEta('En cours');
        } else if (jobData.tracking_status === 'completed') {
          setEta('Terminé');
        } else {
          setEta('En attente');
        }
        
        return jobData;
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
      Alert.alert('Erreur', 'Impossible de récupérer les détails de la mission');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const setupLocationTracking = async () => {
    if (!user) return;
    
    console.log("Configuration du suivi de localisation en temps réel");
    
    // Note: La position du client est déjà définie dans fetchDetailsAndSetPositions
    // à partir de l'adresse enregistrée dans la demande
    
    // S'assurer que la position du client est bien enregistrée dans la base de données
    if (userLocation) {
      try {
        await updateUserLocation(user.id, userLocation);
        console.log('Position client mise à jour dans la base de données:', userLocation);
      } catch (error) {
        console.error('Erreur lors de la mise à jour de la position client dans la base de données:', error);
      }
    } else {
      console.log("Position du client non disponible, utilisation des coordonnées par défaut");
      // Utiliser les coordonnées par défaut si aucune position n'est disponible
      const clientDefaultLocation = {
        latitude: 48.8683356,
        longitude: 2.288925,
        address: "74 bis rue Lauriston, 75016 Paris",
        formattedAddress: "74 bis rue Lauriston, 75016 Paris"
      };
      
      setUserLocation(clientDefaultLocation);
      
      try {
        await updateUserLocation(user.id, clientDefaultLocation);
        console.log('Position client par défaut mise à jour dans la base de données');
      } catch (error) {
        console.error('Erreur lors de la mise à jour de la position client dans la base de données:', error);
      }
    }
    
    // 4. S'abonner aux mises à jour de position du prestataire en temps réel 
    if (job && job.prestataire_id) {
      console.log(`Configuration du suivi en temps réel pour le prestataire ${job.prestataire_id}`);
      
      // Abonner aux mises à jour de position du prestataire
      const unsubscribe = subscribeToUserLocation(job.prestataire_id, (updatedLocation: UserLocation) => {
        console.log('Mise à jour de position du prestataire reçue:', updatedLocation);
        
        if (!updatedLocation) return;
        
        // Vérifier et extraire les coordonnées
        if (typeof updatedLocation.latitude === 'number' && typeof updatedLocation.longitude === 'number') {
          console.log(`Coordonnées valides détectées: lat=${updatedLocation.latitude}, long=${updatedLocation.longitude}`);
          
          // Mettre à jour l'état avec la nouvelle position
          setPrestataire(prev => {
            if (!prev) return prev;
            
            // Adresse par défaut si null
            const prestataireAddress = updatedLocation.address || "5 rue des Sablons, 75016 Paris";
            
            return {
              ...prev,
              location: {
                latitude: updatedLocation.latitude,
                longitude: updatedLocation.longitude,
                address: prestataireAddress
              }
            };
          });
        } else {
          console.error('Coordonnées invalides reçues:', updatedLocation);
        }
        
        // Mettre à jour le temps d'arrivée estimé si le prestataire est en route
        if (userLocation && job.tracking_status === 'en_route') {
          const distanceValue = calcDistance(
            userLocation, 
            { latitude: updatedLocation.latitude, longitude: updatedLocation.longitude }
          );
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
      {/* En-tête de la carte avec le statut et la géolocalisation */}
      <View style={styles.heroMapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.heroMap}
        >
          {/* Marqueur pour le client - avec vérification des valeurs */}
          {userLocation && typeof userLocation.latitude === 'number' && typeof userLocation.longitude === 'number' && (
            <Marker
              coordinate={{
                latitude: userLocation.latitude,
                longitude: userLocation.longitude
              }}
              title="Votre position"
            >
              <View style={styles.clientMarker}>
                <Ionicons name="home" size={18} color="#FFFFFF" />
              </View>
            </Marker>
          )}

          {/* Marqueur pour le prestataire - avec vérification des valeurs */}
          {prestataire && prestataire.location && 
           typeof prestataire.location.latitude === 'number' && 
           typeof prestataire.location.longitude === 'number' && (
            <Marker
              coordinate={{
                latitude: prestataire.location.latitude,
                longitude: prestataire.location.longitude
              }}
              title="Prestataire"
            >
              <View style={styles.prestataireMarker}>
                <Ionicons name="car" size={18} color="#FFFFFF" />
              </View>
            </Marker>
          )}
          
          {/* Ligne qui relie les deux points - vérification des valeurs */}
          {userLocation && prestataire && prestataire.location && 
           typeof userLocation.latitude === 'number' && 
           typeof userLocation.longitude === 'number' &&
           typeof prestataire.location.latitude === 'number' && 
           typeof prestataire.location.longitude === 'number' && (
            <Polyline
              coordinates={[
                { 
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude
                },
                { 
                  latitude: prestataire.location.latitude,
                  longitude: prestataire.location.longitude
                }
              ]}
              strokeColor="#3478F6"
              strokeWidth={3}
              lineDashPattern={[1, 3]}
            />
          )}
        </MapView>
        
        {/* Badge de statut en haut à gauche */}
        <View style={styles.statusOverlay}>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text variant="caption" weight="semibold" style={styles.statusText}>
              {job.tracking_status === TrackingStatus.NOT_STARTED && 'En attente'}
              {job.tracking_status === TrackingStatus.EN_ROUTE && 'Prestataire en route'}
              {job.tracking_status === TrackingStatus.ARRIVED && 'Prestataire arrivé'}
              {job.tracking_status === TrackingStatus.IN_PROGRESS && 'Mission en cours'}
              {job.tracking_status === TrackingStatus.COMPLETED && 'Mission terminée'}
            </Text>
          </View>
        </View>
        
        {/* Badge d'ETA flottant en bas à droite */}
        {job.tracking_status === TrackingStatus.EN_ROUTE && (
          <View style={styles.etaOverlay}>
            <View style={styles.etaBadgeEnhanced}>
              <Ionicons name="time" size={16} color="#FFFFFF" />
              <Text variant="body2" weight="semibold" color="light" style={styles.etaText}>
                Arrivée dans {eta || '15 min'}
              </Text>
            </View>
          </View>
        )}
        
        {/* Badge de distance flottant en bas à gauche */}
        <View style={styles.distanceOverlay}>
          <View style={styles.distanceBadge}>
            <Ionicons name="compass" size={16} color="#FFFFFF" />
            <Text variant="body2" weight="semibold" color="light" style={styles.etaText}>
              0.5 km
            </Text>
          </View>
        </View>
        
        {/* Bouton pour recentrer la carte */}
        <TouchableOpacity 
          style={styles.recenterButton}
          onPress={() => {
            Alert.alert("Carte", "La fonction de recentrage est temporairement désactivée.");
          }}
        >
          <Ionicons name="locate" size={22} color="#3478F6" />
        </TouchableOpacity>
      </View>
      
      <ScrollView showsVerticalScrollIndicator={false} style={styles.contentScroll}>
        {/* Carte d'information du prestataire */}
        <Card style={styles.providerCard} elevation="md">
          <View style={styles.providerHeader}>
            <Text variant="h6" weight="semibold" style={styles.sectionTitle}>
              Détails du prestataire
            </Text>
            <Badge 
              variant="info" 
              label={`#${job.id.substring(0, 6)}`} 
              size="sm"
              border
            />
          </View>
          
          <View style={styles.prestataireRow}>
            {prestataire.avatar ? (
              <Image 
                source={{ uri: prestataire.avatar }} 
                style={styles.enhancedAvatar}
              />
            ) : (
              <Avatar 
                size="xl"
                initials={prestataire.name ? prestataire.name.substring(0, 1).toUpperCase() : "P"}
                backgroundColor="#3478F6"
              />
            )}
            
            <View style={styles.enhancedProviderInfo}>
              <Text variant="h5" weight="semibold" style={styles.enhancedProviderName}>
                {prestataire.name || 'Jean Dupont'}
              </Text>
              
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color="#FFB800" />
                <Text variant="body2" style={styles.smallMarginLeft}>
                  {prestataire.reviewStats?.average_rating ? prestataire.reviewStats.average_rating.toFixed(1) : '4.8'}
                </Text>
                <Text variant="body2" color="text-secondary" style={styles.smallMarginLeft}>
                  ({prestataire.reviewStats?.review_count || 12} avis)
                </Text>
              </View>
              
              <View style={styles.providerStatusContainer}>
                <View style={styles.statusIndicator}>
                  {getStatusIcon(job.tracking_status)}
                </View>
                <Text variant="body2" color="text-secondary" style={styles.smallMarginLeft}>
                  {job.tracking_status === TrackingStatus.NOT_STARTED && 'En attente de démarrage'}
                  {job.tracking_status === TrackingStatus.EN_ROUTE && `En route - Arrivée dans ${eta || '15 min'}`}
                  {job.tracking_status === TrackingStatus.ARRIVED && 'Arrivé à destination'}
                  {job.tracking_status === TrackingStatus.IN_PROGRESS && 'Prestation en cours'}
                  {job.tracking_status === TrackingStatus.COMPLETED && 'Prestation terminée'}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.providerActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('Chat', { jobId: job.id })}
            >
              <View style={styles.actionIconBg}>
                <Ionicons name="chatbubble" size={18} color="#FFFFFF" />
              </View>
              <Text variant="body2" weight="medium" style={styles.actionText}>
                Contacter
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => Alert.alert('Appel', 'Fonctionnalité d\'appel disponible prochainement')}
            >
              <View style={[styles.actionIconBg, styles.callIcon]}>
                <Ionicons name="call" size={18} color="#FFFFFF" />
              </View>
              <Text variant="body2" weight="medium" style={styles.actionText}>
                Appeler
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
        
        {/* Carte de détails du trajet */}
        <Card style={styles.journeyCard} elevation="md">
          <View style={styles.journeyHeader}>
            <Ionicons name="navigate-circle" size={22} color="#3478F6" />
            <Text variant="h6" weight="semibold" style={styles.journeyTitle}>
              Détails du trajet
            </Text>
          </View>
          
          <View style={styles.journeyDetails}>
            <View style={styles.journeyItem}>
              <View style={styles.journeyIconContainer}>
                <Ionicons name="location" size={18} color="#3478F6" />
              </View>
              <View style={styles.journeyItemContent}>
                <Text variant="body2" color="text-secondary">Adresse de départ</Text>
                <Text variant="body2" weight="medium">
                  {prestataire.location.address || "5 rue des Sablons, 75016 Paris"}
                </Text>
              </View>
            </View>
            
            <View style={styles.journeySeparator}>
              <View style={styles.journeyDashedLine} />
              <Ionicons name="arrow-down" size={16} color="#3478F6" />
              <View style={styles.journeyDashedLine} />
            </View>
            
            <View style={styles.journeyItem}>
              <View style={styles.journeyIconContainer}>
                <Ionicons name="home" size={18} color="#3478F6" />
              </View>
              <View style={styles.journeyItemContent}>
                <Text variant="body2" color="text-secondary">Adresse d'arrivée</Text>
                <Text variant="body2" weight="medium">
                  {userLocation.address || "74 bis rue Lauriston, 75016 Paris"}
                </Text>
              </View>
            </View>
            
            <View style={styles.journeyStats}>
              <View style={styles.journeyStat}>
                <Ionicons name="time" size={16} color="#3478F6" />
                <Text variant="body2" weight="medium" style={styles.journeyStatText}>
                  {eta || "15 min"}
                </Text>
              </View>
              
              <View style={styles.journeyStatSeparator} />
              
              <View style={styles.journeyStat}>
                <Ionicons name="resize" size={16} color="#3478F6" />
                <Text variant="body2" weight="medium" style={styles.journeyStatText}>
                  0.5 km
                </Text>
              </View>
            </View>
          </View>
        </Card>
        
        {/* Instructions et informations supplémentaires */}
        <Card style={[styles.card, styles.infoCard]} elevation="md">
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={22} color="#3478F6" />
            <Text variant="h6" weight="semibold" style={styles.infoTitle}>
              Informations
            </Text>
          </View>
          
          <View style={styles.infoContent}>
            <Text variant="body2" style={styles.infoText}>
              Vous recevrez une notification lorsque le prestataire arrivera à destination. 
              Veuillez rester disponible pour l'accueillir.
            </Text>
            
            <View style={styles.enhancedInfoItem}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              </View>
              <Text variant="body2">Prestataire vérifié et certifié</Text>
            </View>
            
            <View style={styles.enhancedInfoItem}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
              </View>
              <Text variant="body2">Assurance et garantie incluses</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
      
      {/* Boutons d'action */}
      <View style={styles.enhancedActionBar}>
        {job.tracking_status === TrackingStatus.ARRIVED && (
          <Button
            variant="success"
            label="Confirmer la fin de la mission"
            loading={submitting}
            onPress={() => handleStatusUpdate(TrackingStatus.COMPLETED)}
          />
        )}
        
        {job.tracking_status !== TrackingStatus.ARRIVED && (
          <Button
            variant="outline"
            label="Besoin d'aide"
            leftIcon={<Ionicons name="help-circle" size={20} color="#3478F6" />}
            onPress={() => Alert.alert('Assistance', 'Fonctionnalité d\'assistance disponible prochainement')}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  // Styles pour la carte en héros (plein écran)
  heroMapContainer: {
    width: '100%',
    height: 300,
    position: 'relative',
    ...SHADOWS.medium
  },
  heroMap: {
    width: '100%',
    height: '100%',
  },
  statusOverlay: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    zIndex: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    ...SHADOWS.small,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3478F6',
    marginRight: 6,
  },
  statusText: {
    color: '#3478F6',
  },
  etaOverlay: {
    position: 'absolute',
    bottom: SPACING.lg,
    right: SPACING.md,
    zIndex: 10,
  },
  etaBadgeEnhanced: {
    backgroundColor: 'rgba(52, 120, 246, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: BORDER_RADIUS.round,
    ...SHADOWS.medium,
  },
  etaText: {
    marginLeft: 4,
  },
  distanceOverlay: {
    position: 'absolute',
    bottom: SPACING.lg,
    left: SPACING.md,
    zIndex: 10,
  },
  distanceBadge: {
    backgroundColor: 'rgba(52, 120, 246, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: BORDER_RADIUS.round,
    ...SHADOWS.medium,
  },
  recenterButton: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  contentScroll: {
    flex: 1,
    marginTop: -20,
  },
  // Carte du prestataire améliorée
  providerCard: {
    margin: SPACING.md,
    marginTop: 30,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.medium,
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    color: '#3478F6',
  },
  enhancedAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#3478F6",
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...SHADOWS.small,
  },
  enhancedProviderInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  enhancedProviderName: {
    color: '#3478F6',
    marginBottom: 4,
  },
  providerStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  statusIndicator: {
    width: 24,
    height: 24,
  },
  providerActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.sm,
    flex: 1,
  },
  actionIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3478F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    ...SHADOWS.small,
  },
  callIcon: {
    backgroundColor: '#4CAF50',
  },
  actionText: {
    color: '#444444',
    marginTop: 4,
  },
  // Carte de détails du trajet
  journeyCard: {
    margin: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.medium,
  },
  journeyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  journeyTitle: {
    marginLeft: SPACING.sm,
    color: '#3478F6',
  },
  journeyDetails: {
    paddingHorizontal: SPACING.xs,
  },
  journeyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  journeyIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  journeyItemContent: {
    flex: 1,
  },
  journeySeparator: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingLeft: 17,
    marginVertical: 4,
  },
  journeyDashedLine: {
    width: 1,
    height: 12,
    backgroundColor: '#CCCCCC',
  },
  journeyStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  journeyStat: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  journeyStatText: {
    marginLeft: 8,
    color: '#3478F6',
  },
  journeyStatSeparator: {
    width: 1,
    height: 20,
    backgroundColor: '#DDDDDD',
  },
  // Carte d'informations
  infoCard: {
    margin: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.medium,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  infoTitle: {
    marginLeft: SPACING.sm,
    color: '#3478F6',
  },
  enhancedInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  infoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3478F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  // Barre d'actions améliorée
  enhancedActionBar: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    ...SHADOWS.top,
  },
  // Marqueurs personnalisés
  clientMarker: {
    backgroundColor: '#22C55E',
    borderRadius: BORDER_RADIUS.round,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...SHADOWS.small,
  },
  prestataireMarker: {
    backgroundColor: '#3478F6',
    borderRadius: BORDER_RADIUS.round,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...SHADOWS.small,
  },
  // Styles d'espacement
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
  
  // Anciens styles conservés pour compatibilité
  headerContainer: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
  },
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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
  card: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md
  },
  prestataireRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  customAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#9C27B0",
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
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
  }
});

export default TrackingScreen;