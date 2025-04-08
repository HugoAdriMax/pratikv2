import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  ScrollView,
  Dimensions,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getJobByOfferId, updateJobTrackingStatus, completeJob, getServiceById, getUserById } from '../../services/api';
import { Job, TrackingStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Text, Card, Button, Badge, Avatar } from '../../components/ui';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import supabase from '../../config/supabase';
import { 
  calculateDistance, 
  updateUserLocation, 
  subscribeToUserLocation, 
  calculateETA, 
  getUserLocation,
  UserLocation,
  getCurrentPositionWithAddress
} from '../../services/location';
import MapView, { Marker, Polyline } from 'react-native-maps';

const { width } = Dimensions.get('window');

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

const JobTrackingScreen = ({ route, navigation }: any) => {
  const { jobId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Référence à la carte pour les animations
  const mapRef = useRef<MapView | null>(null);
  
  const [job, setJob] = useState<Job | null>(null);
  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [client, setClient] = useState<{
    id: string;
    name?: string;
    avatar?: string;
    location: { latitude: number; longitude: number; address: string };
  } | null>(null);
  const [watchId, setWatchId] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const [remainingTime, setRemainingTime] = useState<string | null>(null);

  useEffect(() => {
    fetchJobDetails();
    
    // Lancer le tracking une fois au démarrage
    const trackingCleanup = setupLocationTracking();
    
    // Nettoyage à la sortie
    return () => {
      if (trackingCleanup && typeof trackingCleanup === 'function') {
        trackingCleanup();
      }
      
      if (watchId && typeof watchId === 'object' && 'remove' in watchId) {
        watchId.remove();
      }
    };
  }, [jobId, user]);

  const fetchJobDetails = async () => {
    try {
      console.log('Récupération des détails du job/offre avec ID:', jobId);
      
      // Essayer d'abord de récupérer le job avec l'offerId
      const jobData = await getJobByOfferId(jobId);
      
      // Si pas de job, essayons de récupérer directement l'offre et la demande associée
      if (!jobData) {
        console.log('Aucun job trouvé pour l\'identifiant:', jobId);
        
        // Variable pour stocker les données d'offre, quelle que soit la façon dont on les trouve
        let offerDataFound = null;
        
        // Récupérer les informations de l'offre, en supposant que jobId est un ID d'offre
        // Utiliser maybeSingle pour éviter les erreurs si aucune offre n'est trouvée
        const { data: offerData, error: offerError } = await supabase
          .from('offers')
          .select(`
            *,
            requests:request_id(*),
            prestataires:prestataire_id(*)
          `)
          .eq('id', jobId)
          .maybeSingle();
        
        if (offerError) {
          console.error('Erreur lors de la récupération de l\'offre:', offerError);
          // Ne pas propager l'erreur, mais continuer le flux
          console.warn('Tentative de récupération de l\'offre échouée, mais on continue');
        } else if (offerData) {
          // Offre trouvée directement
          offerDataFound = offerData;
        }
        
        // Si aucune offre n'est trouvée avec cet ID, essayons de vérifier si c'est un ID de demande
        if (!offerDataFound) {
          console.log('Aucune offre trouvée avec cet ID. Tentative de recherche en tant que demande...');
          
          const { data: requestData, error: requestError } = await supabase
            .from('requests')
            .select('*, offers:id(*)')
            .eq('id', jobId)
            .maybeSingle();
            
          if (requestError || !requestData) {
            console.log('Aucune demande trouvée non plus avec cet ID');
            // Ne pas lever d'exception, laisser le flux continuer et afficher un message d'erreur propre
            setLoading(false);
            return;
          }
          
          // Si nous avons trouvé une demande, chercher ses offres associées
          const { data: requestOffers, error: requestOffersError } = await supabase
            .from('offers')
            .select('*')
            .eq('request_id', requestData.id)
            .maybeSingle();
            
          if (requestOffersError || !requestOffers) {
            console.log('Aucune offre associée à la demande trouvée');
            setLoading(false);
            return;
          }
          
          // Utiliser l'offre associée à la demande
          console.log('Offre trouvée via la demande:', requestOffers);
          offerDataFound = requestOffers;
          // Ajouter les données de requête à l'offre trouvée
          offerDataFound.requests = requestData;
        }
        
        // Si nous n'avons pas trouvé d'offre par aucun moyen, arrêter ici
        if (!offerDataFound) {
          console.log('Impossible de trouver une offre ou une demande correspondante');
          setLoading(false);
          return;
        }
        
        console.log('Offre trouvée:', offerDataFound);
        
        // Créer un job avec les données de l'offre
        const baseJob = {
          id: `job-for-${jobId}`,
          offer_id: offerDataFound.id,
          client_id: offerDataFound.requests?.client_id || 'unknown-client',
          prestataire_id: user?.id || offerDataFound.prestataire_id,
          tracking_status: 'not_started',
          is_completed: false,
          created_at: new Date().toISOString(),
          // Ajouter directement les données de l'offre et de la requête
          offers: offerDataFound,
          requests: offerDataFound.requests
        };
        
        // Définir le job
        setJob(baseJob as Job);
        
        // Récupérer les informations du service
        if (offerDataFound.requests?.service_id) {
          try {
            const serviceData = await getServiceById(offerDataFound.requests.service_id);
            setService(serviceData);
          } catch (serviceError) {
            console.error('Error fetching service details:', serviceError);
          }
        }
        
        // Récupérer les informations du client
        if (offerDataFound.requests && offerDataFound.requests.client_id) {
          try {
            const clientData = await getUserById(offerDataFound.requests.client_id);
            
            // Adresse depuis la requête
            const clientLocation = offerDataFound.requests.location || {
              latitude: 48.8566,
              longitude: 2.3522,
              address: "123 Avenue des Champs-Élysées, Paris"
            };
            
            setClient({
              id: offerDataFound.requests.client_id,
              name: clientData?.email?.split('@')[0] || 'Client',
              location: clientLocation
            });
          } catch (clientError) {
            console.error('Error fetching client details:', clientError);
            
            // Client par défaut si non trouvé
            setClient({
              id: offerDataFound.requests.client_id,
              name: 'Client',
              location: offerDataFound.requests.location || {
                latitude: 48.8566,
                longitude: 2.3522,
                address: "Adresse du client"
              }
            });
          }
        } else {
          // Client par défaut si non trouvé
          setClient({
            id: 'unknown-client',
            name: 'Client',
            location: {
              latitude: 48.8566,
              longitude: 2.3522,
              address: "Adresse du client"
            }
          });
        }
        
        // Temps estimé basé sur la distance
        setRemainingTime('10 min');
      } else {
        console.log('Job trouvé dans la base de données:', jobData);
        
        // Utiliser les données réelles
        setJob(jobData);
        
        // Récupérer les informations du service
        if (jobData.offers?.request_id) {
          try {
            const { data: requestData } = await supabase
              .from('requests')
              .select('service_id')
              .eq('id', jobData.offers.request_id)
              .single();
              
            if (requestData?.service_id) {
              const serviceData = await getServiceById(requestData.service_id);
              setService(serviceData);
            }
          } catch (serviceError) {
            console.error('Error fetching service details:', serviceError);
          }
        }
        
        // Récupérer les données du client à partir de jobData.client_id
        if (jobData.client_id) {
          try {
            const clientData = await getUserById(jobData.client_id);
              
            // Tenter de récupérer l'adresse depuis la requête
            let clientLocation = {
              latitude: 48.8566,
              longitude: 2.3522,
              address: "Adresse du client"
            };
            
            // Tenter de récupérer la requête via l'offre
            if (jobData.offer_id) {
              const { data: offerWithRequest } = await supabase
                .from('offers')
                .select(`
                  request_id,
                  requests:request_id(location)
                `)
                .eq('id', jobData.offer_id)
                .maybeSingle();
                
              if (offerWithRequest?.requests?.location) {
                clientLocation = offerWithRequest.requests.location;
              }
            }
            
            setClient({
              id: jobData.client_id,
              name: clientData?.email?.split('@')[0] || 'Client',
              location: clientLocation
            });
          } catch (clientError) {
            console.error('Error fetching client details:', clientError);
            
            // Client par défaut si non trouvé
            setClient({
              id: jobData.client_id,
              name: 'Client',
              location: {
                latitude: 48.8566,
                longitude: 2.3522,
                address: "Adresse du client"
              }
            });
          }
        } else {
          // Client par défaut si non trouvé
          setClient({
            id: 'unknown-client',
            name: 'Client',
            location: {
              latitude: 48.8566,
              longitude: 2.3522,
              address: "Adresse du client"
            }
          });
        }
        
        // Temps estimé basé sur la distance et le statut
        if (jobData.tracking_status === 'en_route') {
          setRemainingTime('10 min');
        } else if (jobData.tracking_status === 'arrived' || jobData.tracking_status === 'in_progress') {
          setRemainingTime('0 min');
        } else {
          setRemainingTime(null);
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
    
    // 2. Obtenir la position actuelle du prestataire et la mettre à jour en base de données
    try {
      // Utiliser notre nouvelle fonction pour obtenir la position avec l'adresse
      const initialLocation = await getCurrentPositionWithAddress();
      
      if (!initialLocation) {
        Alert.alert('Erreur', 'Impossible d\'obtenir votre position actuelle');
        return;
      }
      
      // Mettre à jour l'état local
      setLocation(initialLocation);
      
      // Mise à jour de la localisation du prestataire en base de données avec le nouveau service
      try {
        await updateUserLocation(user.id, initialLocation);
        console.log('Position prestataire mise à jour en base de données:', initialLocation);
      } catch (updateError) {
        console.error('Error updating prestataire location in database:', updateError);
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
          setLocation(position);
          
          // Mise à jour de la localisation du prestataire en base de données avec le nouveau service
          try {
            await updateUserLocation(user.id, position);
            console.log('Position prestataire mise à jour en base de données:', 
              `Lat: ${position.latitude.toFixed(6)}, Long: ${position.longitude.toFixed(6)}`);
              
            // Si on est en mode "en route", mettre à jour le temps estimé d'arrivée
            if (job?.tracking_status === 'en_route' && client?.location) {
              // Utiliser notre nouveau service pour calculer la distance
              const distanceValue = calculateDistance(
                { latitude: position.latitude, longitude: position.longitude },
                { latitude: client.location.latitude, longitude: client.location.longitude }
              );
              
              // Utiliser notre nouveau service pour calculer l'ETA
              const etaMinutes = calculateETA(distanceValue);
              
              // Formater l'affichage de l'ETA
              if (etaMinutes <= 1) {
                setRemainingTime('Moins d\'1 min');
              } else if (etaMinutes < 60) {
                setRemainingTime(`${etaMinutes} min`);
              } else {
                const hours = Math.floor(etaMinutes / 60);
                const mins = etaMinutes % 60;
                setRemainingTime(`${hours}h${mins > 0 ? ` ${mins} min` : ''}`);
              }
              
              // Détecter automatiquement si le prestataire est arrivé (distance < 100m)
              if (distanceValue < 0.1 && job.tracking_status === 'en_route') {
                Alert.alert(
                  'Destination proche',
                  'Vous semblez être arrivé à destination. Souhaitez-vous mettre à jour votre statut?',
                  [
                    {
                      text: 'Plus tard',
                      style: 'cancel'
                    },
                    {
                      text: 'Je suis arrivé',
                      onPress: () => handleUpdateStatus(TrackingStatus.ARRIVED)
                    }
                  ]
                );
              }
            }
          } catch (updateError) {
            console.error('Error updating prestataire location:', updateError);
          }
        }
      );
      
      // Stocker la référence pour pouvoir nettoyer
      setWatchId(watchPosition);
    } catch (error) {
      console.error('Error setting up position watching:', error);
    }
    
    // 4. S'abonner aux mises à jour de position du client en temps réel
    if (job && job.client_id) {
      console.log(`Configuration du suivi en temps réel pour le client ${job.client_id}`);
      
      // Configuration initiale avec la position actuelle du client ou une position par défaut
      let initialClientLocation = client?.location || {
        latitude: 48.8566, // Paris
        longitude: 2.3522,
        address: "Adresse du client"
      };
      
      // Récupérer la position actuelle du client avec le nouveau service
      try {
        const clientLocation = await getUserLocation(job.client_id);
        
        if (clientLocation) {
          console.log('Position initiale du client récupérée:', clientLocation);
          initialClientLocation = {
            latitude: clientLocation.latitude,
            longitude: clientLocation.longitude,
            address: clientLocation.address || initialClientLocation.address
          };
          
          // Mettre à jour l'état avec la position du client
          setClient(prev => ({
            ...prev!,
            location: initialClientLocation
          }));
          
          // Si on est en mode "en route", calculer l'ETA initial
          if (job.tracking_status === 'en_route' && location) {
            const distanceValue = calculateDistance(
              { latitude: location.latitude, longitude: location.longitude },
              { latitude: initialClientLocation.latitude, longitude: initialClientLocation.longitude }
            );
            
            const etaMinutes = calculateETA(distanceValue);
            
            // Formater l'affichage de l'ETA
            if (etaMinutes <= 1) {
              setRemainingTime('Moins d\'1 min');
            } else if (etaMinutes < 60) {
              setRemainingTime(`${etaMinutes} min`);
            } else {
              const hours = Math.floor(etaMinutes / 60);
              const mins = etaMinutes % 60;
              setRemainingTime(`${hours}h${mins > 0 ? ` ${mins} min` : ''}`);
            }
          }
        } else {
          console.log('Aucune position du client trouvée, utilisation de la position par défaut');
        }
      } catch (error) {
        console.error('Error fetching client location:', error);
      }
      
      // S'abonner aux mises à jour de position du client avec le nouveau service
      const unsubscribe = subscribeToUserLocation(job.client_id, (updatedLocation: UserLocation) => {
        console.log('Mise à jour de position du client reçue:', updatedLocation);
        
        // Ne mettre à jour que si la position a changé
        if (updatedLocation && updatedLocation.latitude && updatedLocation.longitude) {
          const newLocation = {
            latitude: updatedLocation.latitude,
            longitude: updatedLocation.longitude,
            address: updatedLocation.address || client?.location?.address || "Adresse du client"
          };
          
          setClient(prev => ({
            ...prev!,
            location: newLocation
          }));
          
          // Mettre à jour le temps d'arrivée estimé si on est en route
          if (job.tracking_status === 'en_route' && location) {
            const distanceValue = calculateDistance(
              { latitude: location.latitude, longitude: location.longitude },
              { latitude: newLocation.latitude, longitude: newLocation.longitude }
            );
            
            const etaMinutes = calculateETA(distanceValue);
            
            // Formater l'affichage de l'ETA
            if (etaMinutes <= 1) {
              setRemainingTime('Moins d\'1 min');
            } else if (etaMinutes < 60) {
              setRemainingTime(`${etaMinutes} min`);
            } else {
              const hours = Math.floor(etaMinutes / 60);
              const mins = etaMinutes % 60;
              setRemainingTime(`${hours}h${mins > 0 ? ` ${mins} min` : ''}`);
            }
            
            // Détecter automatiquement si le prestataire est arrivé (distance < 100m)
            if (distanceValue < 0.1 && job.tracking_status === 'en_route') {
              Alert.alert(
                'Destination proche',
                'Vous semblez être arrivé à destination. Souhaitez-vous mettre à jour votre statut?',
                [
                  {
                    text: 'Plus tard',
                    style: 'cancel'
                  },
                  {
                    text: 'Je suis arrivé',
                    onPress: () => handleUpdateStatus(TrackingStatus.ARRIVED)
                  }
                ]
              );
            }
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

  // Fonction pour simuler l'envoi d'une notification au client
  const sendClientNotification = (status: TrackingStatus) => {
    const clientName = client?.name || 'Client';
    const prestataireName = user?.email?.split('@')[0] || 'Prestataire';
    const serviceType = service?.name || 'service';
    
    let message = '';
    
    switch(status) {
      case TrackingStatus.NOT_STARTED:
        message = `${clientName} : ${prestataireName} a accepté votre demande de ${serviceType}.`;
        break;
      case TrackingStatus.EN_ROUTE:
        message = `${clientName} : ${prestataireName} est en route pour votre demande de ${serviceType}.`;
        break;
      case TrackingStatus.ARRIVED:
        message = `${clientName} : ${prestataireName} est arrivé à votre adresse.`;
        break;
      case TrackingStatus.IN_PROGRESS:
        message = `${clientName} : ${prestataireName} a commencé le travail.`;
        break;
      case TrackingStatus.COMPLETED:
        message = `${clientName} : ${prestataireName} a terminé la mission. Merci pour votre confiance !`;
        break;
    }
    
    // Dans une vraie application, nous enverrions une notification push au client
    // Pour notre démo, nous affichons simplement un toast
    console.log('[NOTIFICATION CLIENT]', message);
    
    // Simuler une notification visuelle
    Alert.alert(
      'Notification envoyée au client',
      message,
      [{ text: 'OK' }]
    );
  };

  const handleUpdateStatus = async (newStatus: TrackingStatus) => {
    if (!job) return;
    
    try {
      setUpdating(true);
      
      // Vérifiez si c'est un job simulé ou réel
      const isRealJob = job.id && !job.id.startsWith('job-for-');
      
      if (isRealJob) {
        console.log(`Mise à jour du job réel ${job.id} au statut ${newStatus}`);
        
        if (newStatus === TrackingStatus.COMPLETED) {
          await completeJob(job.id);
        } else {
          await updateJobTrackingStatus(job.id, newStatus);
        }
      } else {
        console.log(`Mise à jour du job simulé ${job.id} au statut ${newStatus}`);
        
        // Pour les jobs simulés, mettre à jour la demande dans Supabase
        try {
          // On peut mettre à jour la demande associée à l'offre pour refléter ce statut
          if (job.offers && job.offers.request_id) {
            const requestId = job.offers.request_id;
            console.log(`Mise à jour de la demande ${requestId} avec le statut ${newStatus}`);
            
            // Mettre à jour une propriété dans la demande pour refléter le statut du job
            // Par exemple, on pourrait ajouter un champ "tracking_status" dans les requêtes
            // Ou simplement mettre à jour un champ existant
            // Pour l'instant, mettons simplement à jour le statut de la demande
            // Le champ prestataire_status sera ajouté manuellement via SQL
            try {
              console.log(`Mise à jour du statut pour la requête ${requestId}`);
              const { error: updateError } = await supabase
                .from('requests')
                .update({ 
                  // Au minimum, mettre à jour le statut normal
                  status: newStatus === 'completed' ? 'completed' : 'accepted'
                })
                .eq('id', requestId);
                
              if (updateError) {
                console.error("Erreur lors de la mise à jour du statut de la demande:", updateError);
              } else {
                console.log("Statut de la demande mis à jour avec succès");
                
                // Essayer également de mettre à jour prestataire_status, mais ignorer les erreurs
                try {
                  await supabase
                    .from('requests')
                    .update({ prestataire_status: newStatus })
                    .eq('id', requestId);
                    
                  console.log("Tentative de mise à jour de prestataire_status réussie");
                } catch (statusError) {
                  console.log("Le champ prestataire_status n'existe pas encore:", statusError);
                }
              }
            } catch (e) {
              console.error("Erreur générale lors de la mise à jour:", e);
            }
          }
        } catch (updateError) {
          console.error('Erreur lors de la mise à jour du statut sur la demande:', updateError);
        }
      }
      
      // Essayer de créer un job réel si ce n'est pas déjà fait
      if (!isRealJob && job.offer_id) {
        try {
          console.log("Tentative de création d'un job réel pour cette offre...");
          const jobToCreate = {
            offer_id: job.offer_id,
            client_id: job.client_id,
            prestataire_id: job.prestataire_id,
            tracking_status: newStatus,
            is_completed: newStatus === TrackingStatus.COMPLETED
          };
          
          const { data: newJobData, error: newJobError } = await supabase
            .from('jobs')
            .insert(jobToCreate)
            .select();
            
          if (newJobError) {
            console.log("Création du job échouée:", newJobError);
          } else if (newJobData) {
            console.log("Job créé avec succès:", newJobData);
            // Mise à jour de l'ID du job local
            job.id = newJobData[0].id;
          }
        } catch (createError) {
          console.error("Erreur lors de la création du job:", createError);
        }
      }
      
      // Mettre à jour l'état local
      setJob(prev => prev ? { ...prev, tracking_status: newStatus } : null);
      
      // Mettre à jour le temps restant si nécessaire
      if (newStatus === TrackingStatus.EN_ROUTE) {
        setRemainingTime('10 min');
      } else if (newStatus === TrackingStatus.ARRIVED || newStatus === TrackingStatus.IN_PROGRESS) {
        setRemainingTime('0 min');
      }
      
      // Envoyer une notification au client
      sendClientNotification(newStatus);
      
      if (newStatus === TrackingStatus.COMPLETED) {
        Alert.alert(
          'Mission terminée',
          'La mission a été marquée comme terminée.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('PrestataireTabs', { screen: 'MyJobs' })
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error updating job status:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut de la mission');
    } finally {
      setUpdating(false);
    }
  };
  
  const getActionButton = () => {
    if (updating) {
      return (
        <Button
          variant="primary"
          label="Mise à jour en cours..."
          loading={true}
          style={styles.actionButton}
          disabled={true}
        />
      );
    }
    
    switch (job?.tracking_status) {
      case TrackingStatus.NOT_STARTED:
        return (
          <Button
            variant="primary"
            label="Démarrer la mission"
            icon={<Ionicons name="play" size={18} color="#fff" />}
            style={styles.actionButton}
            onPress={() => handleUpdateStatus(TrackingStatus.EN_ROUTE)}
          />
        );
      case TrackingStatus.EN_ROUTE:
        return (
          <Button
            variant="primary"
            label="Je suis arrivé(e)"
            icon={<Ionicons name="location" size={18} color="#fff" />}
            style={styles.actionButton}
            onPress={() => handleUpdateStatus(TrackingStatus.ARRIVED)}
          />
        );
      case TrackingStatus.ARRIVED:
        return (
          <Button
            variant="warning"
            label="Démarrer la prestation"
            icon={<Ionicons name="construct" size={18} color="#fff" />}
            style={styles.actionButton}
            onPress={() => handleUpdateStatus(TrackingStatus.IN_PROGRESS)}
          />
        );
      case TrackingStatus.IN_PROGRESS:
        return (
          <Button
            variant="success"
            label="Terminer la prestation"
            icon={<Ionicons name="checkmark-circle" size={18} color="#fff" />}
            style={styles.actionButton}
            onPress={() => handleUpdateStatus(TrackingStatus.COMPLETED)}
          />
        );
      case TrackingStatus.COMPLETED:
        return (
          <Button
            variant="success"
            label="Mission terminée"
            disabled={true}
            style={styles.actionButton}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="alert-circle-outline" size={60} color={COLORS.textSecondary} />
        </View>
        <Text variant="body1" color="text-secondary" style={styles.emptyText}>
          Mission introuvable
        </Text>
        <Button 
          label="Retour"
          variant="primary"
          onPress={() => navigation.goBack()}
          style={styles.marginTop}
        />
      </View>
    );
  }
  
  const getStatusIcon = (status: TrackingStatus) => {
    switch (status) {
      case TrackingStatus.NOT_STARTED:
        return <Ionicons name="time-outline" size={24} color={COLORS.textSecondary} />;
      case TrackingStatus.EN_ROUTE:
        return <Ionicons name="car-outline" size={24} color={COLORS.info} />;
      case TrackingStatus.ARRIVED:
        return <Ionicons name="location" size={24} color={COLORS.primary} />;
      case TrackingStatus.IN_PROGRESS:
        return <Ionicons name="construct-outline" size={24} color={COLORS.warning} />;
      case TrackingStatus.COMPLETED:
        return <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />;
      default:
        return <Ionicons name="help-circle-outline" size={24} color={COLORS.textSecondary} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Nous supprimons le header personnalisé car React Navigation en affiche déjà un */}
      {/*
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backIcon} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text variant="h4" weight="semibold">Suivi de mission</Text>
          <Text variant="body2" color="text-secondary">
            Mission #{job.id.substring(0, 8)}
          </Text>
        </View>
        <StatusBadge status={job.tracking_status} />
      </View>
      */}
      
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Carte du client */}
        {client && (
          <Card style={styles.card}>
            <View style={styles.clientCardContent}>
              <Avatar 
                size="lg" 
                initials={client.name?.substring(0, 2) || 'CL'} 
                backgroundColor={COLORS.accent}
              />
              <View style={styles.clientInfo}>
                <Text variant="h5" weight="semibold">{client.name || 'Client'}</Text>
                <Text 
                  variant="body2" 
                  color="text-secondary" 
                  style={styles.marginTopXs} 
                  numberOfLines={1}
                >
                  {client.location.address}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.contactIcon}
                onPress={() => navigation.navigate('Chat', { jobId: job.id })}
              >
                <Ionicons name="chatbubble-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.contactIcon, styles.marginLeft]}
                onPress={() => Alert.alert('Appel', 'Fonctionnalité d\'appel disponible prochainement')}
              >
                <Ionicons name="call-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </Card>
        )}
        
        {/* Carte de statut et ETA */}
        <Card style={styles.card}>
          <View style={styles.statusCard}>
            <View style={styles.statusIconContainer}>
              {getStatusIcon(job.tracking_status)}
            </View>
            <View style={styles.statusInfo}>
              <Text variant="body1" weight="medium">
                {job.tracking_status === TrackingStatus.NOT_STARTED && 'Mission à démarrer'}
                {job.tracking_status === TrackingStatus.EN_ROUTE && 'En route vers le client'}
                {job.tracking_status === TrackingStatus.ARRIVED && 'Arrivé chez le client'}
                {job.tracking_status === TrackingStatus.IN_PROGRESS && 'Prestation en cours'}
                {job.tracking_status === TrackingStatus.COMPLETED && 'Prestation terminée'}
              </Text>
              <Text variant="body2" color="text-secondary">
                {job.tracking_status === TrackingStatus.EN_ROUTE && remainingTime && `Temps d'arrivée estimé: ${remainingTime}`}
                {job.tracking_status === TrackingStatus.ARRIVED && 'Vous êtes arrivé(e) à destination'}
                {job.tracking_status === TrackingStatus.IN_PROGRESS && 'Continuez votre excellent travail'}
                {job.tracking_status === TrackingStatus.COMPLETED && 'Mission terminée avec succès'}
              </Text>
            </View>
          </View>
        </Card>
        
        {/* Carte d'adresse et navigation */}
        {client && (
          <Card style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="navigate" size={18} color={COLORS.primary} />
              <Text variant="h5" weight="semibold" style={styles.marginLeft}>
                Adresse du client
              </Text>
            </View>
            
            <View style={styles.sectionContent}>
              <Text variant="body1">{client.location.address}</Text>
              
              <TouchableOpacity 
                style={styles.mapsButton}
                onPress={() => Alert.alert('Navigation', 'Ouverture de la navigation GPS (fonctionnalité à venir)')}
              >
                <Ionicons name="navigate" size={20} color={COLORS.primary} />
                <Text variant="body2" weight="medium" color="primary" style={styles.marginLeft}>
                  Ouvrir dans Google Maps
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}
        
        {/* Carte de localisation */}
        <Card style={styles.card}>
          {/* Utiliser un titre plus discret pour éviter la confusion avec le header principal */}
          <View style={styles.sectionHeader}>
            <Ionicons name="navigate" size={18} color={COLORS.primary} />
            <Text variant="h5" weight="semibold" style={styles.marginLeft}>
              Carte de navigation
            </Text>
          </View>
          
          {location && client?.location ? (
            <View>
              {/* Carte interactive */}
              <View style={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  initialRegion={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }}
                >
                  {/* Marqueur pour le prestataire */}
                  <Marker
                    coordinate={{
                      latitude: location.latitude,
                      longitude: location.longitude
                    }}
                    title="Votre position"
                    pinColor="blue"
                  />

                  {/* Marqueur pour le client */}
                  <Marker
                    coordinate={{
                      latitude: client.location.latitude,
                      longitude: client.location.longitude
                    }}
                    title="Client"
                    pinColor="red"
                  />
                  
                  {/* Ligne qui relie les deux points */}
                  <Polyline
                    coordinates={[
                      { latitude: location.latitude, longitude: location.longitude },
                      { latitude: client.location.latitude, longitude: client.location.longitude }
                    ]}
                    strokeColor="#007AFF"
                    strokeWidth={3}
                  />
                </MapView>
              </View>
              
              {/* Actions de la carte */}
              <View style={styles.mapActions}>
                {/* Bouton pour suivre votre position */}
                <TouchableOpacity
                  style={styles.mapButton}
                  onPress={() => {
                    if (location && mapRef.current) {
                      try {
                        mapRef.current.animateToRegion({
                          latitude: location.latitude,
                          longitude: location.longitude,
                          latitudeDelta: 0.01,
                          longitudeDelta: 0.01,
                        }, 1000);
                      } catch (e) {
                        console.log('Erreur d\'animation:', e);
                      }
                    }
                  }}
                >
                  <Ionicons name="locate" size={18} color={COLORS.primary} />
                  <Text variant="caption" color="primary" style={styles.marginLeft}>
                    Ma position
                  </Text>
                </TouchableOpacity>
                
                {/* Bouton pour voir le client */}
                <TouchableOpacity
                  style={[styles.mapButton, styles.marginLeft]}
                  onPress={() => {
                    if (client?.location && mapRef.current) {
                      try {
                        mapRef.current.animateToRegion({
                          latitude: client.location.latitude,
                          longitude: client.location.longitude,
                          latitudeDelta: 0.01,
                          longitudeDelta: 0.01,
                        }, 1000);
                      } catch (e) {
                        console.log('Erreur d\'animation:', e);
                      }
                    }
                  }}
                >
                  <Ionicons name="home" size={18} color={COLORS.danger} />
                  <Text variant="caption" color="danger" style={styles.marginLeft}>
                    Position client
                  </Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.distanceContainer}>
                <Ionicons name="resize" size={18} color={COLORS.primary} />
                <Text variant="body1" weight="medium" color="primary" style={styles.marginLeft}>
                  Distance: {calculateDistance(
                    location.latitude,
                    location.longitude,
                    client.location.latitude,
                    client.location.longitude
                  )} km
                </Text>
              </View>
              
              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "blue" }]} />
                  <Text variant="body2">Vous</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "red" }]} />
                  <Text variant="body2">Client</Text>
                </View>
              </View>
              
              {/* Bloc optionnel d'arrivée estimée quand en route */}
              {job.tracking_status === TrackingStatus.EN_ROUTE && (
                <View style={styles.etaContainer}>
                  <Ionicons name="time-outline" size={20} color={COLORS.info} style={styles.marginRight} />
                  <Text variant="body1" weight="medium">
                    Arrivée estimée dans <Text color="primary">{remainingTime || '10 min'}</Text>
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.loadingPositionContainer}>
              <Ionicons name="location-outline" size={36} color={COLORS.textSecondary} />
              <Text variant="body1" color="text-secondary" style={styles.marginTop}>
                En attente de la position...
              </Text>
            </View>
          )}
        </Card>
        
        {/* Détails de la mission */}
        <Card style={[styles.card, styles.marginBottom]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={18} color={COLORS.primary} />
            <Text variant="h5" weight="semibold" style={styles.marginLeft}>
              Détails de la mission
            </Text>
          </View>
          
          <View style={styles.sectionContent}>
            <View style={styles.detailRow}>
              <Text variant="body2" weight="medium" color="text-secondary" style={styles.detailLabel}>
                Type de service:
              </Text>
              <Text variant="body2">{service?.name || job.requests?.services?.name || 'Service'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text variant="body2" weight="medium" color="text-secondary" style={styles.detailLabel}>
                Client:
              </Text>
              <Text variant="body2">{client?.name || 'Client'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text variant="body2" weight="medium" color="text-secondary" style={styles.detailLabel}>
                Urgence:
              </Text>
              <Text variant="body2">{job.requests?.urgency ? 
                (job.requests.urgency <= 2 ? 'Faible' : 
                job.requests.urgency <= 3 ? 'Moyenne' : 
                job.requests.urgency <= 4 ? 'Élevée' : 'Très élevée') : 'Moyenne'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text variant="body2" weight="medium" color="text-secondary" style={styles.detailLabel}>
                Description:
              </Text>
              <Text variant="body2" style={styles.flex1}>
                {job.requests?.notes || "Demande de service"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text variant="body2" weight="medium" color="text-secondary" style={styles.detailLabel}>
                Montant:
              </Text>
              <Text variant="body2" weight="medium" color="success">
                {job.offers?.price || '0,00'} €
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>
      
      {/* Boutons d'action */}
      <View style={styles.actionBar}>
        {getActionButton()}
        
        <Button
          variant="outline"
          label="Assistance"
          icon={<Ionicons name="help-circle-outline" size={20} color={COLORS.primary} />}
          onPress={() => Alert.alert('Assistance', 'Fonctionnalité d\'assistance disponible prochainement')}
          style={styles.assistanceButton}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    ...SHADOWS.small,
  },
  backIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  scrollContent: {
    flex: 1,
  },
  card: {
    margin: SPACING.md,
    marginBottom: SPACING.sm,
  },
  clientCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  sectionContent: {
    marginTop: SPACING.sm,
  },
  mapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
    backgroundColor: `${COLORS.primary}15`,
    borderRadius: BORDER_RADIUS.md,
  },
  locationContent: {
    marginTop: SPACING.sm,
  },
  // Styles pour la carte
  mapContainer: {
    overflow: 'hidden',
    height: 200,
    borderRadius: BORDER_RADIUS.md,
    marginVertical: SPACING.sm,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapActions: {
    flexDirection: 'row',
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
  positionGroup: {
    marginBottom: SPACING.md,
  },
  coordinatesContainer: {
    backgroundColor: COLORS.backgroundDark,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: `${COLORS.primary}15`,
    borderRadius: BORDER_RADIUS.md,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: SPACING.sm,
  },
  loadingPositionContainer: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  detailLabel: {
    width: 110,
  },
  actionBar: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
  marginBottomXs: {
    marginBottom: SPACING.xs,
  },
  marginBottom: {
    marginBottom: SPACING.xl,
  },
  actionButton: {
    marginBottom: SPACING.md,
  },
  assistanceButton: {
    marginTop: SPACING.sm,
  },
  flex1: {
    flex: 1,
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
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
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
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
});

export default JobTrackingScreen;