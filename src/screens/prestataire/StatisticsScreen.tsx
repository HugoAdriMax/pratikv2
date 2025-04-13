import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Modal,
  TouchableOpacity,
  FlatList,
  Animated,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import supabase from '../../config/supabase';
import { COLORS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import { Text, Card, Button } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useIsFocused } from '@react-navigation/native';

// Types pour les données statistiques
interface StatisticsData {
  totalEarnings: number;
  pendingEarnings: number;
  completedJobs: number;
  pendingJobs: number;
  averageRating: number;
  transactionHistory: Transaction[];
}

interface Transaction {
  id: string;
  amount: number;
  created_at: string;
  payment_status: string;
  job_id: string;
  service_name?: string;
  client_name?: string;
}

interface PaymentDetails {
  totalAmount: number;
  count: number;
  payments: {
    amount: number;
    serviceName: string;
    clientName: string;
  }[];
}

const StatisticsScreen = () => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentDetailsVisible, setPaymentDetailsVisible] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [stats, setStats] = useState<StatisticsData>({
    totalEarnings: 0,
    pendingEarnings: 0,
    completedJobs: 0,
    pendingJobs: 0,
    averageRating: 0,
    transactionHistory: []
  });

  // Fonction pour charger les statistiques du prestataire
  const loadStatistics = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Récupérer directement toutes les missions du prestataire
      console.log("Récupération des missions pour le prestataire ID:", user.id);
      
      // 1. Récupérer tous les jobs terminés du prestataire
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          id,
          offer_id,
          client_id,
          is_completed,
          created_at,
          completed_at,
          users:client_id (name)
        `)
        .eq('prestataire_id', user.id)
        .eq('is_completed', true)
        .order('created_at', { ascending: false });

      if (jobsError) {
        console.error('Erreur lors de la récupération des jobs:', jobsError);
        throw jobsError;
      }
      
      console.log("Missions terminées trouvées:", jobs?.length || 0);
      
      // 2. Pour chaque job, récupérer l'offre correspondante pour obtenir le prix
      const completedMissions = [];
      if (jobs && jobs.length > 0) {
        for (const job of jobs) {
          if (job.offer_id) {
            // Récupérer l'offre pour obtenir le prix
            const { data: offerData } = await supabase
              .from('offers')
              .select(`
                id,
                price,
                request_id
              `)
              .eq('id', job.offer_id)
              .single();
              
            if (offerData) {
              // Récupérer le service associé à la demande
              const { data: requestData } = await supabase
                .from('requests')
                .select(`
                  id,
                  service_id,
                  services:service_id (name)
                `)
                .eq('id', offerData.request_id)
                .single();
                
              // Ajouter toutes les informations à la mission
              const missionWithDetails = {
                ...job,
                price: offerData.price || 0,
                client_name: job.users?.name || 'Client inconnu',
                service_name: requestData?.services?.name || 'Service',
                // Calculer le montant net (90% du prix, après commission de 10%)
                net_amount: offerData.price * 0.9
              };
              
              completedMissions.push(missionWithDetails);
              console.log(`Mission ${completedMissions.length}: ID=${job.id}, Prix=${offerData.price}€, Net=${missionWithDetails.net_amount}€`);
            }
          }
        }
      }
      
      // Créer des transactions virtuelles à partir des missions pour la compatibilité avec le reste du code
      const completedTransactions = completedMissions.map(mission => ({
        id: mission.id,
        amount: mission.price || 0,
        net_amount: mission.net_amount || 0,
        created_at: mission.completed_at || mission.created_at,
        payment_status: 'completed',
        job_id: mission.id,
        client_name: mission.client_name,
        service_name: mission.service_name
      }));

      // Récupérer les évaluations du prestataire
      const { data: reviews, error: reviewsError } = await supabase
        .from('reviews')
        .select('rating')
        .eq('reviewed_user_id', user.id);

      if (reviewsError) {
        console.error('Erreur lors de la récupération des évaluations:', reviewsError);
        throw reviewsError;
      }

      // Calculer la note moyenne
      const averageRating = reviews && reviews.length > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
        : 0;

      // Transformer les transactions pour l'affichage
      const formattedTransactions = completedTransactions ? completedTransactions.map(transaction => ({
        id: transaction.id,
        amount: transaction.net_amount || 0, // Montant après commission
        created_at: transaction.created_at,
        payment_status: transaction.payment_status,
        job_id: transaction.job_id,
        service_name: transaction.service_name || 'Service inconnu',
        client_name: transaction.client_name || 'Client inconnu'
      })) : [];

      // Afficher les informations pour le débogage
      console.log("Nombre de transactions formatées:", formattedTransactions.length);
      formattedTransactions.forEach((t, i) => {
        console.log(`Transaction formatée ${i+1}: ${t.amount}€`);
      });
      
      // Calculer les revenus totaux à partir des transactions terminées (après commission)
      const totalEarnings = completedTransactions && completedTransactions.length > 0 
        ? completedTransactions.reduce((sum, transaction) => sum + (transaction.net_amount || 0), 0)
        : 0;
      
      console.log("Revenus totaux calculés:", totalEarnings);
      
      // Pas besoin de calculer les revenus en attente (on le retire selon la demande)
      const pendingEarnings = 0;

      // Utiliser directement le nombre de transactions terminées
      const completedJobs = completedTransactions ? completedTransactions.length : 0;
      console.log("Nombre total de transactions terminées:", completedJobs);
      
      // On ne compte plus les missions en attente, on l'a supprimé selon la demande
      const pendingJobs = 0;

      // Nous avons supprimé le calcul des revenus mensuels car nous n'affichons plus le graphique

      // Mettre à jour l'état avec toutes les statistiques
      setStats({
        totalEarnings,
        pendingEarnings,
        completedJobs,
        pendingJobs,
        averageRating,
        transactionHistory: formattedTransactions.slice(0, 10) // Limiter à 10 transactions
      });
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Charger les statistiques au montage du composant
  useEffect(() => {
    loadStatistics();
  }, [user]);
  
  // Vérifier si des détails de paiement ont été passés via la navigation
  useEffect(() => {
    if (isFocused && route.params) {
      const params = route.params as any;
      
      if (params.showPaymentDetails && params.paymentData) {
        setPaymentDetails(params.paymentData);
        setPaymentDetailsVisible(true);
        
        // Effacer les paramètres après le traitement pour éviter de réafficher la modale
        // lors des focus suivants
        navigation.setParams({ showPaymentDetails: undefined, paymentData: undefined });
        
        // Animation d'entrée
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [isFocused, route.params]);

  // Fonction pour le rafraîchissement manuel
  const onRefresh = async () => {
    setRefreshing(true);
    await loadStatistics();
  };

  // Formater les montants pour l'affichage
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    });
  };

  // Fonction pour obtenir une couleur d'icône pour le statut du paiement
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return COLORS.success;
      case 'pending':
      case 'processing':
        return COLORS.warning;
      case 'failed':
      case 'refunded':
        return COLORS.danger;
      default:
        return COLORS.textSecondary;
    }
  };

  // Fonction pour obtenir une icône pour le statut du paiement
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return 'checkmark-circle';
      case 'pending':
      case 'processing':
        return 'time';
      case 'failed':
        return 'close-circle';
      case 'refunded':
        return 'return-down-back';
      default:
        return 'help-circle';
    }
  };

  // Formatage de la date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement des statistiques...</Text>
      </View>
    );
  }

  // Fermer la modale des détails de paiement
  const closePaymentDetails = () => {
    // Animation de sortie
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setPaymentDetailsVisible(false);
    });
  };

  // Formater la date pour la modale
  const formatModalDate = () => {
    const now = new Date();
    return now.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="h3" weight="semibold">Statistiques</Text>
      </View>

      {/* Modale de détails des paiements groupés */}
      <Modal
        visible={paymentDetailsVisible}
        transparent={true}
        animationType="none"
        onRequestClose={closePaymentDetails}
      >
        <Animated.View 
          style={[
            styles.modalOverlay,
            { opacity: fadeAnim }
          ]}
        >
          <TouchableOpacity 
            style={styles.modalBackground}
            activeOpacity={1}
            onPress={closePaymentDetails}
          >
            <View 
              style={styles.modalContainer}
              onStartShouldSetResponder={() => true}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <Text variant="h4" weight="semibold">Détails des paiements</Text>
                <TouchableOpacity onPress={closePaymentDetails}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalDateContainer}>
                <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
                <Text variant="caption" color="text-secondary" style={styles.modalDate}>
                  {formatModalDate()}
                </Text>
              </View>
              
              <View style={styles.modalTotalContainer}>
                <Text variant="body2" color="text-secondary">Montant total reçu</Text>
                <Text variant="h3" weight="bold" style={styles.modalTotalAmount}>
                  {paymentDetails ? new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: 'EUR'
                  }).format(paymentDetails.totalAmount) : '0,00 €'}
                </Text>
              </View>
              
              <View style={styles.modalDivider} />
              
              <FlatList
                data={paymentDetails?.payments || []}
                style={styles.modalPaymentsList}
                keyExtractor={(item, index) => `payment-${index}`}
                renderItem={({ item }) => (
                  <View style={styles.modalPaymentItem}>
                    <View style={styles.modalPaymentIconContainer}>
                      <Ionicons name="cash-outline" size={20} color={COLORS.success} />
                    </View>
                    <View style={styles.modalPaymentDetails}>
                      <Text variant="body2" weight="semibold" numberOfLines={1}>
                        {item.serviceName}
                      </Text>
                      <Text variant="caption" color="text-secondary">
                        Client: {item.clientName}
                      </Text>
                    </View>
                    <Text variant="body1" weight="bold" style={styles.modalPaymentAmount}>
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR'
                      }).format(item.amount)}
                    </Text>
                  </View>
                )}
                ListEmptyComponent={
                  <View style={styles.modalEmptyList}>
                    <Text variant="body2" color="text-secondary">
                      Aucun paiement à afficher
                    </Text>
                  </View>
                }
              />
              
              <Button
                label="Fermer"
                variant="primary"
                size="sm"
                onPress={closePaymentDetails}
                style={styles.modalCloseButton}
              />
            </View>
          </TouchableOpacity>
        </Animated.View>
      </Modal>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Cartes de statistiques principales */}
        <View style={styles.statsSummary}>
          {/* Carte principale - Revenus */}
          <Card style={styles.mainStatsCard}>
            <View style={styles.mainCardContent}>
              <View style={styles.mainCardHeader}>
                <View style={styles.mainCardIconContainer}>
                  <Ionicons name="wallet-outline" size={24} color={COLORS.primary} />
                </View>
                <Text variant="h5" weight="semibold">Revenus totaux</Text>
              </View>
              <Text variant="h2" weight="bold" style={styles.mainCardValue}>
                {formatCurrency(stats.totalEarnings)}
              </Text>
              <Text variant="caption" color="text-secondary">
                Montant net après commission
              </Text>
            </View>
          </Card>
          
          {/* Cartes secondaires en ligne */}
          <View style={styles.secondaryStatsRow}>
            {/* Missions terminées */}
            <Card style={styles.secondaryStatsCard}>
              <View style={styles.secondaryCardContent}>
                <View style={[styles.secondaryCardIcon, {backgroundColor: `${COLORS.success}20`}]}>
                  <Ionicons name="briefcase-outline" size={24} color={COLORS.success} />
                </View>
                <View style={styles.secondaryCardTextContainer}>
                  <Text variant="caption" color="text-secondary">
                    Missions terminées
                  </Text>
                  <Text variant="h4" weight="bold" style={styles.secondaryCardValue}>
                    {stats.completedJobs}
                  </Text>
                </View>
              </View>
            </Card>
            
            {/* Note moyenne */}
            <Card style={styles.secondaryStatsCard}>
              <View style={styles.secondaryCardContent}>
                <View style={[styles.secondaryCardIcon, {backgroundColor: `${COLORS.accent}20`}]}>
                  <Ionicons name="star-outline" size={24} color={COLORS.accent} />
                </View>
                <View style={styles.secondaryCardTextContainer}>
                  <Text variant="caption" color="text-secondary">
                    Note moyenne
                  </Text>
                  <Text variant="h4" weight="bold" style={styles.secondaryCardValue}>
                    {stats.averageRating.toFixed(1)}/5
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        </View>


        {/* Historique des transactions */}
        <Card style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <View>
              <Text variant="h5" weight="semibold">Dernières missions</Text>
              <Text variant="caption" color="text-secondary">
                Vos {stats.transactionHistory.length} dernières missions terminées
              </Text>
            </View>
          </View>
          
          {stats.transactionHistory.length > 0 ? (
            <View style={styles.transactionsList}>
              {stats.transactionHistory.map((transaction, index) => (
                <View 
                  key={transaction.id} 
                  style={[
                    styles.transactionItem,
                    index < stats.transactionHistory.length - 1 && styles.transactionBorder
                  ]}
                >
                  <View style={[
                    styles.transactionIconContainer,
                    { backgroundColor: `${COLORS.success}15` }
                  ]}>
                    <Ionicons 
                      name="checkmark-circle" 
                      size={24} 
                      color={COLORS.success}
                    />
                  </View>
                  
                  <View style={styles.transactionDetails}>
                    <Text variant="body2" weight="semibold" numberOfLines={1} style={styles.serviceName}>
                      {transaction.service_name}
                    </Text>
                    <View style={styles.transactionMeta}>
                      <Ionicons name="person-outline" size={14} color={COLORS.textSecondary} style={styles.metaIcon} />
                      <Text variant="caption" color="text-secondary" numberOfLines={1}>
                        {transaction.client_name}
                      </Text>
                    </View>
                    <View style={styles.transactionMeta}>
                      <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} style={styles.metaIcon} />
                      <Text variant="caption" color="text-secondary">
                        {formatDate(transaction.created_at)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.transactionAmount}>
                    <Text 
                      variant="body2"
                      weight="bold"
                      style={styles.completedAmount}
                    >
                      {formatCurrency(transaction.amount)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Ionicons name="cash-outline" size={40} color={COLORS.textSecondary} />
              <Text variant="body2" color="text-secondary" style={styles.noDataText}>
                Aucune mission pour le moment
              </Text>
            </View>
          )}
        </Card>
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
    padding: SPACING.md,
    backgroundColor: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
  },
  // Styles pour la modale de détails des paiements
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalBackground: {
    flex: 1,
    justifyContent: 'flex-end', // Fait apparaître la modale depuis le bas
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalDate: {
    marginLeft: 6,
  },
  modalTotalContainer: {
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: `${COLORS.primary}08`,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  modalTotalAmount: {
    marginTop: 4,
    color: COLORS.primary,
  },
  modalDivider: {
    height: 1,
    backgroundColor: `${COLORS.textSecondary}20`,
    marginVertical: SPACING.md,
  },
  modalPaymentsList: {
    maxHeight: 300,
  },
  modalPaymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.textSecondary}10`,
  },
  modalPaymentIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${COLORS.success}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  modalPaymentDetails: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  modalPaymentAmount: {
    color: COLORS.success,
  },
  modalEmptyList: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  modalCloseButton: {
    marginTop: SPACING.md,
  },
  // Nouvelle mise en page pour les statistiques
  statsSummary: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  mainStatsCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  mainCardContent: {
    padding: SPACING.md,
  },
  mainCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  mainCardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  mainCardValue: {
    fontSize: 28,
    color: COLORS.text,
    marginVertical: SPACING.xs,
  },
  secondaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryStatsCard: {
    flex: 0.48,
    borderRadius: BORDER_RADIUS.md,
  },
  secondaryCardContent: {
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondaryCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  secondaryCardTextContainer: {
    flex: 1,
  },
  secondaryCardValue: {
    marginTop: 2,
  },
  // Historique des transactions
  historyCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  transactionsList: {
    marginTop: SPACING.xs,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  transactionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  transactionIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  transactionDetails: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  serviceName: {
    marginBottom: 4,
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaIcon: {
    marginRight: 4,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  completedAmount: {
    color: COLORS.success,
    fontSize: 16,
  },
  noDataContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
});

export default StatisticsScreen;