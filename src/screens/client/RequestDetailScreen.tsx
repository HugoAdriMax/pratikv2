import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
  SafeAreaView,
  Dimensions,
  Animated,
  TextInput
} from 'react-native';
import { getRequestById, getOffersByRequestId, acceptOffer, getJobByOfferId, getUserReviewStats, createReview } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { initPaymentSheet, openPaymentSheet } from '../../services/stripe/stripeService';
import { Request, Offer, RequestStatus, TrackingStatus, UserLocation } from '../../types';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Card, Button, Badge, Avatar } from '../../components/ui';
import { LogBox } from 'react-native';
import supabase from '../../config/supabase';

// Carte désactivée pour résoudre les problèmes de rendu
// import MapView, { Marker, Polyline } from 'react-native-maps';
import { 
  calculateDistance, 
  updateUserLocation,
  subscribeToUserLocation,
  calculateETA,
  getUserLocation,
  getClientAddressFromRequest
} from '../../services/location';

// Ignorer certaines erreurs non critiques
LogBox.ignoreLogs(['Text strings must be rendered within a <Text> component']);

const { width } = Dimensions.get('window');

const RequestDetailScreen = ({ route, navigation }: any) => {
  // Vérification de sécurité pour route.params (évite écran blanc)
  let requestId;
  try {
    requestId = route.params?.requestId;
    if (!requestId) {
      console.error('ID de demande manquant');
      Alert.alert('Erreur', 'ID de demande manquant');
    }
  } catch (err) {
    console.error('Erreur lors de la récupération de l\'ID:', err);
  }
  
  // Référence à la carte pour animer la caméra
  const mapRef = useRef<MapView | null>(null);
  
  const [request, setRequest] = useState<Request | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [job, setJob] = useState<any>(null);
  const [acceptedOfferId, setAcceptedOfferId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  // États pour le suivi en temps réel
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  }>({
    latitude: 48.8683356,
    longitude: 2.288925,
    address: "74 bis rue Lauriston, 75016 Paris"
  });
  
  const [prestataire, setPrestataire] = useState<{
    id: string;
    name: string;
    avatar?: string;
    location: {
      latitude: number;
      longitude: number;
      address?: string;
      photo?: string;
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
  
  const [eta, setEta] = useState<string | null>(null);

  useEffect(() => {
    fetchRequestDetails();
  }, [requestId]);
  
  // Effet pour rafraîchir les détails quand l'écran gagne le focus ou quand les paramètres de route changent
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('RequestDetailScreen est de nouveau en focus - rafraîchissement des données');
      fetchRequestDetails();
    });

    return unsubscribe;
  }, [navigation]);
  
  // Effet pour réagir au paramètre hasBeenReviewed
  // Vérifier l'état de révision au chargement et à chaque focus
  useEffect(() => {
    if (route.params?.hasBeenReviewed) {
      console.log('Paramètre hasBeenReviewed détecté - màj du statut de la demande');
      // Mettre à jour l'état local sans refaire de requête
      setRequest(prev => prev ? {...prev, is_reviewed: true} : null);
      
      // Modifier les paramètres pour éviter une détection répétée
      // du même paramètre lors des navigations futures
      navigation.setParams({
        requestId: route.params.requestId,
        hasBeenReviewed: undefined
      });
    }
  }, [route.params?.hasBeenReviewed, navigation]);
  
  // Effet pour configurer le suivi en temps réel si nécessaire
  useEffect(() => {
    // On vérifie si le statut est "en_route" ou "arrived" pour activer le suivi
    if (request && 
        (request.prestataire_status === TrackingStatus.EN_ROUTE || 
         request.prestataire_status === TrackingStatus.ARRIVED)) {
      
      // Configurer le suivi en temps réel
      const setupLocationTracking = async () => {
        const { user } = await supabase.auth.getSession();
        if (!user || !user.user) return;
        
        console.log("Configuration du suivi de localisation pour ce client");
        
        // Récupérer l'adresse du client depuis la demande
        if (request && request.location) {
          try {
            const clientLocation = {
              latitude: request.location.latitude,
              longitude: request.location.longitude,
              address: request.location.address
            };
            
            console.log("Adresse du client récupérée depuis la demande:", clientLocation);
            setUserLocation(clientLocation);
            
            // Mettre à jour la position du client dans la base de données pour référence
            await updateUserLocation(user.user.id, clientLocation);
          } catch (error) {
            console.error("Erreur lors de la mise à jour de l'adresse client:", error);
          }
        }
        
        // Récupérer les informations sur le prestataire accepté
        const acceptedOffer = offers.find(o => o.status === 'accepted');
        if (acceptedOffer && acceptedOffer.prestataire_id) {
          // Récupérer les informations du prestataire
          try {
            console.log("ID du prestataire à rechercher:", acceptedOffer.prestataire_id);
            
            // IMPORTANT: On utilise directement l'offre acceptée qui contient déjà les champs
            // prestataire_name et prestataire_profile_picture
            console.log("Informations complètes de l'offre acceptée:", acceptedOffer);
            
            const { data: prestataireInfo } = await supabase
              .from('users')
              .select('id, email, name, profile_picture, profile_picture_base64')
              .eq('id', acceptedOffer.prestataire_id)
              .single();
            
            // Récupérer les statistiques de reviews du prestataire
            const reviewStats = await getUserReviewStats(acceptedOffer.prestataire_id);
            
            // Récupérer la position réelle du prestataire
            const prestataireLocation = await getUserLocation(acceptedOffer.prestataire_id);
            
            // Récupérer la photo du prestataire complète
            console.log("Photo du prestataire (valeurs complètes):", {
              base64: prestataireInfo?.profile_picture_base64 ? prestataireInfo?.profile_picture_base64.substring(0, 30) + "..." : "absente",
              url: prestataireInfo?.profile_picture || "absente"
            });
            
            // Utiliser le vrai nom et la vraie photo du prestataire
            console.log("Offre complète avec prestataire_profile_picture:", 
                       acceptedOffer.prestataire_profile_picture ? "présent" : "absent");
            
            // Utiliser le vrai nom du prestataire
            const prestataireRealName = prestataireInfo?.name || 
                                        acceptedOffer.prestataire_name || 
                                        "Prestataire";
            
            // Utiliser la vraie photo du prestataire
            const prestataireRealPicture = prestataireInfo?.profile_picture_base64 || 
                                           prestataireInfo?.profile_picture || 
                                           acceptedOffer.prestataire_profile_picture;
            
            console.log("Vrai nom du prestataire:", prestataireRealName);
            console.log("Vraie photo utilisée:", prestataireRealPicture ? "présente" : "absente");
            
            setPrestataire({
              id: acceptedOffer.prestataire_id,
              name: prestataireRealName,
              avatar: prestataireRealPicture || 
                      "https://randomuser.me/api/portraits/men/1.jpg",
              location: {
                ...(prestataireLocation || {
                  latitude: 48.8639, // Position par défaut
                  longitude: 2.2870
                }),
                photo: prestataireInfo?.profile_picture_base64 || 
                       prestataireInfo?.profile_picture ||
                       "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"
              },
              reviewStats: {
                average_rating: reviewStats?.average_rating || 0,
                review_count: reviewStats?.review_count || 0
              }
            });
            
            // S'abonner aux mises à jour de position du prestataire en temps réel
            const unsubscribe = subscribeToUserLocation(acceptedOffer.prestataire_id, (updatedLocation: UserLocation) => {
              if (!updatedLocation) return;
              
              // Vérifier et extraire les coordonnées
              if (typeof updatedLocation.latitude === 'number' && typeof updatedLocation.longitude === 'number') {
                console.log(`Nouvelles coordonnées du prestataire: lat=${updatedLocation.latitude}, long=${updatedLocation.longitude}`);
                
                // Mettre à jour l'état avec la nouvelle position
                setPrestataire(prev => {
                  if (!prev) return prev;
                  
                  // Adresse par défaut si null
                  const prestataireAddress = updatedLocation.address || "Position du prestataire";
                  
                  return {
                    ...prev,
                    location: {
                      ...prev.location,
                      latitude: updatedLocation.latitude,
                      longitude: updatedLocation.longitude,
                      address: prestataireAddress,
                      // Conserver la photo existante
                      photo: prev.location.photo
                    }
                  };
                });
                
                // Log pour déboguer la conservation de la photo
                if (prestataire && prestataire.avatar) {
                  console.log("Photo du prestataire après mise à jour de position:", {
                    avatar: prestataire.avatar.substring(0, 30) + "...",
                    locationPhoto: prestataire.location.photo ? prestataire.location.photo.substring(0, 30) + "..." : "absent"
                  });
                }
                
                // Mettre à jour le temps d'arrivée estimé si le prestataire est en route
                if (userLocation && request.prestataire_status === TrackingStatus.EN_ROUTE) {
                  const distanceValue = calculateDistance(
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
              }
            });
            
            // Retourner la fonction de nettoyage
            return () => {
              if (unsubscribe) {
                unsubscribe();
              }
            };
          } catch (error) {
            console.error("Erreur lors de la configuration du suivi:", error);
          }
        }
      };
      
      // Exécuter la fonction de configuration
      const cleanup = setupLocationTracking();
      
      // Nettoyer à la sortie
      return () => {
        if (cleanup && typeof cleanup === 'function') {
          cleanup();
        }
      };
    }
  }, [request, offers]);

  const fetchRequestDetails = async () => {
    try {
      setLoading(true);
      
      // Vérifier si requestId existe
      if (!requestId) {
        console.error('ID de demande manquant');
        Alert.alert('Erreur', 'Impossible de charger les détails - ID manquant');
        setLoading(false);
        return;
      }
      
      // Récupérer les détails de la demande
      const requestData = await getRequestById(requestId);
      setRequest(requestData);
      
      // Si la demande a des offres, les récupérer
      if (requestData.status === RequestStatus.OFFERED || 
          requestData.status === RequestStatus.ACCEPTED) {
        const offersData = await getOffersByRequestId(requestId);
        setOffers(offersData);
      }
    } catch (error) {
      console.error('Error fetching request details:', error);
      Alert.alert('Erreur', 'Impossible de récupérer les détails de la demande');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async (offerId: string, price: number) => {
    try {
      setAccepting(true);
      
      // Vérifier que nous avons toutes les informations nécessaires
      if (!request?.client_id) {
        throw new Error("Information client manquante");
      }
      
      const prestataireId = offers.find(o => o.id === offerId)?.prestataire_id;
      if (!prestataireId) {
        throw new Error("Information prestataire manquante");
      }
      
      // 1. Initialiser le paiement Stripe avant d'accepter l'offre
      console.log(`Initialisation du paiement Stripe pour l'offre ${offerId} avec:`, {
        price,
        clientId: request.client_id,
        prestataireId
      });
        
      const { paymentSheetEnabled } = await initPaymentSheet(
        offerId,
        price,
        request.client_id,
        prestataireId
      );
      
      if (!paymentSheetEnabled) {
        throw new Error("Impossible d'initialiser le module de paiement");
      }
      
      // 2. Ouvrir la feuille de paiement Stripe
      const { success, error } = await openPaymentSheet();
      
      if (!success) {
        throw new Error(error || "Le paiement a échoué");
      }
      
      // 3. Si le paiement réussit, accepter l'offre
      const jobData = await acceptOffer(offerId);
      
      // Stocker l'ID du job et l'ID de l'offre acceptée pour une utilisation ultérieure
      if (jobData) {
        if (jobData.jobId) {
          // Nouveau format - jobId directement dans la réponse
          console.log(`ID du job créé: ${jobData.jobId}`);
          setJob({ id: jobData.jobId });
        } else if (jobData.id) {
          // Ancien format
          setJob(jobData);
        }
      }
      setAcceptedOfferId(offerId);
      
      // 4. Mettre à jour l'état local
      setRequest(prev => prev ? { ...prev, status: RequestStatus.ACCEPTED } : null);
      
      // 5. Mettre à jour le statut des offres dans l'état local
      setOffers(prev => 
        prev.map(offer => ({
          ...offer,
          status: offer.id === offerId ? 'accepted' : 'rejected'
        }))
      );
      
      // 6. Montrer un message de succès sans redirection automatique
      Alert.alert(
        'Paiement effectué avec succès !',
        'Votre prestataire a été notifié et vous contactera pour confirmer son arrivée. Vous pourrez suivre sa position en temps réel lorsqu\'il sera en route.',
        [
          { 
            text: 'OK',
            onPress: () => {} // Ne redirige pas automatiquement
          }
        ]
      );
    } catch (error) {
      console.error('Error during payment or accepting offer:', error);
      
      // Afficher l'erreur exacte pour mieux diagnostiquer les problèmes
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Impossible de finaliser le paiement ou d\'accepter l\'offre';
      
      Alert.alert(
        'Erreur lors du paiement', 
        errorMessage
      );
    } finally {
      setAccepting(false);
    }
  };

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getServiceIcon = (serviceId: string) => {
    // Convert serviceId to a readable service name (in a real app, you'd look up the real name)
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
  
  // Composant pour afficher le suivi en temps réel (version visuelle sans carte)
  const TrackingMapView = () => {
    // États pour les animations
    const [pulseAnim] = useState(new Animated.Value(1));
    
    // États locaux pour stocker les infos du prestataire
    const [prestatairePhoto, setPrestatairePhoto] = useState<string | null>(null);
    const [prestataireName, setPrestataireName] = useState<string | null>(null);
    
    // Récupérer directement les infos du prestataire à partir de l'offre acceptée
    useEffect(() => {
      const loadPrestataireInfo = async () => {
        try {
          // Trouver l'offre acceptée
          const acceptedOffer = offers.find(o => o.status === 'accepted');
          if (!acceptedOffer) return;
          
          console.log("Photo depuis l'offre acceptée:", 
                     acceptedOffer.prestataire_profile_picture ? "présente" : "absente");
          
          // Récupérer les infos complètes du prestataire
          const { data: prestataireInfo } = await supabase
            .from('users')
            .select('name, profile_picture, profile_picture_base64')
            .eq('id', acceptedOffer.prestataire_id)
            .single();
          
          // Définir la photo dans l'ordre de priorité
          const photo = prestataireInfo?.profile_picture_base64 || 
                       prestataireInfo?.profile_picture ||
                       acceptedOffer.prestataire_profile_picture;
          
          if (photo) {
            console.log("Photo trouvée pour affichage:", photo.substring(0, 30) + "...");
            setPrestatairePhoto(photo);
          }
          
          // Définir le nom du prestataire dans l'ordre de priorité
          const name = prestataireInfo?.name || 
                      acceptedOffer.prestataire_name || 
                      "Prestataire";
          
          if (name) {
            console.log("Nom trouvé pour affichage:", name);
            setPrestataireName(name);
          }
        } catch (error) {
          console.error("Erreur lors de la récupération des infos prestataire:", error);
        }
      };
      
      loadPrestataireInfo();
    }, [offers]);
    
    // Effet pour l'animation du pulse
    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, []);
    
    // Si on n'a pas les coordonnées nécessaires, montrer un message de chargement
    if (!userLocation || !prestataire || !prestataire.location) {
      return (
        <Card style={styles.trackingCardEnhanced} elevation="md">
          <View style={styles.trackingHeaderEnhanced}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.loadingText}>Chargement du suivi en temps réel...</Text>
            </View>
          </View>
        </Card>
      );
    }
    
    // Calcul de la distance
    const distance = calculateDistance(
      userLocation,
      prestataire.location
    ).toFixed(1);
    
    // Vérifier l'état du prestataire pour adapter l'UI
    const isEnRoute = request?.prestataire_status === TrackingStatus.EN_ROUTE;
    const isArrived = request?.prestataire_status === TrackingStatus.ARRIVED;
    
    // Log pour le débogage des infos dans l'état en route/arrivé
    console.log("Infos disponibles dans TrackingMapView:", {
      prestataireNom: prestataireName,
      prestataireNomDefault: prestataire.name,
      prestatairePhoto: prestatairePhoto ? "présente" : "absente",
      avatar: prestataire.avatar ? "présente" : "absente",
      locationPhoto: prestataire.location.photo ? "présente" : "absente",
      status: request.prestataire_status
    });
    
    return (
      <Card style={styles.trackingCardEnhanced} elevation="md">
        {/* Header attrayant avec statut */}
        <View style={[
          styles.trackingHeaderEnhanced,
          isEnRoute ? styles.headerRoute : styles.headerArrived
        ]}>
          <View style={styles.statusPillEnhanced}>
            <Animated.View 
              style={[
                styles.statusDotEnhanced,
                isEnRoute ? styles.statusDotBlue : styles.statusDotPurple,
                isEnRoute && { transform: [{ scale: pulseAnim }] }
              ]} 
            />
            <Text variant="body1" weight="semibold" style={styles.statusTextEnhanced}>
              {isEnRoute ? 'Prestataire en route' : 'Prestataire arrivé'}
            </Text>
          </View>
        </View>
        
        {/* Interface moderne de suivi sans carte */}
        <View style={styles.modernTrackingContainer}>
          {/* Carte en haut */}
          <View style={styles.modernTrackingCard}>
            <View style={styles.modernCardHeader}>
              <Animated.View style={[
                styles.pulseDot,
                { transform: [{ scale: pulseAnim }] }
              ]}>
                <Ionicons name="navigate" size={16} color="#FFFFFF" />
              </Animated.View>
              <Text style={styles.modernLocationTitle}>
                {isEnRoute ? "Prestataire en route" : "Prestataire arrivé"}
              </Text>
            </View>
            
            <View style={styles.modernAddressRow}>
              <Ionicons name="location" size={18} color={isEnRoute ? "#3478F6" : "#4CAF50"} />
              <Text style={styles.modernAddressText}>
                {request.location?.address || userLocation.address || "Votre adresse"}
              </Text>
            </View>
            
            <View style={styles.modernDetailsRow}>
              <View style={styles.modernDetailItem}>
                <Ionicons name="speedometer-outline" size={24} color={COLORS.textSecondary} />
                <View style={styles.modernDetailTextContainer}>
                  <Text style={styles.modernDetailLabel}>Distance</Text>
                  <Text style={styles.modernDetailValue}>{distance} km</Text>
                </View>
              </View>
              
              <View style={[styles.modernSeparator]} />
              
              <View style={styles.modernDetailItem}>
                <Ionicons name="time-outline" size={24} color={COLORS.textSecondary} />
                <View style={styles.modernDetailTextContainer}>
                  <Text style={styles.modernDetailLabel}>Temps d'arrivée</Text>
                  <Text style={[
                    styles.modernDetailValue,
                    { color: isEnRoute ? COLORS.primary : COLORS.success }
                  ]}>
                    {isEnRoute ? (eta || "15-20 min") : "Arrivé"}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          
          {/* Carte prestataire */}
          <View style={styles.modernPrestataireCard}>
            <View style={styles.modernPrestataireInfo}>
              {/* Utiliser l'image réelle du prestataire */}
              <Image 
                source={
                  prestatairePhoto 
                  ? { uri: prestatairePhoto }
                  : prestataire.avatar 
                  ? { uri: prestataire.avatar }
                  : prestataire.location.photo 
                  ? { uri: prestataire.location.photo }
                  : require('../../../assets/default-avatar.png')
                } 
                style={styles.modernPrestataireAvatar} 
              />
              
              <View style={styles.modernPrestataireDetails}>
                <Text style={styles.modernPrestataireName}>
                {prestataireName || prestataire.name || "Prestataire"}
              </Text>
                <View style={styles.modernRatingContainer}>
                  <Ionicons name="star" size={14} color="#FFB100" />
                  <Text style={styles.modernRatingText}>
                    {prestataire.reviewStats?.average_rating?.toFixed(1) || "4.8"} 
                    <Text style={styles.modernReviewCount}>
                      ({prestataire.reviewStats?.review_count || "42"} avis)
                    </Text>
                  </Text>
                </View>
              </View>
              
              <View style={[
                styles.modernStatusBadge,
                isEnRoute ? styles.statusBadgeRoute : styles.statusBadgeArrived
              ]}>
                <Ionicons 
                  name={isEnRoute ? "car-outline" : "checkmark-circle"} 
                  size={14} 
                  color="#FFFFFF" 
                />
                <Text style={styles.modernStatusText}>
                  {isEnRoute ? "En route" : "Arrivé"}
                </Text>
              </View>
            </View>
            
            <View style={styles.modernDirectionInfo}>
              <View style={styles.modernDirectionItem}>
                <View style={styles.modernDirectionTopRow}>
                  <Ionicons 
                    name="navigate-circle-outline" 
                    size={20} 
                    color={isEnRoute ? "#3478F6" : "#4CAF50"} 
                  />
                  <Text style={styles.modernDirectionText}>
                    {isEnRoute 
                      ? `À ${distance} km - Arrivée estimée dans ${eta || "15-20 min"}`
                      : "Le prestataire est arrivé à destination"
                    }
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
        
        {/* Infos de suivi améliorées */}
        <View style={styles.infoContainerEnhanced}>
          <View style={styles.infoRowEnhanced}>
            {/* Carte pour la distance */}
            <View style={styles.infoCardEnhanced}>
              <View style={[
                styles.infoIconContainerEnhanced,
                isEnRoute ? styles.iconBlue : styles.iconGreen
              ]}>
                <Ionicons name="speedometer" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.infoLabelEnhanced}>Distance</Text>
              <Text style={styles.infoValueEnhanced}>{distance} km</Text>
            </View>
            
            {/* Carte pour l'heure d'arrivée */}
            <View style={styles.infoCardEnhanced}>
              <View style={[
                styles.infoIconContainerEnhanced,
                isEnRoute ? styles.iconBlue : styles.iconGreen
              ]}>
                <Ionicons 
                  name={isEnRoute ? "time" : "checkmark-circle"} 
                  size={24} 
                  color="#FFFFFF" 
                />
              </View>
              <Text style={styles.infoLabelEnhanced}>
                {isEnRoute ? "Arrivée dans" : "Arrivé"}
              </Text>
              <Text style={[
                styles.infoValueEnhanced,
                isArrived && {color: COLORS.success}
              ]}>
                {isEnRoute ? (eta || "15-20 min") : "Maintenant"}
              </Text>
            </View>
          </View>
        </View>
        
        {/* Instructions plus détaillées */}
        <View style={styles.instructionsContainerEnhanced}>
          <View style={styles.instructionsHeader}>
            <Ionicons 
              name={isEnRoute ? "information-circle" : "checkmark-circle"} 
              size={24} 
              color={isEnRoute ? COLORS.primary : COLORS.success} 
            />
            <Text style={styles.instructionsTitle}>
              {isEnRoute ? "Informations" : "Prestataire sur place"}
            </Text>
          </View>
          
          <Text style={styles.instructionsTextEnhanced}>
            {isEnRoute 
              ? "Votre prestataire est en route vers votre domicile. Vous pouvez le contacter via le bouton ci-dessous si nécessaire. Vous serez notifié à son arrivée." 
              : "Votre prestataire est arrivé à destination. Vérifiez qu'il s'agit bien de votre prestataire avant de lui ouvrir. Vous pouvez également le contacter via le bouton ci-dessous."}
          </Text>
          
          {/* Bouton pour contacter le prestataire */}
          <TouchableOpacity 
            style={styles.contactPrestataireButton}
            onPress={() => {
              // Trouver l'offre acceptée pour obtenir l'ID du job ou de l'offre
              const acceptedOffer = offers.find(o => o.status === 'accepted');
              
              if (job && job.id) {
                navigation.navigate('Chat', { jobId: job.id });
              } else if (acceptedOffer && acceptedOffer.id) {
                navigation.navigate('Chat', { offerId: acceptedOffer.id });
              } else {
                Alert.alert("Messagerie", "Impossible d'accéder à la messagerie pour le moment.");
              }
            }}
          >
            <Ionicons name="chatbubble-ellipses" size={18} color={COLORS.white} />
            <Text style={styles.contactButtonText}>
              Contacter le prestataire
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };
  
  // Composant pour le badge de statut
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

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!request) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIconContainer}>
          <Ionicons name="alert-circle-outline" size={60} color={COLORS.textSecondary} />
        </View>
        <Text variant="h4" color="text-secondary">Demande introuvable</Text>
        <Button
          variant="primary"
          label="Retour"
          style={styles.marginTop}
          onPress={() => navigation.goBack()}
        />
      </View>
    );
  }

  const badgeProps = getStatusBadgeProps(request);
  const serviceIcon = getServiceIcon(request.service_id);
  
  // Vérifier si le prestataire est en route ou arrivé pour afficher la carte de suivi
  const showTracking = request.prestataire_status === TrackingStatus.EN_ROUTE || 
                       request.prestataire_status === TrackingStatus.ARRIVED;
  
  // Pour débugger la photo du prestataire
  console.log("Données du prestataire (état actuel):", {
    nom: prestataire.name,
    avatar: prestataire.avatar ? prestataire.avatar.substring(0, 30) + "..." : "absent",
    locationPhoto: prestataire.location.photo ? prestataire.location.photo.substring(0, 30) + "..." : "absent",
    status: request.prestataire_status
  });

  // Composants spécifiques par statut
  // Composant pour afficher le service en cours
  const ServiceInProgressView = () => {
    // États locaux pour le statut "service en cours"
    const [serviceInProgressPhoto, setServiceInProgressPhoto] = useState<string | null>(null);
    const [serviceInProgressName, setServiceInProgressName] = useState<string | null>(null);
    // État pour stocker l'ID du prestataire - utile pour l'évaluation plus tard
    const [serviceInProgressPrestataireId, setServiceInProgressPrestataireId] = useState<string | null>(null);
    
    // Récupérer les infos du prestataire comme dans TrackingMapView
    useEffect(() => {
      const loadPrestataireInfoForService = async () => {
        try {
          const acceptedOffer = offers.find(o => o.status === 'accepted');
          if (!acceptedOffer) return;
          
          console.log("SERVICE EN COURS: Photo depuis l'offre acceptée:", 
                     acceptedOffer.prestataire_profile_picture ? "présente" : "absente");
          
          // Stocker l'ID du prestataire pour référence
          if (acceptedOffer.prestataire_id) {
            setServiceInProgressPrestataireId(acceptedOffer.prestataire_id);
          }
          
          // Récupérer les infos complètes du prestataire
          const { data: prestataireInfo } = await supabase
            .from('users')
            .select('id, name, profile_picture, profile_picture_base64')
            .eq('id', acceptedOffer.prestataire_id)
            .single();
          
          // Stocker l'ID du prestataire également depuis les infos récupérées
          if (prestataireInfo?.id) {
            setServiceInProgressPrestataireId(prestataireInfo.id);
          }
          
          // Définir la photo dans l'ordre de priorité
          const photo = prestataireInfo?.profile_picture_base64 || 
                       prestataireInfo?.profile_picture ||
                       acceptedOffer.prestataire_profile_picture;
          
          if (photo) {
            console.log("SERVICE EN COURS: Photo trouvée:", photo.substring(0, 30) + "...");
            setServiceInProgressPhoto(photo);
          }
          
          // Définir le nom du prestataire dans l'ordre de priorité
          const name = prestataireInfo?.name || 
                      acceptedOffer.prestataire_name || 
                      "Prestataire";
          
          if (name) {
            console.log("SERVICE EN COURS: Nom trouvé:", name);
            setServiceInProgressName(name);
          }
        } catch (error) {
          console.error("SERVICE EN COURS: Erreur lors de la récupération des infos prestataire:", error);
        }
      };
      
      loadPrestataireInfoForService();
    }, [offers]);
    
    return (
      <Card style={styles.progressCard} elevation="md">
        <View style={styles.progressHeaderGradient}>
          <View style={styles.progressHeaderContent}>
            <View style={styles.progressIconContainer}>
              <Ionicons name="construct" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.progressHeaderTextContainer}>
              <Text style={styles.progressHeaderTitle}>
                Service en cours
              </Text>
              <Text style={styles.progressHeaderSubtitle}>
                Travail en cours chez vous
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.prestataireProgressInfoContainer}>
          {/* Affichage du prestataire avec sa photo réelle - exactement comme dans TrackingMapView */}
          <View style={styles.prestataireProgressCard}>
            <Image 
              source={
                serviceInProgressPhoto 
                ? { uri: serviceInProgressPhoto }
                : prestataire?.avatar 
                ? { uri: prestataire.avatar }
                : prestataire?.location?.photo 
                ? { uri: prestataire.location.photo }
                : require('../../../assets/default-avatar.png')
              } 
              style={[
                styles.prestataireProgressAvatar,
                { 
                  backgroundColor: '#F0F0F0',  // Fond pour éviter les images transparentes
                  resizeMode: 'cover'          // Assurer que l'image couvre tout l'espace
                }
              ]} 
            />
            <View style={styles.prestataireProgressInfo}>
              <Text style={styles.prestataireProgressName}>
                {serviceInProgressName || prestataire?.name || "Prestataire"}
              </Text>
              <View style={styles.prestataireProgressStatus}>
                <View style={styles.statusDotPulse} />
                <Text style={styles.prestataireStatusText}>Travail en cours</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.progressDetailsCard}>
            <View style={styles.progressDetailsRow}>
              <Ionicons name="time-outline" size={22} color={COLORS.warning} style={styles.progressDetailIcon} />
              <Text style={styles.progressDetailText}>
                L'intervention est en cours à votre domicile
              </Text>
            </View>
            
            <View style={styles.progressDetailsRow}>
              <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.success} style={styles.progressDetailIcon} />
              <Text style={styles.progressDetailText}>
                Vous serez notifié(e) lorsque le travail sera terminé
              </Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.contactPrestataireProgressButton}
            onPress={() => {
              if (job && job.id) {
                navigation.navigate('Chat', { jobId: job.id });
              } else {
                const acceptedOffer = offers.find(o => o.status === 'accepted');
                if (acceptedOffer && acceptedOffer.id) {
                  navigation.navigate('Chat', { offerId: acceptedOffer.id });
                } else if (acceptedOfferId) {
                  navigation.navigate('Chat', { offerId: acceptedOfferId });
                } else {
                  Alert.alert("Messagerie", "Impossible d'accéder à la messagerie pour le moment.");
                }
              }
            }}
          >
            <Ionicons name="chatbubble-ellipses" size={18} color={COLORS.white} />
            <Text style={styles.contactProgressButtonText}>
              Contacter le prestataire
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };
  
  const PendingRequestView = () => (
    <Card style={[styles.card, styles.statusCard]} elevation="md">
      <View style={styles.statusHeaderContainer}>
        <View style={styles.statusIconContainer}>
          <Ionicons name="time" size={32} color="#FFFFFF" />
        </View>
        <Text variant="h4" weight="semibold" style={styles.statusTitle}>
          Demande en attente
        </Text>
      </View>
      
      <View style={styles.pendingAnimation}>
        <View style={styles.pendingIconContainer}>
          <Ionicons name="search" size={32} color={COLORS.white} />
        </View>
        <View style={styles.pulseContainer}>
          <View style={[styles.pulseCircle, styles.pulse1]} />
          <View style={[styles.pulseCircle, styles.pulse2]} />
          <View style={[styles.pulseCircle, styles.pulse3]} />
        </View>
      </View>
      
      <Text style={styles.statusDescription}>
        Nous contactons les prestataires disponibles près de chez vous.
        Vous recevrez bientôt une ou plusieurs offres.
      </Text>
      
      <View style={styles.pendingInfoContainer}>
        <View style={styles.pendingInfoItem}>
          <Ionicons name="notifications-outline" size={22} color={COLORS.primary} />
          <Text variant="body2" style={styles.pendingInfoText}>
            Vous recevrez une notification dès qu'une offre sera disponible
          </Text>
        </View>
        
        <View style={styles.pendingInfoItem}>
          <Ionicons name="timer-outline" size={22} color={COLORS.primary} />
          <Text variant="body2" style={styles.pendingInfoText}>
            Le temps d'attente moyen est de 15 minutes
          </Text>
        </View>
      </View>
      
      <View style={styles.pendingTipContainer}>
        <Text variant="caption" style={styles.pendingTip}>
          Astuce: Plus votre demande contient de détails, plus vite un prestataire vous répondra!
        </Text>
      </View>
    </Card>
  );
  
  const OffersReceivedView = () => (
    <Card style={[styles.card, styles.enhancedOfferCard]} elevation="md">
      <View style={styles.enhancedCardHeader}>
        <View style={styles.enhancedHeaderLeft}>
          <Ionicons name="star" size={28} color={COLORS.primary} />
          <Text variant="h4" weight="semibold" style={styles.marginLeft}>
            Offres disponibles
          </Text>
        </View>
        <Badge 
          variant="primary" 
          label={`${offers.length} offre${offers.length > 1 ? 's' : ''}`} 
          size="md"
          border
        />
      </View>
      
      <View style={styles.paymentInfoContainer}>
        <Ionicons name="shield-checkmark" size={22} color={COLORS.success} />
        <Text variant="body2" style={styles.paymentInfoText}>
          Le paiement sera débloqué uniquement après que vous ayez confirmé que les travaux sont terminés.
        </Text>
      </View>

      <View style={styles.separator} />
      
      {offers.map(offer => (
        <View key={offer.id} style={styles.enhancedOfferCard}>
          {/* Card supérieure avec profil prestataire et prix */}
          <View style={styles.premiumOfferCard}>
            <View style={styles.professionalHeader}>
              <View style={styles.leftHeaderContent}>
                {/* Avatar et badge de notation */}
                <View style={styles.avatarContainer}>
                  {offer.prestataire_profile_picture ? (
                    <Image 
                      source={{ uri: offer.prestataire_profile_picture }} 
                      style={styles.premiumAvatar}
                    />
                  ) : (
                    <View style={styles.premiumAvatarFallback}>
                      <Text style={styles.avatarInitial}>
                        {(offer.prestataire_name || "P")[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                
                {/* Nom et info prestataire */}
                <View style={styles.prestataireInfoContainer}>
                  <Text style={styles.prestataireName}>
                    {offer.prestataire_name || "Professionnel"}
                  </Text>
                  
                  <View style={styles.premiumVerifiedBadge}>
                    <Ionicons name="shield-checkmark" size={12} color={COLORS.primary} />
                    <Text style={styles.verifiedText}>Pro Vérifié</Text>
                  </View>
                  
                  <View style={styles.experienceContainer}>
                    <Ionicons name="time-outline" size={12} color={COLORS.textSecondary} />
                    <Text style={styles.experienceText}>3 ans d'expérience</Text>
                  </View>
                  
                  {/* Badge de notation placé sous les informations du prestataire */}
                  <View style={styles.reviewsContainer}>
                    <Ionicons name="star" size={14} color={COLORS.warning} />
                    <Text style={styles.ratingText}>
                      4.8 (124 avis)
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            
            {/* Séparateur */}
            <View style={styles.fancySeparator} />
            
            {/* Section prix corrigée pour éviter qu'elle sorte de la card */}
            <View style={styles.premiumPriceContainer}>
              <View style={styles.priceSection}>
                <Text style={styles.offerPriceLabel}>Prix proposé</Text>
                <View style={styles.priceWithTaxRow}>
                  <Text style={styles.offerPrice}>{offer.price}€</Text>
                  <Text style={styles.taxIncluded}>TTC</Text>
                </View>
              </View>
              
              <View style={styles.securityBadgeSingleContainer}>
                <View style={styles.securityBadge}>
                  <Ionicons name="shield-checkmark" size={14} color={COLORS.white} />
                  <Text style={styles.securityText}>Paiement sécurisé</Text>
                </View>
              </View>
            </View>
            
            {/* Compétences et spécialités */}
            <View style={styles.skillsContainer}>
              <Text style={styles.skillsLabel}>Spécialités</Text>
              <View style={styles.skillsTagsContainer}>
                <View style={[styles.skillTag, { backgroundColor: `${COLORS.primary}15` }]}>
                  <Text style={[styles.skillTagText, { color: COLORS.primary }]}>
                    {request.service_id.replace(/-/g, ' ').split(' ')[0]}
                  </Text>
                </View>
                <View style={[styles.skillTag, { backgroundColor: `${COLORS.accent}15` }]}>
                  <Text style={[styles.skillTagText, { color: COLORS.accent }]}>Urgences</Text>
                </View>
                <View style={[styles.skillTag, { backgroundColor: `${COLORS.success}15` }]}>
                  <Text style={[styles.skillTagText, { color: COLORS.success }]}>Disponible</Text>
                </View>
              </View>
            </View>
          </View>
          
          <View style={styles.offerDescription}>
            <Text variant="body2" color="text-secondary" style={styles.offerDescriptionText}>
              Ce professionnel est disponible pour effectuer votre demande rapidement. 
              En acceptant cette offre, vous bénéficiez de notre garantie qualité et paiement sécurisé.
            </Text>
          </View>
          
          <View style={styles.enhancedOfferActions}>
            {offer.status === 'rejected' ? (
              <View style={styles.rejectedContainer}>
                <Ionicons name="close-circle" size={24} color={COLORS.danger} />
                <Text style={styles.rejectedText}>Offre refusée</Text>
              </View>
            ) : offer.status === 'accepted' ? (
              <View style={styles.acceptedOfferContainer}>
                <View style={styles.acceptedBadgeContainer}>
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                  <Text style={styles.acceptedText}>Offre acceptée</Text>
                </View>
                <Text style={styles.selectedProviderText}>
                  Prestataire sélectionné
                </Text>
                
                <TouchableOpacity 
                  style={styles.chatWithPrestataireButton}
                  onPress={() => {
                    if (job && job.id) {
                      navigation.navigate('Chat', { jobId: job.id });
                    } else if (offer.id) {
                      navigation.navigate('Chat', { offerId: offer.id });
                    } else {
                      Alert.alert("Messagerie", "Impossible d'accéder à la messagerie pour le moment.");
                    }
                  }}
                >
                  <Ionicons name="chatbubble-ellipses" size={18} color={COLORS.white} />
                  <Text style={{
                    color: COLORS.white,
                    fontWeight: 'bold',
                    fontSize: 14,
                    marginLeft: 6,
                  }}>
                    Contacter le prestataire
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Cas par défaut : offre en attente (pending)
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity 
                  style={styles.acceptButton}
                  onPress={() => handleAcceptOffer(offer.id, parseFloat(offer.price.toString()))}
                  disabled={accepting}
                >
                  {accepting ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={22} color={COLORS.white} />
                      <Text style={styles.acceptButtonText}>Accepter cette offre</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      ))}
    </Card>
  );
  
  const NotStartedTrackingView = () => {
    // États locaux pour stocker les infos du prestataire 
    const [prestatairePhoto, setPrestatairePhoto] = useState<string | null>(null);
    const [prestataireName, setPrestataireName] = useState<string | null>(null);
    
    // Récupérer les infos du prestataire comme dans les autres vues
    useEffect(() => {
      const loadPrestataireInfo = async () => {
        try {
          // Trouver l'offre acceptée
          const acceptedOffer = offers.find(o => o.status === 'accepted');
          if (!acceptedOffer) return;
          
          console.log("PRESTATAIRE EN PRÉPARATION: Photo depuis l'offre acceptée:", 
                     acceptedOffer.prestataire_profile_picture ? "présente" : "absente");
          
          // Récupérer les infos complètes du prestataire
          const { data: prestataireInfo } = await supabase
            .from('users')
            .select('name, profile_picture, profile_picture_base64')
            .eq('id', acceptedOffer.prestataire_id)
            .single();
          
          // Définir la photo dans l'ordre de priorité
          const photo = prestataireInfo?.profile_picture_base64 || 
                       prestataireInfo?.profile_picture ||
                       acceptedOffer.prestataire_profile_picture;
          
          if (photo) {
            console.log("PRESTATAIRE EN PRÉPARATION: Photo trouvée pour affichage:", photo.substring(0, 30) + "...");
            setPrestatairePhoto(photo);
          }
          
          // Définir le nom du prestataire dans l'ordre de priorité
          const name = prestataireInfo?.name || 
                      acceptedOffer.prestataire_name || 
                      "Prestataire";
          
          if (name) {
            console.log("PRESTATAIRE EN PRÉPARATION: Nom trouvé pour affichage:", name);
            setPrestataireName(name);
          }
        } catch (error) {
          console.error("Erreur lors de la récupération des infos prestataire:", error);
        }
      };
      
      loadPrestataireInfo();
    }, [offers]);
  
    return (
      <Card style={[styles.card, styles.statusCard]} elevation="md">
        <View style={styles.statusHeaderContainer}>
          <View style={[styles.statusIconContainer, { backgroundColor: COLORS.info }]}>
            <Ionicons name="information-circle" size={32} color="#FFFFFF" />
          </View>
          <Text variant="h4" weight="semibold" style={styles.statusTitle}>
            Préparation en cours
          </Text>
        </View>
        
        <View style={styles.statusIllustration}>
          <Image 
            source={
              prestatairePhoto 
              ? { uri: prestatairePhoto }
              : prestataire?.avatar 
              ? { uri: prestataire.avatar }
              : prestataire?.location?.photo 
              ? { uri: prestataire.location.photo }
              : require('../../../assets/default-avatar.png')
            } 
            style={[
              styles.prestataireImage,
              { 
                backgroundColor: '#F0F0F0',  // Fond pour éviter les images transparentes
                resizeMode: 'cover'          // Assurer que l'image couvre tout l'espace
              }
            ]} 
          />
          <View style={styles.statusProgressIndicator}>
            <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
            <View style={styles.statusProgressLine} />
            <View style={[styles.statusProgressDot, { backgroundColor: COLORS.info }]} />
            <View style={[styles.statusProgressLine, { backgroundColor: COLORS.border }]} />
            <View style={[styles.statusProgressDot, { backgroundColor: COLORS.border }]} />
            <View style={[styles.statusProgressLine, { backgroundColor: COLORS.border }]} />
            <View style={[styles.statusProgressDot, { backgroundColor: COLORS.border }]} />
          </View>
        </View>
        
        <Text style={styles.statusDescription}>
          Le prestataire a été informé et se prépare à venir chez vous.
          Vous serez notifié dès qu'il se mettra en route.
        </Text>
        
        <View style={styles.statusDetailCard}>
          <View style={styles.statusDetailRow}>
            <Ionicons name="person" size={22} color={COLORS.primary} />
            <Text style={styles.statusDetailText}>
              {prestataireName || offers.find(o => o.status === 'accepted')?.prestataire_name || "Votre prestataire"}
            </Text>
          </View>
          <View style={styles.statusDetailRow}>
            <Ionicons name="call" size={22} color={COLORS.success} />
            <Text style={styles.statusDetailText}>
              Disponible via le chat
            </Text>
          </View>
        </View>
        
        <Button
          variant="primary"
          label="Contacter le prestataire"
          icon={<Ionicons name="chatbubble-ellipses" size={20} color={COLORS.white} />}
          onPress={() => {
            if (job && job.id) {
              navigation.navigate('Chat', { jobId: job.id });
            } else {
              const acceptedOffer = offers.find(o => o.status === 'accepted');
              if (acceptedOffer && acceptedOffer.id) {
                navigation.navigate('Chat', { offerId: acceptedOffer.id });
              } else if (acceptedOfferId) {
                navigation.navigate('Chat', { offerId: acceptedOfferId });
              } else {
                Alert.alert("Messagerie", "Impossible d'accéder à la messagerie pour le moment.");
              }
            }
          }}
          style={styles.contactButton}
        />
      </Card>
    );
  };
  
  const CompletedServiceView = () => {
    // Trouver l'offre acceptée
    const acceptedOffer = offers.find(o => o.status === 'accepted');
    
    console.log("Offres disponibles:", offers.map(o => ({ id: o.id, status: o.status, prestataire: o.prestataire_id || "N/A" })));
    
    // Récupérer les informations du job
    useEffect(() => {
      const loadJobData = async () => {
        if (acceptedOffer?.id) {
          try {
            console.log("Récupération des informations du job pour l'offre:", acceptedOffer.id);
            const jobData = await getJobByOfferId(acceptedOffer.id);
            setJob(jobData);
            console.log("Job trouvé:", jobData?.id || "Non trouvé");
          } catch (error) {
            console.error("Erreur lors de la récupération du job:", error);
          }
        }
      };
      
      loadJobData();
    }, [acceptedOffer?.id]);

    // Récupérer le jobId pour la redirection
    const jobId = job?.id || (acceptedOffer?.id ? `job-${acceptedOffer.id}` : null);
    
    console.log("Job ID pour l'évaluation:", jobId);
    console.log("Offre acceptée:", acceptedOffer?.id);
    
    // États pour la saisie directe d'avis
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Vérifier si la demande a déjà été évaluée
    const [isLocalReviewed, setIsLocalReviewed] = useState(false);
    
    // Mémoriser si l'évaluation a été soumise entre les rendus
    const reviewedStatusRef = useRef(false);
    
    useEffect(() => {
      // Vérifier toutes les sources possibles de statut d'évaluation
      if (request?.is_reviewed || route.params?.hasBeenReviewed || reviewedStatusRef.current) {
        // Mémoriser que cette demande a été évaluée pour les futures navigations
        reviewedStatusRef.current = true;
        setIsLocalReviewed(true);
        setShowReviewForm(false);
        
        // Mettre à jour l'état global si ce n'est pas déjà fait
        if (!request?.is_reviewed) {
          console.log('Mise à jour de l\'etat global pour refléter l\'avis soumis');
          setRequest(prev => prev ? {...prev, is_reviewed: true} : null);
        }
      }
    }, [request?.is_reviewed, route.params?.hasBeenReviewed]);
    
    // Déterminer le statut final d'évaluation
    const isReviewed = request?.is_reviewed || isLocalReviewed || reviewedStatusRef.current || false;
    
    // Fonction pour soumettre un avis directement
    const handleSubmitReview = async () => {
      if (!user) {
        Alert.alert('Erreur', 'Utilisateur non connecté');
        return;
      }
      
      // Récupérer l'ID du prestataire
      let prestataireId = acceptedOffer?.prestataire_id;
      
      // Si pas trouvé dans l'offre acceptée, essayer de le récupérer ailleurs
      if (!prestataireId && job?.prestataire_id) {
        console.log("Récupération de l'ID prestataire depuis le job");
        prestataireId = job.prestataire_id;
      }
      
      // Dernier recours: chercher dans la demande
      if (!prestataireId && request?.status === RequestStatus.COMPLETED) {
        try {
          console.log("Tentative de récupération de l'ID prestataire depuis la base de données");
          // Récupérer tous les prestataires qui ont fait des offres sur cette demande
          const { data: offerData, error: offersError } = await supabase
            .from('offers')
            .select('prestataire_id')
            .eq('request_id', request.id)
            .eq('status', 'accepted')
            .maybeSingle();
          
          if (offersError) {
            console.error("Erreur lors de la récupération des offres:", offersError);
          } else if (offerData?.prestataire_id) {
            prestataireId = offerData.prestataire_id;
            console.log("ID prestataire trouvé dans les offres:", prestataireId);
          }
        } catch (error) {
          console.error("Erreur lors de la recherche du prestataire:", error);
        }
      }
      
      if (!prestataireId) {
        Alert.alert('Erreur', 'Information prestataire manquante - Impossible de soumettre votre avis');
        setIsSubmitting(false);
        return;
      }
      
      console.log("ID prestataire final pour l'évaluation:", prestataireId);
      
      // Vérifier si nous avons un job ID valide
      let finalJobId = jobId;
      
      // Si nous n'avons pas d'ID de job, chercher ou créer
      if (!finalJobId) {
        try {
          console.log("Recherche d'un job associé à la demande:", request?.id);
          
          // D'abord, chercher tous les jobs associés à cette demande via les offres
          let jobFound = false;
          
          if (request?.id) {
            // Récupérer toutes les offres pour cette demande
            const { data: reqOffers, error: reqOffersError } = await supabase
              .from('offers')
              .select('id, status')
              .eq('request_id', request.id)
              .eq('status', 'accepted');
            
            if (reqOffersError) {
              console.error("Erreur lors de la récupération des offres:", reqOffersError);
            } else if (reqOffers?.length > 0) {
              console.log("Offres acceptées trouvées:", reqOffers.map(o => o.id));
              
              // Chercher un job pour ces offres
              for (const offer of reqOffers) {
                const { data: jobData, error: jobError } = await supabase
                  .from('jobs')
                  .select('id')
                  .eq('offer_id', offer.id)
                  .maybeSingle();
                
                if (jobError) {
                  console.error(`Erreur lors de la recherche du job pour l'offre ${offer.id}:`, jobError);
                } else if (jobData?.id) {
                  finalJobId = jobData.id;
                  console.log("Job trouvé via l'offre:", finalJobId);
                  jobFound = true;
                  break;
                }
              }
            }
          }
          
          // Si aucun job trouvé via offres, créer un nouveau job temporaire
          if (!jobFound) {
            console.log("Aucun job trouvé, création d'un job temporaire");
            
            // Créer un job temporaire même sans offre (utiliser ID simulé si nécessaire)
            const jobData = {
              client_id: user.id,
              prestataire_id: prestataireId,
              tracking_status: 'completed',
              is_completed: true,
              completed_at: new Date().toISOString()
            };
            
            // Ajouter l'offer_id si disponible
            if (acceptedOffer?.id) {
              jobData['offer_id'] = acceptedOffer.id;
            }
            
            const { data: newJob, error: createError } = await supabase
              .from('jobs')
              .insert(jobData)
              .select()
              .single();
            
            if (createError) {
              console.error("Erreur lors de la création du job temporaire:", createError);
              console.log("Tentative de création de job sans offer_id");
              
              // Dernière tentative: créer un job sans offer_id
              if (acceptedOffer?.id) {
                delete jobData['offer_id'];
                
                const { data: fallbackJob, error: fallbackError } = await supabase
                  .from('jobs')
                  .insert(jobData)
                  .select()
                  .single();
                
                if (fallbackError) {
                  console.error("Échec de la création du job de secours:", fallbackError);
                  throw new Error("Impossible de créer un job pour cette évaluation");
                } else if (fallbackJob) {
                  finalJobId = fallbackJob.id;
                  console.log("Job de secours créé avec succès:", finalJobId);
                }
              } else {
                throw new Error("Impossible de créer un job sans référence d'offre");
              }
            } else if (newJob) {
              finalJobId = newJob.id;
              console.log("Nouveau job créé avec succès:", finalJobId);
            }
          }
        } catch (error) {
          console.error("Exception complète lors de la gestion du job:", error);
          Alert.alert('Erreur', 'Problème lors de la préparation de l\'évaluation');
          setIsSubmitting(false);
          return;
        }
      }
      
      if (!finalJobId) {
        // Dernière tentative: créer un ID de job fictif basé sur la demande
        if (request?.id) {
          finalJobId = `review-job-${request.id}`;
          console.log("Utilisation d'un ID de job fictif:", finalJobId);
        } else {
          Alert.alert('Erreur', 'Impossible de déterminer le job pour cette évaluation');
          setIsSubmitting(false);
          return;
        }
      }
      
      try {
        setIsSubmitting(true);
        console.log("Soumission de l'évaluation avec les données:", {
          job_id: finalJobId,
          reviewer_id: user.id,
          reviewed_user_id: prestataireId,
          rating,
          comment: comment.substring(0, 20) + (comment.length > 20 ? "..." : "")
        });
        
        // Créer l'avis directement via Supabase pour éviter les problèmes d'API
        const { data: reviewData, error: reviewError } = await supabase
          .from('reviews')
          .insert({
            job_id: finalJobId,
            reviewer_id: user.id,
            reviewed_user_id: prestataireId,
            rating,
            comment
          })
          .select()
          .single();
        
        if (reviewError) {
          console.error("Erreur Supabase lors de la création de l'avis:", reviewError);
          throw reviewError;
        }
        
        console.log("Évaluation créée avec succès:", reviewData?.id);
        
        // Mettre à jour le statut is_reviewed de la demande
        if (request?.id) {
          const { error: updateError } = await supabase
            .from('requests')
            .update({ is_reviewed: true })
            .eq('id', request.id);
          
          if (updateError) {
            console.error("Erreur lors de la mise à jour du statut d'évaluation:", updateError);
          } else {
            console.log("Demande marquée comme évaluée avec succès");
          }
        }
        
        // Mettre à jour les états locaux
        reviewedStatusRef.current = true;
        setIsLocalReviewed(true);
        setShowReviewForm(false);
        
        // Mettre à jour l'état global de la demande
        setRequest(prev => prev ? {...prev, is_reviewed: true} : null);
        
        // Afficher une confirmation
        Alert.alert(
          'Merci pour votre évaluation !',
          'Votre avis a été enregistré avec succès.'
        );
      } catch (error) {
        console.error('Erreur lors de la soumission de l\'avis:', error);
        Alert.alert('Erreur', 'Impossible d\'enregistrer votre évaluation');
      } finally {
        setIsSubmitting(false);
      }
    };
    
    // Composant pour l'affichage des étoiles
    const StarRating = () => {
      return (
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map(star => (
            <TouchableOpacity
              key={star}
              onPress={() => setRating(star)}
              style={styles.starButton}
            >
              <Ionicons 
                name={star <= rating ? 'star' : 'star-outline'} 
                size={28} 
                color="#FFB800" 
              />
            </TouchableOpacity>
          ))}
        </View>
      );
    };
    
    return (
      <Card style={[styles.card, styles.statusCard]} elevation="md">
        <View style={styles.statusHeaderContainer}>
          <View style={[styles.statusIconContainer, { backgroundColor: COLORS.success }]}>
            <Ionicons name="checkmark-circle" size={32} color="#FFFFFF" />
          </View>
          <Text variant="h4" weight="semibold" style={styles.statusTitle}>
            Service terminé
          </Text>
        </View>
        
        <View style={styles.completedIllustration}>
          <View style={styles.completedIconContainer}>
            <Ionicons name="trophy" size={48} color={COLORS.success} />
          </View>
        </View>
        
        <Text style={styles.statusDescription}>
          Le service a été effectué avec succès. Merci de votre confiance !
          {!isReviewed && !showReviewForm && " Votre avis est important pour aider d'autres utilisateurs."}
        </Text>
        
        {/* Badge de confirmation pour service évalué */}
        {isReviewed && (
          <View style={styles.reviewedBadge}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
            <Text style={styles.reviewedText}>
              Service évalué - Merci pour votre avis !
            </Text>
          </View>
        )}
        
        {/* Affichage des informations du prestataire */}
        {acceptedOffer && (
          <View style={styles.completedPrestataireCard}>
            <Image 
              source={
                acceptedOffer.prestataire_profile_picture
                  ? { uri: acceptedOffer.prestataire_profile_picture }
                  : require('../../../assets/default-avatar.png')
              } 
              style={styles.completedPrestataireAvatar}
            />
            <View style={styles.completedPrestataireInfo}>
              <Text style={styles.completedPrestataireName}>
                {acceptedOffer.prestataire_name || "Prestataire"}
              </Text>
              <Text style={styles.completedPrestataireService}>
                {request?.service_id?.replace(/-/g, ' ')?.split(' ')?.[0] || "Service"}
              </Text>
            </View>
          </View>
        )}
        
        {/* Formulaire d'avis intégré - s'affiche uniquement si demandé */}
        {!isReviewed && showReviewForm && (
          <View style={styles.reviewFormContainer}>
            <Text style={styles.reviewFormTitle}>Votre évaluation</Text>
            
            <StarRating />
            
            <TextInput
              style={styles.reviewInput}
              placeholder="Commentaire (optionnel)"
              multiline
              numberOfLines={3}
              value={comment}
              onChangeText={setComment}
              placeholderTextColor={COLORS.textSecondary}
            />
            
            <View style={styles.reviewButtonsContainer}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowReviewForm(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={handleSubmitReview}
                disabled={isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'Envoi...' : 'Envoyer'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {/* Bouton pour afficher le formulaire d'avis - uniquement si pas encore évalué */}
        {!isReviewed && !showReviewForm && (
          <TouchableOpacity 
            style={styles.leaveReviewButton}
            onPress={() => setShowReviewForm(true)}
          >
            <Ionicons name="star" size={20} color={COLORS.white} />
            <Text style={styles.leaveReviewText}>
              Laisser un avis
            </Text>
          </TouchableOpacity>
        )}
      </Card>
    );
  };

  // Rendu principal avec routing conditionnel basé sur les statuts
  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header amélioré pour tous les statuts */}
        <View style={styles.enhancedHeaderCard}>
          <View style={styles.enhancedHeaderGradient}>
            <View style={styles.enhancedServiceContainer}>
              <View style={styles.enhancedIconContainer}>
                <Ionicons name={serviceIcon} size={28} color="#FFFFFF" />
              </View>
              <View style={styles.enhancedServiceInfo}>
                <Text style={styles.enhancedServiceLabel}>SERVICE</Text>
                <Text style={styles.enhancedServiceTitle}>
                  {request.service_id.replace(/-/g, ' ').split(' ')[0]}
                </Text>
                <View style={styles.enhancedBadgeContainer}>
                  <View style={[
                    styles.enhancedStatusBadge, 
                    badgeProps.variant === "warning" ? styles.warningBadge : 
                    badgeProps.variant === "success" ? styles.successBadge : 
                    badgeProps.variant === "danger" ? styles.dangerBadge : 
                    styles.primaryBadge
                  ]}>
                    <Text style={styles.enhancedStatusText}>{badgeProps.label}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
          
          <View style={styles.enhancedDetailSection}>
            <View style={styles.enhancedDetailRow}>
              <View style={styles.enhancedDetailIconContainer}>
                <Ionicons name="calendar" size={18} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.enhancedDetailLabel}>DATE DE CRÉATION</Text>
                <Text style={styles.enhancedDetailValue}>{formatDate(request.created_at)}</Text>
              </View>
            </View>
            
            <View style={styles.enhancedDetailRow}>
              <View style={styles.enhancedDetailIconContainer}>
                <Ionicons name="time-outline" size={18} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.enhancedDetailLabel}>DERNIÈRE MISE À JOUR</Text>
                <Text style={styles.enhancedDetailValue}>{formatDate(request.updated_at || request.created_at)}</Text>
              </View>
            </View>
          </View>
        </View>
        
        {/* Affichage conditionnel basé sur le statut */}
        {request.status === RequestStatus.PENDING && <PendingRequestView />}
        
        {request.status === RequestStatus.OFFERED && <OffersReceivedView />}
        
        {request.status === RequestStatus.ACCEPTED && (
          <>
            {/* En fonction du tracking status */}
            {request.prestataire_status === TrackingStatus.NOT_STARTED && <NotStartedTrackingView />}
            
            {(request.prestataire_status === TrackingStatus.EN_ROUTE || 
              request.prestataire_status === TrackingStatus.ARRIVED) && <TrackingMapView />}
            
            {request.prestataire_status === TrackingStatus.IN_PROGRESS && <ServiceInProgressView />}
            
            {request.prestataire_status === TrackingStatus.COMPLETED && <CompletedServiceView />}
          </>
        )}
        
        {/* Afficher également le composant d'évaluation quand la demande est marquée comme terminée */}
        {request.status === RequestStatus.COMPLETED && <CompletedServiceView />}
        
        {/* Informations communes pour tous les statuts - Design amélioré */}
        <Card style={styles.enhancedInfoCard} elevation="md">
          <View style={styles.luxuryCardHeader}>
            <Text style={styles.luxuryCardTitle}>DÉTAILS DE LA DEMANDE</Text>
          </View>
          
          <View style={styles.luxuryCardContent}>
            {/* Bloc d'urgence */}
            <View style={styles.luxuryFeatureCard}>
              <View style={[
                styles.urgencyBadge, 
                request.urgency <= 2 ? styles.urgencyBadgeLow : 
                request.urgency <= 4 ? styles.urgencyBadgeMedium : 
                styles.urgencyBadgeHigh
              ]}>
                <Ionicons 
                  name={
                    request.urgency <= 2 ? "time-outline" : 
                    request.urgency <= 4 ? "alert-circle-outline" : 
                    "flash"
                  } 
                  size={20} 
                  color="#FFFFFF" 
                />
                <Text style={styles.urgencyBadgeText}>
                  {request.urgency <= 2 ? 'FAIBLE' : 
                   request.urgency <= 4 ? 'MOYENNE' : 
                   'URGENTE'}
                </Text>
              </View>
              
              <View style={styles.luxuryFeatureContent}>
                <Text style={styles.luxuryFeatureTitle}>
                  {request.urgency <= 2 ? 'Intervention standard' : 
                   request.urgency <= 4 ? 'Intervention prioritaire' : 
                   'Intervention urgente'}
                </Text>
                <Text style={styles.luxuryFeatureDescription}>
                  {request.urgency <= 2 ? 'Votre demande sera traitée dans les délais standards.' : 
                   request.urgency <= 4 ? 'Votre demande est prioritaire et sera traitée rapidement.' : 
                   'Votre demande est marquée comme urgente et sera traitée en priorité absolue.'}
                </Text>
                
                <View style={styles.modernUrgencyMeter}>
                  {[1, 2, 3, 4, 5].map(dot => (
                    <View
                      key={dot}
                      style={[
                        styles.modernUrgencySegment,
                        dot <= request.urgency ? 
                          (dot <= 2 ? styles.modernUrgencyLow : 
                           dot <= 4 ? styles.modernUrgencyMedium : 
                           styles.modernUrgencyHigh) : 
                          styles.modernUrgencyInactive
                      ]}
                    />
                  ))}
                </View>
              </View>
            </View>
            
            {/* Bloc référence et date */}
            <View style={styles.infoCardsRow}>
              <View style={styles.infoCardHalf}>
                <View style={styles.infoCardIcon}>
                  <Ionicons name="id-card-outline" size={24} color={COLORS.primary} />
                </View>
                <Text style={styles.infoCardLabel}>RÉFÉRENCE</Text>
                <Text style={styles.infoCardValue}>#{request.id.substring(0, 8)}</Text>
              </View>
              
              <View style={styles.infoCardHalf}>
                <View style={[styles.infoCardIcon, {backgroundColor: `${COLORS.accent}15`}]}>
                  <Ionicons name="calendar" size={24} color={COLORS.accent} />
                </View>
                <Text style={styles.infoCardLabel}>CRÉÉE LE</Text>
                <Text style={styles.infoCardValue}>{formatDate(request.created_at)}</Text>
              </View>
            </View>
            
            {/* Service demandé */}
            <View style={styles.serviceInfoCard}>
              <View style={styles.serviceIconLarge}>
                <Ionicons name={getServiceIcon(request.service_id)} size={28} color={COLORS.white} />
              </View>
              <View style={styles.serviceInfoContent}>
                <Text style={styles.serviceLabel}>SERVICE DEMANDÉ</Text>
                <Text style={styles.serviceName}>{request.service_id.replace(/-/g, ' ').split(' ')[0]}</Text>
                <View style={styles.serviceStatusBadge}>
                  <Text style={styles.serviceStatusText}>{badgeProps.label}</Text>
                </View>
              </View>
            </View>
          </View>
        </Card>
        
        <Card style={styles.enhancedAddressCard} elevation="md">
          <View style={styles.luxuryCardHeader}>
            <Text style={styles.luxuryCardTitle}>LOCALISATION</Text>
          </View>
          
          <View style={styles.enhancedAddressContent}>
            <View style={styles.addressFeaturedGradient}>
              <View style={styles.addressContentWrapper}>
                <View style={styles.addressIconContainerLarge}>
                  <Ionicons name="location" size={32} color="#FFFFFF" />
                </View>
                
                <View style={styles.addressTextContainer}>
                  <Text style={styles.addressLuxuryLabel}>ADRESSE D'INTERVENTION</Text>
                  <Text style={styles.addressLuxuryText}>{request.location.address}</Text>
                </View>
                
                <TouchableOpacity style={styles.directionButton}>
                  <Ionicons name="navigate-circle" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.addressFeaturesList}>
              <View style={styles.addressFeatureItem}>
                <View style={[styles.featureIconContainer, { backgroundColor: `${COLORS.success}15` }]}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                </View>
                <Text style={styles.featureText}>Adresse vérifiée</Text>
              </View>
              
              <View style={styles.addressFeatureItem}>
                <View style={[styles.featureIconContainer, { backgroundColor: `${COLORS.info}15` }]}>
                  <Ionicons name="shield-checkmark" size={20} color={COLORS.info} />
                </View>
                <Text style={styles.featureText}>Confidentielle</Text>
              </View>
              
              <View style={styles.addressFeatureItem}>
                <View style={[styles.featureIconContainer, { backgroundColor: `${COLORS.primary}15` }]}>
                  <Ionicons name="navigate" size={20} color={COLORS.primary} />
                </View>
                <Text style={styles.featureText}>Navigation disponible</Text>
              </View>
            </View>
          </View>
        </Card>
        
        {request.notes && (
          <Card style={styles.card} elevation="sm">
            <View style={styles.cardHeader}>
              <Ionicons name="document-text-outline" size={22} color={COLORS.primary} />
              <Text variant="h5" weight="semibold" style={styles.marginLeft}>
                Notes
              </Text>
            </View>
            
            <View style={styles.separator} />
            
            <Text variant="body2" style={styles.notes}>{request.notes}</Text>
          </Card>
        )}
        
        {request.photos && request.photos.length > 0 && (
          <Card style={styles.card} elevation="sm">
            <View style={styles.cardHeader}>
              <Ionicons name="images-outline" size={22} color={COLORS.primary} />
              <Text variant="h5" weight="semibold" style={styles.marginLeft}>
                Photos
              </Text>
            </View>
            
            <View style={styles.separator} />
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosContainer}>
              {request.photos.map((photo, index) => (
                <Image
                  key={index}
                  source={{ uri: photo }}
                  style={styles.photo}
                />
              ))}
            </ScrollView>
          </Card>
        )}
        
        {/* Actions en bas */}
        <View style={[styles.actionsContainer, { marginBottom: insets.bottom > 0 ? 0 : 20 }]}>
          {/* Bouton d'annulation pour demandes en attente ou avec offres */}
          {(request.status === RequestStatus.PENDING || request.status === RequestStatus.OFFERED) && (
            <Button
              variant="danger"
              label="Annuler ma demande"
              icon={<Ionicons name="close-circle" size={20} color={COLORS.white} />}
              onPress={() => {
                Alert.alert(
                  'Confirmer l\'annulation',
                  'Êtes-vous sûr de vouloir annuler cette demande ? Cette action est irréversible.',
                  [
                    {
                      text: 'Non',
                      style: 'cancel'
                    },
                    {
                      text: 'Oui, annuler',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          setLoading(true); // Montrer un indicateur de chargement
                          
                          // Importer la fonction cancelRequest de services/api.ts
                          const { cancelRequest } = require('../../services/api');
                          
                          // Annuler la demande
                          const cancelledRequest = await cancelRequest(requestId);
                          
                          // Mettre à jour l'interface utilisateur
                          setRequest(prev => ({
                            ...prev,
                            status: RequestStatus.CANCELLED
                          }));
                          
                          // Afficher une confirmation
                          Alert.alert(
                            'Demande annulée',
                            'Votre demande a été annulée avec succès.',
                            [
                              {
                                text: 'OK',
                                onPress: () => navigation.goBack() // Retourner à l'écran précédent
                              }
                            ]
                          );
                        } catch (error) {
                          console.error('Erreur lors de l\'annulation:', error);
                          Alert.alert(
                            'Erreur',
                            'Une erreur est survenue lors de l\'annulation de la demande. Veuillez réessayer.'
                          );
                        } finally {
                          setLoading(false); // Cacher l'indicateur de chargement
                        }
                      }
                    }
                  ]
                );
              }}
              style={styles.marginBottom}
            />
          )}
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
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.background,
  },
  errorIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${COLORS.danger}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  // Nouveaux styles spécifiques aux statuts
  statusCard: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.medium,
  },
  statusHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    ...SHADOWS.small,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statusDescription: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 24,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  // Styles pour l'écran de suivi quand le service est en cours
  inProgressIllustration: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    marginVertical: SPACING.md,
  },
  inProgressAnimation: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${COLORS.warning}15`,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  // Styles pour l'écran "service terminé"
  completedIllustration: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    marginVertical: SPACING.md,
  },
  completedIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${COLORS.success}15`,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  // Styles pour le composant CompletedServiceView simplifié
  completedPrestataireCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    padding: 16,
    marginVertical: 16,
    borderRadius: 12,
    ...SHADOWS.small,
  },
  completedPrestataireAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...SHADOWS.small,
  },
  completedPrestataireInfo: {
    flex: 1,
  },
  completedPrestataireName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  completedPrestataireService: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  leaveReviewButton: {
    backgroundColor: COLORS.warning,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    ...SHADOWS.medium,
  },
  leaveReviewText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
  reviewedBadge: {
    backgroundColor: `${COLORS.success}15`,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  reviewedText: {
    color: COLORS.success,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 10,
  },
  contactPrestataireCompletedButton: {
    backgroundColor: `${COLORS.primary}10`,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  contactCompletedButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  reviewFormContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    ...SHADOWS.small,
  },
  reviewFormTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#E1E3EA',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: '#F7F8FA',
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  reviewButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    borderRadius: 8,
    paddingVertical: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  submitButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    marginLeft: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  starButton: {
    padding: 6,
  },
  ratingPrompt: {
    alignItems: 'center',
    marginVertical: SPACING.md,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.small,
  },
  ratingStars: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  reviewButton: {
    marginTop: SPACING.md,
  },
  // Styles de luxe pour les cartes d'information
  enhancedInfoCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 0,
    backgroundColor: '#FFFFFF',
    ...SHADOWS.medium,
  },
  enhancedAddressCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 0,
    backgroundColor: '#FFFFFF',
    ...SHADOWS.medium,
  },
  enhancedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: `${COLORS.primary}08`,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.primary}15`,
  },
  enhancedHeaderIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    ...SHADOWS.small,
  },
  luxuryCardHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  luxuryCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.primary,
  },
  luxuryCardContent: {
    padding: 16,
  },
  luxuryFeatureCard: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
    padding: 16,
    ...SHADOWS.small,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  urgencyBadgeLow: {
    backgroundColor: '#4CAF50', // Vert
  },
  urgencyBadgeMedium: {
    backgroundColor: '#FF9800', // Orange
  },
  urgencyBadgeHigh: {
    backgroundColor: '#F44336', // Rouge
  },
  urgencyBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  luxuryFeatureContent: {
    marginLeft: 4,
  },
  luxuryFeatureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  luxuryFeatureDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  modernUrgencyMeter: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  modernUrgencySegment: {
    flex: 1,
    height: '100%',
    marginHorizontal: 2,
    borderRadius: 4,
  },
  modernUrgencyLow: {
    backgroundColor: '#4CAF50', // Vert
  },
  modernUrgencyMedium: {
    backgroundColor: '#FF9800', // Orange
  },
  modernUrgencyHigh: {
    backgroundColor: '#F44336', // Rouge
  },
  modernUrgencyInactive: {
    backgroundColor: '#E0E0E0',
  },
  infoCardsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  infoCardHalf: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    ...SHADOWS.small,
  },
  infoCardIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: `${COLORS.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  infoCardValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  serviceInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    ...SHADOWS.small,
  },
  serviceIconLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    ...SHADOWS.small,
  },
  serviceInfoContent: {
    flex: 1,
  },
  serviceLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  serviceStatusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  serviceStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  enhancedAddressContent: {
    padding: 0,
  },
  addressFeaturedGradient: {
    backgroundColor: COLORS.primary,
    padding: 16,
    marginBottom: 1,
  },
  addressContentWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressIconContainerLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressLuxuryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  addressLuxuryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  directionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  addressFeaturesList: {
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  addressFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  // Styles pour la carte "Service en cours"
  progressCard: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.md,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 0,
    backgroundColor: '#FFFFFF',
    ...SHADOWS.medium,
  },
  progressHeaderGradient: {
    backgroundColor: COLORS.warning,
    padding: 16,
  },
  progressHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  progressHeaderTextContainer: {
    flex: 1,
  },
  progressHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  progressHeaderSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  prestataireProgressInfoContainer: {
    padding: 16,
  },
  prestataireProgressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    marginBottom: 16,
    ...SHADOWS.small,
  },
  prestataireProgressAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginRight: 16,
    ...SHADOWS.small,
  },
  prestataireProgressInfo: {
    flex: 1,
  },
  prestataireProgressName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 6,
  },
  prestataireProgressStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDotPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.warning,
    marginRight: 6,
  },
  prestataireStatusText: {
    fontSize: 14,
    color: COLORS.warning,
    fontWeight: '600',
  },
  progressDetailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    ...SHADOWS.small,
  },
  progressDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressDetailIcon: {
    marginRight: 12,
  },
  progressDetailText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  contactPrestataireProgressButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    ...SHADOWS.small,
  },
  contactProgressButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  // Nouveaux styles pour le composant d'évaluation amélioré
  enhancedRatingCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginVertical: SPACING.md,
    ...SHADOWS.small,
  },
  reviewPrestataireInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  reviewPrestataireAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: SPACING.sm,
    borderWidth: 2,
    borderColor: COLORS.white,
    backgroundColor: '#F0F0F0',
    ...SHADOWS.small,
  },
  reviewPrestataireName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  ratingStarsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: SPACING.md,
  },
  starButton: {
    padding: 5,
  },
  ratingText: {
    textAlign: 'center',
    marginBottom: SPACING.md,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  commentContainer: {
    marginBottom: SPACING.md,
  },
  commentLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    minHeight: 100,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  submitReviewButton: {
    backgroundColor: COLORS.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: BORDER_RADIUS.md,
    marginVertical: SPACING.sm,
    ...SHADOWS.small,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
    opacity: 0.7,
  },
  submitReviewText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: SPACING.sm,
  },
  detailedReviewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    padding: SPACING.sm,
  },
  detailedReviewText: {
    color: COLORS.primary,
    fontSize: 14,
    marginRight: 4,
  },
  // Styles pour l'écran "en préparation"
  statusIllustration: {
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  prestataireImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: COLORS.white,
    ...SHADOWS.small,
    marginBottom: SPACING.md,
  },
  statusProgressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.md,
  },
  statusProgressLine: {
    width: 30,
    height: 2,
    backgroundColor: COLORS.success,
    marginHorizontal: 5,
  },
  statusProgressDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.white,
    ...SHADOWS.small,
  },
  statusDetailCard: {
    backgroundColor: `${COLORS.primary}08`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  statusDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statusDetailText: {
    fontSize: 14,
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  contactButton: {
    marginTop: SPACING.md,
  },
  
  // Styles pour la carte de suivi en temps réel
  trackingCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  trackingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  trackingTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackingMapContainer: {
    height: 250,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  trackingMap: {
    ...StyleSheet.absoluteFillObject,
  },
  clientMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...SHADOWS.small,
  },
  prestataireMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...SHADOWS.small,
  },
  trackingInfoContainer: {
    backgroundColor: COLORS.cardBackground,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  trackingInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  trackingInfoText: {
    marginLeft: SPACING.sm,
  },
  // Styles pour l'affichage de base
  mapPlaceholder: {
    height: 200,
    backgroundColor: COLORS.backgroundDark,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  
  // Styles pour l'interface améliorée de suivi en temps réel
  trackingCardEnhanced: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    padding: 0,
    ...SHADOWS.medium,
  },
  // Styles d'entête avec statut
  trackingHeaderEnhanced: {
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 70,
  },
  headerRoute: {
    backgroundColor: '#3478F6', // Bleu
    borderBottomWidth: 0,
  },
  headerArrived: {
    backgroundColor: '#4CAF50', // Vert
    borderBottomWidth: 0,
  },
  statusPillEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
  },
  statusDotEnhanced: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: SPACING.sm,
  },
  statusDotBlue: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 5,
  },
  statusDotPurple: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 5,
  },
  statusTextEnhanced: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: SPACING.sm,
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Styles pour la carte
  mapContainer: {
    height: 250,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapErrorContainer: {
    height: 200,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  mapErrorText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  mapErrorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
  },
  mapErrorDetailText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  // Styles pour l'interface moderne de suivi
  modernTrackingContainer: {
    padding: SPACING.sm,
  },
  modernTrackingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  modernCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pulseDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3478F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  modernLocationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modernAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modernAddressText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 8,
    flex: 1,
  },
  modernDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  modernDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  modernDetailTextContainer: {
    marginLeft: 10,
  },
  modernDetailLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  modernDetailValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modernSeparator: {
    width: 1,
    height: 40,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 10,
  },
  modernPrestataireCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  modernPrestataireInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernPrestataireAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden', // Assure que l'image respecte les bordures arrondies
  },
  modernPrestataireInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modernPrestataireDetails: {
    flex: 1,
  },
  modernPrestataireName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  modernRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernRatingText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    marginLeft: 4,
  },
  modernReviewCount: {
    fontSize: 12,
    fontWeight: 'normal',
    color: COLORS.textSecondary,
  },
  modernStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusBadgeRoute: {
    backgroundColor: '#3478F6',
  },
  statusBadgeArrived: {
    backgroundColor: '#4CAF50',
  },
  modernStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  modernDirectionInfo: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  modernDirectionItem: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  modernDirectionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernAddressDetail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginLeft: 28,
  },
  modernDirectionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 8,
    flex: 1,
  },
  markerClientContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerClient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'white',
    ...SHADOWS.medium,
  },
  markerPrestataireContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPrestataire: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3478F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'white',
    ...SHADOWS.medium,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: SPACING.md,
    right: SPACING.md,
  },
  mapOverlayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.medium,
  },
  overlayBadgeRoute: {
    backgroundColor: '#3478F6',
  },
  overlayBadgeArrived: {
    backgroundColor: '#4CAF50',
  },
  mapOverlayText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  
  // Styles pour les cartes d'information
  infoContainerEnhanced: {
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
  },
  infoRowEnhanced: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoCardEnhanced: {
    backgroundColor: '#F5F5F5',
    width: '48%',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  infoIconContainerEnhanced: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  iconBlue: {
    backgroundColor: '#3478F6',
  },
  iconGreen: {
    backgroundColor: '#4CAF50',
  },
  infoLabelEnhanced: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 2,
  },
  infoValueEnhanced: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // Styles pour les instructions
  instructionsContainerEnhanced: {
    backgroundColor: '#F8F9FA',
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    borderBottomLeftRadius: BORDER_RADIUS.lg,
    borderBottomRightRadius: BORDER_RADIUS.lg,
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  instructionsTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: SPACING.sm,
  },
  instructionsTextEnhanced: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  contactPrestataireButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 10,
    alignSelf: 'center',
    width: '90%',
    ...SHADOWS.small,
  },
  contactButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  },
  // Nouveaux styles pour le statut pending
  pendingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pendingCardTitle: {
    marginLeft: SPACING.sm,
  },
  pendingAnimation: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.md,
    position: 'relative',
    height: 120,
  },
  pendingIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  pulseContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseCircle: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 70,
    width: 140,
    height: 140,
    opacity: 0.7,
  },
  pulse1: {
    transform: [{scale: 0.5}],
    opacity: 0.3,
  },
  pulse2: {
    transform: [{scale: 0.7}],
    opacity: 0.2,
  },
  pulse3: {
    transform: [{scale: 0.9}],
    opacity: 0.1,
  },
  pendingInfoContainer: {
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  pendingInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.cardBackground,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  pendingInfoText: {
    marginLeft: SPACING.sm,
    flex: 1,
  },
  pendingTipContainer: {
    backgroundColor: `${COLORS.warning}15`,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  pendingTip: {
    fontStyle: 'italic',
  },
  // Anciens styles (conservés pour rétrocompatibilité)
  headerCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    ...SHADOWS.small,
  },
  serviceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  serviceInfo: {
    flex: 1,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // Nouveaux styles pour le header amélioré
  enhancedHeaderCard: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.md,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    ...SHADOWS.medium,
  },
  enhancedHeaderGradient: {
    backgroundColor: COLORS.primary,
    padding: 16,
  },
  enhancedServiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  enhancedIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    ...SHADOWS.small,
  },
  enhancedServiceInfo: {
    flex: 1,
  },
  enhancedServiceLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  enhancedServiceTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  enhancedBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  enhancedStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  primaryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  warningBadge: {
    backgroundColor: '#FF9800',
  },
  successBadge: {
    backgroundColor: '#4CAF50',
  },
  dangerBadge: {
    backgroundColor: '#F44336',
  },
  enhancedStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  enhancedDetailSection: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  enhancedDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  enhancedDetailIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${COLORS.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  enhancedDetailLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  enhancedDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  card: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  detailContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  urgencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  urgencyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 2,
  },
  activeDot: {
    backgroundColor: COLORS.warning,
  },
  inactiveDot: {
    backgroundColor: COLORS.backgroundDark,
  },
  address: {
    marginBottom: SPACING.md,
  },
  mapContainer: {
    overflow: 'hidden',
    borderRadius: BORDER_RADIUS.md,
  },
  mapPlaceholder: {
    height: 150,
    backgroundColor: COLORS.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notes: {
    lineHeight: 22,
  },
  photosContainer: {
    flexDirection: 'row',
    marginHorizontal: -SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.md,
    marginRight: SPACING.sm,
  },
  
  // Styles améliorés pour les offres - Version 2
  enhancedOfferCard: {
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.white,
    ...SHADOWS.medium,
    overflow: 'hidden'
  },
  enhancedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  enhancedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.success}10`,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  paymentInfoText: {
    marginLeft: SPACING.sm,
    color: COLORS.textSecondary,
    flex: 1,
  },
  
  // Premium offer card styles - nouvelle version améliorée
  premiumOfferCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 5,
  },
  professionalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  leftHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  premiumAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: COLORS.white,
    backgroundColor: COLORS.cardBackground,
    ...SHADOWS.medium,
  },
  premiumAvatarFallback: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
    ...SHADOWS.medium,
  },
  avatarInitial: {
    fontSize: 32, 
    fontWeight: 'bold',
    color: COLORS.white,
  },
  reviewsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.warning}10`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  ratingText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  prestataireInfoContainer: {
    flex: 1,
  },
  prestataireName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  premiumVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  verifiedText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  experienceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  experienceText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginLeft: 4,
  },
  // Styles du badge d'activité retirés
  fancySeparator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 15,
  },
  premiumPriceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  priceSection: {
    flex: 1,
  },
  offerPriceLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  priceWithTaxRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  offerPrice: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  taxIncluded: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  securityBadgeSingleContainer: {
    marginLeft: 10,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  securityText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  skillsContainer: {
    marginBottom: 5,
  },
  skillsLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  skillsTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skillTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  skillTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Keep existing styles
  offerDescription: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.sm,
    backgroundColor: `${COLORS.accent}08`,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  offerDescriptionText: {
    lineHeight: 20,
    fontSize: 13,
  },
  enhancedOfferActions: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  
  // Nouveaux styles des boutons d'action
  actionButtonsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: COLORS.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  acceptButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 6,
  },
  acceptedOfferContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  acceptedBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.success}15`,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 8,
  },
  acceptedText: {
    color: COLORS.success,
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  selectedProviderText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  chatWithPrestataireButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 15,
    width: '100%',
    ...SHADOWS.small,
  },
  rejectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.danger}15`,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  rejectedText: {
    color: COLORS.danger,
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  
  // Styles existants
  offerCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  providerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceContainer: {
    backgroundColor: `${COLORS.success}15`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
  },
  offerActions: {
    alignItems: 'flex-end',
  },
  waitingContainer: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  loadingIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsContainer: {
    padding: SPACING.md,
    marginTop: SPACING.sm,
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
  marginBottom: {
    marginBottom: SPACING.md,
  },
});

export default RequestDetailScreen;