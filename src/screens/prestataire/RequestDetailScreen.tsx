import React, { useState, useEffect, useRef } from 'react';
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
// Import de MapView temporairement désactivé pour résoudre le bug
// import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useAuth } from '../../context/AuthContext';
import { getRequestById, createOffer } from '../../services/api';
import { Request } from '../../types';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS, FONTS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Card, Badge, Button } from '../../components/ui';
import { getServiceById } from '../../services/api';

const { width } = Dimensions.get('window');

const RequestDetailScreen = ({ route, navigation }: any) => {
  const { requestId } = route.params;
  const [request, setRequest] = useState<Request | null>(null);
  const [service, setService] = useState<any>(null);
  // Déclaration de l'état price avec un useRef pour éviter les problèmes de focus
  const [priceValue, setPriceValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const priceInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [offerSent, setOfferSent] = useState(false);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchRequestDetails();
  }, [requestId]);

  // Focus on price input whenever the component renders and is not in loading state
  useEffect(() => {
    if (!loading && priceInputRef.current) {
      setTimeout(() => {
        priceInputRef.current?.focus();
      }, 500); // Delay to ensure component is fully rendered
    }
  }, [loading]);

  const fetchRequestDetails = async () => {
    try {
      setLoading(true);
      const data = await getRequestById(requestId);
      setRequest(data);
      
      // Charger les informations du service
      if (data && data.service_id) {
        try {
          const serviceData = await getServiceById(data.service_id);
          setService(serviceData);
        } catch (serviceError) {
          console.error('Erreur lors du chargement du service:', serviceError);
          // Continuer même si le service ne se charge pas
        }
      }
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
    if (!priceValue.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un prix');
      return;
    }
    
    const parsedPrice = parseFloat(priceValue);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un prix valide');
      return;
    }
    
    try {
      setSubmitting(true);
      
      await createOffer({
        request_id: requestId,
        prestataire_id: user.id,
        price: parsedPrice
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
      
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Entête de service amélioré */}
        <Card style={styles.serviceHeaderCard}>
          <View style={styles.serviceHeaderContent}>
            <View style={styles.serviceHeaderLeft}>
              <View style={styles.serviceIconLarge}>
                <Ionicons name={getServiceIcon(request.service_id)} size={30} color="#FFFFFF" />
              </View>
              <View style={styles.serviceHeaderInfo}>
                <Text style={styles.serviceHeaderTitle}>{service?.name || request.service_id || 'Service'}</Text>
                <Badge
                  {...getStatusBadgeProps(request.status)}
                  size="sm"
                  border
                  style={styles.serviceBadge}
                />
              </View>
            </View>
            <View style={styles.serviceHeaderRight}>
              <View style={styles.urgencyContainer}>
                <Text style={styles.urgencyLabel}>URGENCE</Text>
                <View style={styles.urgencyBarContainer}>
                  <View style={[
                    styles.urgencyBar, 
                    request.urgency <= 2 ? styles.urgencyLow : 
                    request.urgency <= 4 ? styles.urgencyMedium : 
                    styles.urgencyHigh
                  ]} />
                </View>
                <Text style={styles.urgencyValue}>
                  {request.urgency <= 2 ? 'Faible' : 
                   request.urgency <= 4 ? 'Moyenne' : 
                   'Élevée'}
                </Text>
              </View>
              <Text style={styles.dateDisplay}>{formattedDate}</Text>
            </View>
          </View>
        </Card>
        
        {/* Composant pour faire une offre - Déplacé en haut */}
        {!offerSent && (
          <Card style={styles.offerCardEnhanced}>
            <View style={styles.offerHeaderGradient}>
              <View style={styles.offerHeaderIcon}>
                <Ionicons name="cash" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.offerHeaderTextContainer}>
                <Text style={styles.offerHeaderTitle}>Proposer votre tarif</Text>
                <Text style={styles.offerHeaderSubtitle}>Envoyez une offre à ce client</Text>
              </View>
            </View>
            
            <View style={styles.offerContentContainer}>
              <View style={styles.offerInstructionCard}>
                <Ionicons name="information-circle" size={22} color={COLORS.info} style={styles.offerInstructionIcon} />
                <Text style={styles.offerInstructionText}>
                  Le client sera notifié immédiatement et pourra accepter votre offre. Vous serez mis en relation dès confirmation.
                </Text>
              </View>
              
              <Text style={styles.priceInputLabel}>MONTANT PROPOSÉ (TTC)</Text>
              <View style={styles.priceInputContainer}>
                <View style={[
                  styles.priceInputWrapper,
                  isFocused && styles.priceInputWrapperFocused
                ]}>
                  <Ionicons 
                    name="cash-outline" 
                    size={22} 
                    color={isFocused ? COLORS.primary : COLORS.textSecondary} 
                    style={styles.priceInputIcon}
                  />
                  <TextInput
                    ref={priceInputRef}
                    style={styles.priceInputEnhanced}
                    value={priceValue}
                    onChangeText={(text) => {
                      setPriceValue(text);
                      // Maintien du focus après chaque caractère saisi
                      setTimeout(() => {
                        if (priceInputRef.current) {
                          priceInputRef.current.focus();
                        }
                      }, 10);
                    }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Ex: 80"
                    keyboardType="numeric"
                    maxLength={10}
                    placeholderTextColor={COLORS.textSecondary}
                    autoCorrect={false}
                    spellCheck={false}
                  />
                </View>
                <View style={styles.euroSymbolContainer}>
                  <Text style={[styles.euroSymbolText, isFocused && styles.euroSymbolTextFocused]}>€</Text>
                </View>
                <View style={[styles.inputHighlight, isFocused && styles.inputHighlightFocused]} />
              </View>
              
              <View style={styles.offerNotesContainer}>
                <View style={styles.offerNoteItem}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                  <Text style={styles.offerNoteText}>Paiement sécurisé via l'application</Text>
                </View>
                <View style={styles.offerNoteItem}>
                  <Ionicons name="shield-checkmark" size={18} color={COLORS.primary} />
                  <Text style={styles.offerNoteText}>Montant débloqué après validation client</Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={[
                  styles.submitOfferButton,
                  submitting && styles.submitOfferButtonDisabled
                ]}
                disabled={submitting}
                onPress={handleSubmitOffer}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                    <Text style={styles.submitOfferButtonText}>
                      {submitting ? 'Envoi en cours...' : 'Envoyer mon offre'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Card>
        )}
        
        {/* Localisation améliorée */}
        <Card style={styles.locationCardEnhanced}>
          <View style={styles.locationHeaderGradient}>
            <View style={styles.locationContent}>
              <View style={styles.locationIcon}>
                <Ionicons name="location" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationLabel}>ADRESSE D'INTERVENTION</Text>
                <Text style={styles.locationAddress}>
                  {request.location && request.location.address ? request.location.address : "Adresse non disponible"}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.directionsButton}
                onPress={() => {
                  if (request.location && request.location.latitude && request.location.longitude) {
                    Alert.alert(
                      "Ouvrir Maps",
                      "Souhaitez-vous ouvrir cette adresse dans Google Maps?",
                      [
                        {
                          text: "Annuler",
                          style: "cancel"
                        },
                        {
                          text: "Ouvrir",
                          onPress: () => Alert.alert("Navigation", "La fonction d'ouverture de maps sera disponible dans une prochaine mise à jour.")
                        }
                      ]
                    );
                  }
                }}
              >
                <Ionicons name="navigate" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.locationFeaturesContainer}>
            <View style={styles.locationFeatureItem}>
              <View style={[styles.featureIconContainer, { backgroundColor: `${COLORS.success}15` }]}>
                <Ionicons name="location-outline" size={20} color={COLORS.success} />
              </View>
              <Text style={styles.featureText}>Adresse vérifiée</Text>
            </View>
            
            <View style={styles.locationFeatureItem}>
              <View style={[styles.featureIconContainer, { backgroundColor: `${COLORS.info}15` }]}>
                <Ionicons name="navigate-circle-outline" size={20} color={COLORS.info} />
              </View>
              <Text style={styles.featureText}>Navigation disponible</Text>
            </View>
          </View>
        </Card>
        
        {/* Notes du client améliorées */}
        {request.notes && (
          <Card style={styles.notesCardEnhanced}>
            <View style={styles.notesCardHeader}>
              <Text style={styles.notesCardTitle}>NOTES DU CLIENT</Text>
            </View>
            
            <View style={styles.notesContainer}>
              <View style={styles.notesIconContainer}>
                <Ionicons name="chatbubble-ellipses" size={28} color={COLORS.accent} />
              </View>
              <View style={styles.notesContent}>
                <Text style={styles.notesText}>
                  {request.notes}
                </Text>
              </View>
            </View>
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
  
  // Nouveaux styles pour l'en-tête de service amélioré
  serviceHeaderCard: {
    margin: SPACING.md,
    borderRadius: 16,
    overflow: 'hidden',
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
    ...SHADOWS.medium,
  },
  serviceHeaderContent: {
    flexDirection: 'column',
  },
  serviceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
  serviceHeaderInfo: {
    flex: 1,
  },
  serviceHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  serviceBadge: {
    alignSelf: 'flex-start',
  },
  serviceHeaderRight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  urgencyContainer: {
    alignItems: 'flex-start',
  },
  urgencyLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  urgencyBarContainer: {
    width: 100,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 4,
    overflow: 'hidden',
  },
  urgencyBar: {
    height: '100%',
    width: '60%',
    borderRadius: 4,
  },
  urgencyLow: {
    backgroundColor: '#4CAF50', // Vert
    width: '40%',
  },
  urgencyMedium: {
    backgroundColor: '#FF9800', // Orange
    width: '70%',
  },
  urgencyHigh: {
    backgroundColor: '#F44336', // Rouge
    width: '100%',
  },
  urgencyValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  dateDisplay: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  
  // Styles pour le composant d'offre amélioré
  offerCardEnhanced: {
    margin: SPACING.md,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 0,
    backgroundColor: '#FFFFFF',
    ...SHADOWS.medium,
  },
  offerHeaderGradient: {
    backgroundColor: COLORS.primary,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  offerHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  offerHeaderTextContainer: {
    flex: 1,
  },
  offerHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  offerHeaderSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  offerContentContainer: {
    padding: 16,
  },
  offerInstructionCard: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: `${COLORS.info}10`,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.info,
  },
  offerInstructionIcon: {
    marginRight: 12,
  },
  offerInstructionText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
    lineHeight: 20,
  },
  priceInputLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
    marginBottom: 12,
    marginLeft: 4,
  },
  // Anciens styles gardés pour compatibilité
  priceInputContainerEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  priceInputEnhanced: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: 'bold',
    backgroundColor: '#FFFFFF',
  },
  euroContainerEnhanced: {
    height: 56,
    width: 56,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: '#E0E0E0',
  },
  euroSymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  
  // Styles améliorés pour le champ de prix
  priceInputContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  priceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFC',
    borderRadius: 12,
    height: 60,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    ...SHADOWS.small,
    transition: '0.3s',
  },
  priceInputWrapperFocused: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0F4FF',
    ...SHADOWS.medium,
  },
  priceInputIcon: {
    marginRight: 12,
  },
  priceInputEnhanced: {
    flex: 1,
    height: '100%',
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary,
    paddingRight: 40,
  },
  euroSymbolContainer: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  euroSymbolText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary,
    opacity: 0.8,
  },
  euroSymbolTextFocused: {
    opacity: 1,
  },
  inputHighlight: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    bottom: -2,
    left: '10%',
    width: '80%',
    opacity: 0.3,
  },
  inputHighlightFocused: {
    opacity: 0.8,
  },
  offerNotesContainer: {
    marginBottom: 20,
  },
  offerNoteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  offerNoteText: {
    fontSize: 14,
    color: COLORS.text,
    marginLeft: 8,
  },
  submitOfferButton: {
    backgroundColor: COLORS.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    ...SHADOWS.small,
  },
  submitOfferButtonDisabled: {
    backgroundColor: COLORS.border,
    opacity: 0.7,
  },
  submitOfferButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  
  // Styles pour la localisation améliorée
  locationCardEnhanced: {
    margin: SPACING.md,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 0,
    backgroundColor: '#FFFFFF',
    ...SHADOWS.medium,
  },
  locationHeaderGradient: {
    backgroundColor: COLORS.accent,
    padding: 16,
  },
  locationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  directionsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  locationFeaturesContainer: {
    padding: 16,
  },
  locationFeatureItem: {
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
  
  // Styles pour les notes du client améliorées
  notesCardEnhanced: {
    margin: SPACING.md,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 0,
    backgroundColor: '#FFFFFF',
    ...SHADOWS.medium,
  },
  notesCardHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  notesCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.primary,
  },
  notesContainer: {
    padding: 16,
    flexDirection: 'row',
  },
  notesIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: `${COLORS.accent}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  notesContent: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    ...SHADOWS.small,
  },
  notesText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
  },
  
  // Anciens styles conservés pour la compatibilité
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  address: {
    lineHeight: 20,
  },
  noteText: {
    lineHeight: 22,
  },
  marginLeft: {
    marginLeft: SPACING.sm,
  },
  marginTop: {
    marginTop: SPACING.md,
  },
});

export default RequestDetailScreen;