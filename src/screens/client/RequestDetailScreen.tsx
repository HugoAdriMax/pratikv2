import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
  SafeAreaView
} from 'react-native';
import { getRequestById, getOffersByRequestId, acceptOffer } from '../../services/api';
import { Request, Offer, RequestStatus } from '../../types';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Card, Button, Badge, Avatar } from '../../components/ui';
import { LogBox } from 'react-native';

// Ignorer certaines erreurs non critiques
LogBox.ignoreLogs(['Text strings must be rendered within a <Text> component']);

const RequestDetailScreen = ({ route, navigation }: any) => {
  const { requestId } = route.params;
  const [request, setRequest] = useState<Request | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchRequestDetails();
  }, [requestId]);

  const fetchRequestDetails = async () => {
    try {
      setLoading(true);
      
      // Récupérer les détails de la demande (sans chercher prestataire_status car il n'existe pas encore)
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

  const handleAcceptOffer = async (offerId: string) => {
    try {
      setAccepting(true);
      
      // Accepter l'offre
      await acceptOffer(offerId);
      
      // Mettre à jour l'état local
      setRequest(prev => prev ? { ...prev, status: RequestStatus.ACCEPTED } : null);
      
      // Mettre à jour le statut des offres dans l'état local
      setOffers(prev => 
        prev.map(offer => ({
          ...offer,
          status: offer.id === offerId ? 'accepted' : 'rejected'
        }))
      );
      
      // Montrer un message de succès
      Alert.alert(
        'Offre acceptée !',
        'L\'offre a été acceptée avec succès. Vous allez être redirigé vers l\'écran de suivi.',
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Naviguer vers l'écran de suivi
              navigation.navigate('TrackingScreen', { offerId });
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error accepting offer:', error);
      // Afficher l'erreur exacte pour mieux diagnostiquer les problèmes
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Impossible d\'accepter l\'offre';
      
      Alert.alert(
        'Erreur lors de l\'acceptation', 
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

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.serviceContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name={serviceIcon} size={24} color={COLORS.primary} />
            </View>
            <View style={styles.serviceInfo}>
              <Text variant="h4" weight="semibold">
                {request.service_id.replace(/-/g, ' ').split(' ')[0]}
              </Text>
              <Badge 
                variant={badgeProps.variant as any} 
                label={badgeProps.label} 
                size="sm"
                border
                style={styles.marginTopXs}
              />
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.textSecondary} />
            <Text variant="body2" color="text-secondary" style={styles.marginLeft}>
              Créée le {formatDate(request.created_at)}
            </Text>
          </View>
        </View>
        
        <Card style={styles.card} elevation="sm">
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle-outline" size={22} color={COLORS.primary} />
            <Text variant="h5" weight="semibold" style={styles.marginLeft}>
              Informations
            </Text>
          </View>
          
          <View style={styles.separator} />
          
          <View style={styles.detailContainer}>
            <Text variant="body2" color="text-secondary">Urgence</Text>
            <View style={styles.urgencyContainer}>
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
          
          <View style={styles.detailContainer}>
            <Text variant="body2" color="text-secondary">Référence</Text>
            <Text variant="body2" weight="medium">#{request.id.substring(0, 8)}</Text>
          </View>
        </Card>
        
        <Card style={styles.card} elevation="sm">
          <View style={styles.cardHeader}>
            <Ionicons name="location-outline" size={22} color={COLORS.primary} />
            <Text variant="h5" weight="semibold" style={styles.marginLeft}>
              Adresse
            </Text>
          </View>
          
          <View style={styles.separator} />
          
          <Text variant="body2" style={styles.address}>{request.location.address}</Text>
          
          <View style={styles.mapContainer}>
            <View style={styles.mapPlaceholder}>
              <Ionicons name="map-outline" size={30} color={COLORS.textSecondary} />
              <Text variant="caption" color="text-secondary" style={styles.marginTop}>
                Carte non disponible
              </Text>
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
        
        {/* Offres reçues */}
        {offers.length > 0 && (
          <Card style={styles.card} elevation="sm">
            <View style={styles.cardHeader}>
              <Ionicons name="pricetags-outline" size={22} color={COLORS.primary} />
              <Text variant="h5" weight="semibold" style={styles.marginLeft}>
                Offres reçues
              </Text>
            </View>
            
            <View style={styles.separator} />
            
            {offers.map(offer => (
              <View key={offer.id} style={styles.offerCard}>
                <View style={styles.offerHeader}>
                  <View style={styles.providerContainer}>
                    <Avatar
                      size="md"
                      initials="P"
                      backgroundColor={COLORS.secondary}
                    />
                    <Text variant="body1" weight="medium" style={styles.marginLeft}>
                      Prestataire
                    </Text>
                  </View>
                  <View style={styles.priceContainer}>
                    <Text variant="body1" weight="semibold" color="success">
                      {offer.price} €
                    </Text>
                  </View>
                </View>
                
                <View style={styles.offerActions}>
                  {request.status === RequestStatus.OFFERED && (
                    <Button
                      variant="success"
                      label="Accepter l'offre"
                      loading={accepting}
                      onPress={() => handleAcceptOffer(offer.id)}
                      size="sm"
                    />
                  )}
                  
                  {offer.status === 'accepted' && (
                    <Badge variant="success" label="Offre acceptée" border />
                  )}
                  
                  {offer.status === 'rejected' && (
                    <Badge variant="danger" label="Offre refusée" border />
                  )}
                </View>
              </View>
            ))}
          </Card>
        )}
        
        {request.status === RequestStatus.PENDING && (
          <Card style={[styles.card, styles.marginBottom]} elevation="sm">
            <View style={styles.waitingContainer}>
              <View style={styles.loadingIconContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
              <Text variant="body1" weight="medium" color="text-secondary" style={styles.marginTop}>
                En attente de réponses de prestataires...
              </Text>
              <Text variant="body2" color="text-secondary" style={styles.marginTopXs}>
                Vous recevrez une notification dès qu'une offre sera disponible.
              </Text>
            </View>
          </Card>
        )}
        
        {/* Actions en bas */}
        <View style={[styles.actionsContainer, { marginBottom: insets.bottom > 0 ? 0 : 20 }]}>
          {request.status === RequestStatus.ACCEPTED && (
            <Button
              variant="primary"
              label="Suivre en temps réel"
              icon={<Ionicons name="location" size={20} color={COLORS.white} />}
              onPress={() => navigation.navigate('TrackingScreen', { offerId: offers.find(o => o.status === 'accepted')?.id })}
              style={styles.marginBottom}
            />
          )}
          
          {(request.status === RequestStatus.PENDING || request.status === RequestStatus.OFFERED) && (
            <Button
              variant="danger"
              label="Annuler ma demande"
              icon={<Ionicons name="close-circle" size={20} color={COLORS.white} />}
              onPress={() => Alert.alert('Fonctionnalité', 'Cette fonctionnalité sera disponible prochainement')}
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