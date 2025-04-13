import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Animated,
  Dimensions
} from 'react-native';
import supabase from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { KYCStatus } from '../../types';
import { COLORS, SHADOWS, SPACING } from '../../utils/theme';
import { Text, Card } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const DashboardScreen = ({ navigation }: any) => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalClients: 0,
    totalPrestataires: 0,
    totalRequests: 0,
    totalJobs: 0,
    totalRevenue: 0,
    pendingKyc: 0,
    pendingActivations: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Démarrer les animations au chargement
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true
      })
    ]).start();
  }, []);

  const fetchDashboardData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      console.log("Récupération des données du tableau de bord...");
      
      // Récupération de la valeur de l'enum pour PENDING 
      const KYC_PENDING = KYCStatus.PENDING;
      
      const [
        usersResponse,
        clientsResponse,
        prestatairesResponse,
        requestsResponse,
        jobsResponse,
        transactionsResponse,
        pendingKycResponse,
        pendingActivationsResponse
      ] = await Promise.all([
        supabase.from('users').select('count').single(),
        supabase.from('users').select('count').eq('role', 'client').single(),
        supabase.from('users').select('count').eq('role', 'prestataire').single(),
        supabase.from('requests').select('count').single(),
        supabase.from('jobs').select('count').single(),
        supabase.from('transactions').select('sum(commission)').single(),
        supabase.from('kyc').select('count').eq('status', 'pending').single(),
        supabase.from('prestataire_activations').select('count').eq('status', 'pending').single()
      ]);
      
      setStats({
        totalUsers: usersResponse.data?.count || 0,
        totalClients: clientsResponse.data?.count || 0,
        totalPrestataires: prestatairesResponse.data?.count || 0,
        totalRequests: requestsResponse.data?.count || 0,
        totalJobs: jobsResponse.data?.count || 0,
        totalRevenue: transactionsResponse.data?.sum || 0,
        pendingKyc: pendingKycResponse.data?.count || 0,
        pendingActivations: pendingActivationsResponse.data?.count || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchDashboardData();
    
    // Rafraîchir lors du focus sur l'écran
    const unsubscribe = navigation.addListener('focus', () => {
      fetchDashboardData();
    });

    return unsubscribe;
  }, [navigation, user]);

  if (loading && !refreshing) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text variant="body2" color="text-secondary" style={{ marginTop: 20 }}>
          Chargement du tableau de bord...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <Text variant="h3" weight="bold" color="primary">PRATIK</Text>
          <Text variant="h4" weight="semibold" color="text">Administration</Text>
        </View>
      </View>
      
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Aperçu des stats */}
        <Animated.View 
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.sectionHeaderContainer}>
            <Ionicons name="analytics-outline" size={20} color={COLORS.primary} style={styles.sectionIcon} />
            <Text variant="h5" weight="semibold" color="text" style={styles.sectionTitle}>
              Aperçu général
            </Text>
          </View>
          
          <View style={styles.cardsContainer}>
            <StatsCard 
              icon="people-outline"
              value={stats.totalUsers}
              label="Utilisateurs"
              color={COLORS.primary}
            />
            
            <StatsCard 
              icon="person-outline"
              value={stats.totalClients}
              label="Clients"
              color="#4CAF50"
            />
          </View>
          
          <View style={styles.cardsContainer}>
            <StatsCard 
              icon="briefcase-outline"
              value={stats.totalPrestataires}
              label="Prestataires"
              color="#FF9800"
            />
            
            <StatsCard 
              icon="document-text-outline"
              value={stats.totalRequests}
              label="Demandes"
              color="#2196F3"
            />
          </View>
          
          <View style={styles.cardsContainer}>
            <StatsCard 
              icon="construct-outline"
              value={stats.totalJobs}
              label="Missions"
              color="#673AB7"
            />
            
            <StatsCard 
              icon="cash-outline"
              value={`${stats.totalRevenue.toFixed(2)} €`}
              label="Revenus"
              color="#009688"
            />
          </View>
        </Animated.View>
        
        {/* Tâches en attente */}
        <Animated.View 
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim.interpolate({
                inputRange: [0, 50],
                outputRange: [0, 70]
              }) }]
            }
          ]}
        >
          <View style={styles.sectionHeaderContainer}>
            <Ionicons name="alert-circle-outline" size={20} color={COLORS.primary} style={styles.sectionIcon} />
            <Text variant="h5" weight="semibold" color="text" style={styles.sectionTitle}>
              Tâches en attente
            </Text>
          </View>
          
          {(stats.pendingKyc > 0 || stats.pendingActivations > 0) ? (
            <>
              {stats.pendingKyc > 0 && (
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => navigation.navigate('KycVerification')}
                  activeOpacity={0.9}
                >
                  <View style={styles.actionCardHeader}>
                    <View style={[styles.actionIconContainer, { backgroundColor: `${COLORS.danger}20` }]}>
                      <Ionicons name="shield-checkmark-outline" size={24} color={COLORS.danger} />
                    </View>
                    <View style={styles.actionTextContainer}>
                      <Text variant="h6" weight="semibold" color="text">Vérifications KYC</Text>
                      <Text variant="body3" color="text-secondary">
                        {stats.pendingKyc === 1 
                          ? '1 document à vérifier' 
                          : `${stats.pendingKyc} documents à vérifier`}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.actionCardFooter}>
                    <View style={styles.actionBadge}>
                      <Text variant="caption" weight="bold" color="danger">URGENT</Text>
                    </View>
                    <View style={styles.actionButton}>
                      <Text variant="button" weight="semibold" color="primary">Traiter</Text>
                      <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              
              {stats.pendingActivations > 0 && (
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => navigation.navigate('Prestataires')}
                  activeOpacity={0.9}
                >
                  <View style={styles.actionCardHeader}>
                    <View style={[styles.actionIconContainer, { backgroundColor: `${COLORS.warning}20` }]}>
                      <Ionicons name="person-add-outline" size={24} color={COLORS.warning} />
                    </View>
                    <View style={styles.actionTextContainer}>
                      <Text variant="h6" weight="semibold" color="text">Activations de prestataires</Text>
                      <Text variant="body3" color="text-secondary">
                        {stats.pendingActivations === 1 
                          ? '1 prestataire en attente' 
                          : `${stats.pendingActivations} prestataires en attente`}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.actionCardFooter}>
                    <View style={[styles.actionBadge, { backgroundColor: `${COLORS.warning}20` }]}>
                      <Text variant="caption" weight="bold" color="warning">IMPORTANT</Text>
                    </View>
                    <View style={styles.actionButton}>
                      <Text variant="button" weight="semibold" color="primary">Traiter</Text>
                      <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Card elevation="sm" padding="md" background="success-light" style={styles.noTasksCard}>
              <View style={styles.noTasksContent}>
                <Ionicons name="checkmark-circle" size={32} color={COLORS.success} style={{ marginRight: 12 }} />
                <View>
                  <Text variant="h6" weight="semibold" color="success">Tout est à jour</Text>
                  <Text variant="body3" color="text-secondary">Aucune tâche en attente</Text>
                </View>
              </View>
            </Card>
          )}
        </Animated.View>
        
        {/* Accès rapides */}
        <Animated.View 
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim.interpolate({
                inputRange: [0, 50],
                outputRange: [0, 90]
              }) }]
            }
          ]}
        >
          <View style={styles.sectionHeaderContainer}>
            <Ionicons name="grid-outline" size={20} color={COLORS.primary} style={styles.sectionIcon} />
            <Text variant="h5" weight="semibold" color="text" style={styles.sectionTitle}>
              Accès rapides
            </Text>
          </View>
          
          <View style={styles.shortcutsGrid}>
            <ShortcutButton 
              icon="people"
              label="Prestataires"
              onPress={() => navigation.navigate('Prestataires')}
            />
            
            <ShortcutButton 
              icon="shield-checkmark"
              label="Vérifications KYC"
              onPress={() => navigation.navigate('KycVerification')}
            />
            
            <ShortcutButton 
              icon="notifications"
              label="Notifications"
              onPress={() => navigation.navigate('NotificationsList')}
            />
            
            <ShortcutButton 
              icon="color-palette"
              label="Design System"
              onPress={() => navigation.navigate('DesignSystem')}
            />
            
            <ShortcutButton 
              icon="person"
              label="Mon profil"
              onPress={() => navigation.navigate('Profile')}
            />
            
            <ShortcutButton 
              icon="settings"
              label="Paramètres"
              onPress={() => {}}
            />
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Composant pour les cartes de statistiques
const StatsCard = ({ icon, value, label, color }) => (
  <Card elevation="sm" style={styles.statsCard}>
    <View style={[styles.statsIconContainer, { backgroundColor: `${color}20` }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <Text variant="h4" weight="bold" color="text" style={styles.statsValue}>
      {value}
    </Text>
    <Text variant="body3" color="text-secondary" style={styles.statsLabel}>
      {label}
    </Text>
  </Card>
);

// Composant pour les boutons de raccourci
const ShortcutButton = ({ icon, label, onPress }) => (
  <TouchableOpacity 
    style={styles.shortcutButton}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={styles.shortcutIconContainer}>
      <Ionicons name={icon} size={24} color={COLORS.primary} />
    </View>
    <Text variant="body3" weight="semibold" color="text" style={styles.shortcutLabel}>
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  headerContainer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 15,
    ...SHADOWS.small,
  },
  header: {
    flexDirection: 'column',
  },
  
  // Sections
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    marginBottom: 0,
  },
  
  // Stats Cards
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statsCard: {
    width: width * 0.43,
    padding: 15,
    alignItems: 'center',
    borderRadius: 16,
  },
  statsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsValue: {
    marginVertical: 4,
    textAlign: 'center',
  },
  statsLabel: {
    textAlign: 'center',
  },
  
  // Action Cards
  actionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 15,
    ...SHADOWS.medium,
    overflow: 'hidden',
  },
  actionCardHeader: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: `${COLORS.border}50`,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  actionBadge: {
    backgroundColor: `${COLORS.danger}20`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noTasksCard: {
    marginBottom: 15,
  },
  noTasksContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // Shortcuts
  shortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  shortcutButton: {
    width: width * 0.28,
    height: width * 0.28,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    ...SHADOWS.small,
  },
  shortcutIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  shortcutLabel: {
    textAlign: 'center',
  },
});

export default DashboardScreen;