import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  SafeAreaView
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useAuth } from '../../context/AuthContext';
import { getRequestById, createOffer } from '../../services/api';
import { Request } from '../../types';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS, FONTS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Card, Badge, Button } from '../../components/ui';
import { getServiceById, getClientById } from '../../utils/mockData';

const { width } = Dimensions.get('window');

const RequestDetailScreen = ({ route, navigation }: any) => {
  const { requestId } = route.params;
  const [request, setRequest] = useState<Request | null>(null);
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [offerSent, setOfferSent] = useState(false);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchRequestDetails();
  }, [requestId]);

  const fetchRequestDetails = async () => {
    try {
      setLoading(true);
      const data = await getRequestById(requestId);
      setRequest(data);
    } catch (error) {
      console.error('Error fetching request details:', error);
      Alert.alert('Erreur', 'Impossible de récupérer les détails de la demande');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOffer = async () => {
    if (!user || !request) return;
    
    // Validation simple
    if (!price.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un prix');
      return;
    }
    
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un prix valide');
      return;
    }
    
    try {
      setSubmitting(true);
      
      await createOffer({
        request_id: requestId,
        prestataire_id: user.id,
        price: priceValue
      });
      
      setOfferSent(true);
      Alert.alert(
        'Offre envoyée',
        'Votre offre a été envoyée avec succès. Vous serez notifié si le client l\'accepte.',
        [
          { 
            text: 'OK', 
            onPress: () => navigation.goBack() 
          }
        ]
      );
    } catch (error) {
      console.error('Error submitting offer:', error);
      
      // Vérifier si l'erreur est due à une demande déjà acceptée
      const errorMessage = error instanceof Error ? error.message : 'Impossible d\'envoyer votre offre';
      
      if (errorMessage.includes('n\'est plus disponible')) {
        Alert.alert(
          'Demande non disponible',
          'Cette demande a déjà été acceptée par un autre prestataire ou n\'est plus disponible.',
          [
            { 
              text: 'OK', 
              onPress: () => navigation.goBack() 
            }
          ]
        );
      } else {
        Alert.alert('Erreur', errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
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
        <View style={styles.emptyIconContainer}>
          <Ionicons name="alert-circle-outline" size={60} color={COLORS.textSecondary} />
        </View>
        <Text variant="body1" color="text-secondary" style={styles.emptyText}>
          Demande introuvable
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

  // Formatez la date
  const date = new Date(request.created_at);
  const formattedDate = date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Get service icon
  const getServiceIcon = (serviceId: string) => {
    const serviceIcons: Record<string, string> = {
      '1': 'construct-outline',
      '2': 'color-wand-outline',
      '3': 'car-outline',
      '4': 'home-outline',
      '5': 'flower-outline',
      '6': 'flash-outline',
      '7': 'water-outline'
    };
    
    return serviceIcons[serviceId] || 'build-outline';
  };

  // Get status badge props
  const getStatusBadgeProps = (status: string) => {
    switch (status) {
      case 'pending':
        return { variant: 'warning', label: 'En attente' };
      case 'offered':
        return { variant: 'info', label: 'Offre envoyée' };
      case 'accepted':
        return { variant: 'primary', label: 'Acceptée' };
      case 'completed':
        return { variant: 'success', label: 'Terminée' };
      case 'cancelled':
        return { variant: 'danger', label: 'Annulée' };
      default:
        return { variant: 'secondary', label: 'Inconnu' };
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
        <Text variant="h4" weight="semibold">Détails de la demande</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card style={styles.infoCard}>
          <View style={styles.serviceSection}>
            <View style={styles.iconContainer}>
              <Ionicons name={getServiceIcon(request.service_id)} size={24} color={COLORS.primary} />
            </View>
            <View style={styles.serviceInfo}>
              <Text variant="h5" weight="semibold">{getServiceById(request.service_id)?.name || 'Service'}</Text>
              <View style={styles.statusRow}>
                <Badge
                  {...getStatusBadgeProps(request.status)}
                  size="sm"
                  border
                />
                <Text variant="caption" color="text-secondary" style={styles.dateText}>
                  {formattedDate}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.separator} />
          
          <View style={styles.urgencySection}>
            <Text variant="body2" weight="medium">Niveau d'urgence:</Text>
            <View style={styles.urgencyDots}>
              {[1, 2, 3, 4, 5].map(dot => (
                <View
                  key={dot}
                  style={[
                    styles.urgencyDot,
                    dot <= request.urgency ? styles.activeDot : styles.inactiveDot
                  ]}
                />
              ))}
            </View>
          </View>
        </Card>
        
        <Card style={styles.locationCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="location-outline" size={20} color={COLORS.primary} />
            <Text variant="h5" weight="semibold" style={styles.marginLeft}>
              Localisation
            </Text>
          </View>
          
          <View style={styles.addressContainer}>
            <Text variant="body2" color="text-secondary" style={styles.address}>
              {request.location.address}
            </Text>
          </View>
          
          {request.location.latitude && request.location.longitude && (
            <View style={styles.mapContainer}>
              <MapView
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{
                  latitude: request.location.latitude,
                  longitude: request.location.longitude,
                  latitudeDelta: 0.0922,
                  longitudeDelta: 0.0421,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: request.location.latitude,
                    longitude: request.location.longitude,
                  }}
                  title={request.location.address}
                />
              </MapView>
            </View>
          )}
        </Card>
        
        {request.notes && (
          <Card style={styles.notesCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
              <Text variant="h5" weight="semibold" style={styles.marginLeft}>
                Notes du client
              </Text>
            </View>
            <Text variant="body2" style={styles.noteText}>
              {request.notes}
            </Text>
          </Card>
        )}
        
        {!offerSent && (
          <Card style={styles.offerCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="cash-outline" size={20} color={COLORS.primary} />
              <Text variant="h5" weight="semibold" style={styles.marginLeft}>
                Faire une offre
              </Text>
            </View>
            
            <Text variant="body3" color="text-secondary" style={styles.offerDescription}>
              Proposez votre tarif pour cette prestation. Le client sera notifié et pourra accepter votre offre.
            </Text>
            
            <View style={styles.priceInputContainer}>
              <TextInput
                style={styles.priceInput}
                value={price}
                onChangeText={setPrice}
                placeholder="Votre prix"
                keyboardType="numeric"
                maxLength={10}
                placeholderTextColor={COLORS.textSecondary}
              />
              <View style={styles.euroContainer}>
                <Text variant="body1" weight="bold">€</Text>
              </View>
            </View>
            
            <Button
              label={submitting ? 'Envoi en cours...' : 'Envoyer mon offre'}
              variant="success"
              disabled={submitting}
              onPress={handleSubmitOffer}
            />
          </Card>
        )}
        
        <View style={{ height: 20 + insets.bottom }} />
      </ScrollView>
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
  placeholder: {
    width: 32,
  },
  scrollContent: {
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
  infoCard: {
    margin: SPACING.md,
    marginBottom: SPACING.sm,
  },
  locationCard: {
    margin: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  notesCard: {
    margin: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  offerCard: {
    margin: SPACING.md,
    marginTop: SPACING.sm,
  },
  serviceSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  serviceInfo: {
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  dateText: {
    marginLeft: SPACING.xs,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  urgencySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  urgencyDots: {
    flexDirection: 'row',
  },
  urgencyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 3,
  },
  activeDot: {
    backgroundColor: COLORS.accent,
  },
  inactiveDot: {
    backgroundColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  addressContainer: {
    marginBottom: SPACING.md,
  },
  address: {
    lineHeight: 20,
  },
  mapContainer: {
    height: 200,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  noteText: {
    lineHeight: 22,
  },
  offerDescription: {
    marginBottom: SPACING.md,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  priceInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 18,
    backgroundColor: COLORS.white,
  },
  euroContainer: {
    height: 50,
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundDark,
    borderTopRightRadius: BORDER_RADIUS.md,
    borderBottomRightRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: COLORS.border,
  },
  marginLeft: {
    marginLeft: SPACING.sm,
  },
  marginTop: {
    marginTop: SPACING.md,
  },
});

export default RequestDetailScreen;