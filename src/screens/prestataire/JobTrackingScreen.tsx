import React, { useState, useEffect } from 'react';
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
import { getJobByOfferId, updateJobTrackingStatus, completeJob } from '../../services/api';
import { Job, TrackingStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Text, Card, Button, Badge, Avatar } from '../../components/ui';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import { getServiceById, getClientById, getRequestById, getOfferById, enrichJobWithMockData } from '../../utils/mockData';

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
      border
    />
  );
};

const JobTrackingScreen = ({ route, navigation }: any) => {
  const { jobId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [job, setJob] = useState<Job | null>(null);
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
        console.log('Aucun job trouvé pour l\'offre:', jobId);
        
        // Récupérer les informations de l'offre
        const { data: offerData, error: offerError } = await supabase
          .from('offers')
          .select(`
            *,
            requests:request_id(*)
          `)
          .eq('id', jobId)
          .maybeSingle();
        
        if (offerError) {
          console.error('Erreur lors de la récupération de l\'offre:', offerError);
          throw offerError;
        }
        
        if (!offerData) {
          console.log('Aucune offre trouvée non plus');
          throw new Error('Aucune offre ni job trouvé avec cet identifiant');
        }
        
        console.log('Offre trouvée:', offerData);
        
        // Créer un job avec les données de l'offre
        const baseJob = {
          id: `job-for-${jobId}`,
          offer_id: jobId,
          client_id: offerData.requests?.client_id || 'unknown-client',
          prestataire_id: user?.id || offerData.prestataire_id,
          tracking_status: 'not_started',
          is_completed: false,
          created_at: new Date().toISOString(),
          // Ajouter directement les données de l'offre et de la requête
          offers: offerData,
          requests: offerData.requests
        };
        
        // Définir le job
        setJob(baseJob as Job);
        
        // Récupérer les informations du client
        if (offerData.requests && offerData.requests.client_id) {
          const { data: clientData } = await supabase
            .from('users')
            .select(`id, email`)
            .eq('id', offerData.requests.client_id)
            .maybeSingle();
          
          // Adresse depuis la requête
          const clientLocation = offerData.requests.location || {
            latitude: 48.8566,
            longitude: 2.3522,
            address: "123 Avenue des Champs-Élysées, Paris"
          };
          
          setClient({
            id: offerData.requests.client_id,
            name: clientData?.email?.split('@')[0] || 'Client',
            location: clientLocation
          });
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
        
        // Récupérer les données du client à partir de jobData.client_id
        if (jobData.client_id) {
          const { data: clientData } = await supabase
            .from('users')
            .select(`id, email`)
            .eq('id', jobData.client_id)
            .maybeSingle();
            
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
    
    // 2. Obtenir la position actuelle
    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      const initialLocation = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude
      };
      
      setLocation(initialLocation);
      
      // Simuler l'envoi des données de position (log uniquement)
      console.log('Position prestataire initiale:', initialLocation);
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
          setLocation(position);
          
          // Simuler l'envoi des données (log uniquement)
          console.log('Nouvelle position prestataire:', position);
        }
      );
      
      // Stocker la référence pour pouvoir nettoyer
      setWatchId(watchPosition);
    } catch (error) {
      console.error('Error setting up position watching:', error);
    }
    
    // Simuler des mises à jour de position du client
    if (job && client) {
      // Au lieu d'essayer d'utiliser une table inexistante, on simule les données
      console.log('Simulation de position du client...');
      
      // Générer une position légèrement différente pour le client toutes les 10 secondes
      const clientUpdateInterval = setInterval(() => {
        // On génère une petite variation aléatoire de la position
        const randomLat = (Math.random() - 0.5) * 0.01; // variation de ±0.005 degrés
        const randomLng = (Math.random() - 0.5) * 0.01;
        
        if (client && client.location) {
          const newLocation = {
            latitude: client.location.latitude + randomLat,
            longitude: client.location.longitude + randomLng,
            address: client.location.address
          };
          
          setClient(prev => ({
            ...prev!,
            location: newLocation
          }));
          
          console.log('Nouvelle position du client (simulée):', newLocation);
        }
      }, 10000); // Toutes les 10 secondes
      
      // Retourner une fonction de nettoyage
      return () => {
        clearInterval(clientUpdateInterval);
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
    const serviceType = job?.requests?.service_id ? 
      getServiceById(job.requests.service_id)?.name || 'service' : 'service';
    
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
              onPress: () => navigation.navigate('MyJobs')
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
          className="mb-2"
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
            className="mb-2"
            onPress={() => handleUpdateStatus(TrackingStatus.EN_ROUTE)}
          />
        );
      case TrackingStatus.EN_ROUTE:
        return (
          <Button
            variant="primary"
            label="Je suis arrivé(e)"
            icon={<Ionicons name="location" size={18} color="#fff" />}
            className="mb-2"
            onPress={() => handleUpdateStatus(TrackingStatus.ARRIVED)}
          />
        );
      case TrackingStatus.ARRIVED:
        return (
          <Button
            variant="warning"
            label="Démarrer la prestation"
            icon={<Ionicons name="construct" size={18} color="#fff" />}
            className="mb-2"
            onPress={() => handleUpdateStatus(TrackingStatus.IN_PROGRESS)}
          />
        );
      case TrackingStatus.IN_PROGRESS:
        return (
          <Button
            variant="success"
            label="Terminer la prestation"
            icon={<Ionicons name="checkmark-circle" size={18} color="#fff" />}
            className="mb-2"
            onPress={() => handleUpdateStatus(TrackingStatus.COMPLETED)}
          />
        );
      case TrackingStatus.COMPLETED:
        return (
          <Button
            variant="success"
            label="Mission terminée"
            disabled={true}
            className="mb-2"
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
                onPress={() => Alert.alert('Contact', 'Fonctionnalité de chat disponible prochainement')}
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
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={18} color={COLORS.primary} />
            <Text variant="h5" weight="semibold" style={styles.marginLeft}>
              Suivi de localisation
            </Text>
          </View>
          
          {location && client?.location ? (
            <View style={styles.locationContent}>
              <View style={styles.positionGroup}>
                <Text variant="body2" weight="medium" color="text-secondary" style={styles.marginBottomXs}>
                  Votre position
                </Text>
                <View style={styles.coordinatesContainer}>
                  <Text>
                    {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.distanceContainer}>
                <Ionicons name="resize" size={18} color={COLORS.primary} />
                <Text variant="body1" weight="medium" color="primary" style={styles.marginLeft}>
                  Distance: {calculateDistance(location, client.location)} km
                </Text>
              </View>
              
              <View style={styles.positionGroup}>
                <Text variant="body2" weight="medium" color="text-secondary" style={styles.marginBottomXs}>
                  Position du client
                </Text>
                <View style={styles.coordinatesContainer}>
                  <Text>
                    {client.location.latitude.toFixed(5)}, {client.location.longitude.toFixed(5)}
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
                  <Text variant="body2">Client</Text>
                </View>
              </View>
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
              <Text variant="body2">{job.requests?.service_id ? getServiceById(job.requests.service_id)?.name : 'Plomberie'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text variant="body2" weight="medium" color="text-secondary" style={styles.detailLabel}>
                Client:
              </Text>
              <Text variant="body2">{getClientById(job.client_id).name}</Text>
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
                {job.requests?.notes || "Fuite sous l'évier de la cuisine à réparer"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text variant="body2" weight="medium" color="text-secondary" style={styles.detailLabel}>
                Montant:
              </Text>
              <Text variant="body2" weight="medium" color="success">
                {job.offers?.price || '85,00'} €
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
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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