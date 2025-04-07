import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import supabase from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { KYCStatus } from '../../types';

const DashboardScreen = ({ navigation }: any) => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalClients: 0,
    totalPrestataires: 0,
    totalRequests: 0,
    totalJobs: 0,
    totalRevenue: 0,
    pendingKyc: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const fetchDashboardData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Récupérer les statistiques (version simplifiée)
      const [
        usersResponse,
        clientsResponse,
        prestatairesResponse,
        requestsResponse,
        jobsResponse,
        transactionsResponse,
        pendingKycResponse
      ] = await Promise.all([
        supabase.from('users').select('count').single(),
        supabase.from('users').select('count').eq('role', 'client').single(),
        supabase.from('users').select('count').eq('role', 'prestataire').single(),
        supabase.from('requests').select('count').single(),
        supabase.from('jobs').select('count').single(),
        supabase.from('transactions').select('sum(commission)').single(),
        supabase.from('kyc').select('count').eq('status', KYCStatus.PENDING).single()
      ]);
      
      setStats({
        totalUsers: usersResponse.data?.count || 0,
        totalClients: clientsResponse.data?.count || 0,
        totalPrestataires: prestatairesResponse.data?.count || 0,
        totalRequests: requestsResponse.data?.count || 0,
        totalJobs: jobsResponse.data?.count || 0,
        totalRevenue: transactionsResponse.data?.sum || 0,
        pendingKyc: pendingKycResponse.data?.count || 0
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
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Tableau de bord</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aperçu général</Text>
        
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalUsers}</Text>
            <Text style={styles.statLabel}>Utilisateurs</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalClients}</Text>
            <Text style={styles.statLabel}>Clients</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalPrestataires}</Text>
            <Text style={styles.statLabel}>Prestataires</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activité</Text>
        
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalRequests}</Text>
            <Text style={styles.statLabel}>Demandes</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalJobs}</Text>
            <Text style={styles.statLabel}>Missions</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalRevenue.toFixed(2)} €</Text>
            <Text style={styles.statLabel}>Revenus</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tâches en attente</Text>
        
        <TouchableOpacity
          style={styles.pendingCard}
          onPress={() => navigation.navigate('KycVerification')}
        >
          <View style={styles.pendingCardContent}>
            <Text style={styles.pendingValue}>{stats.pendingKyc}</Text>
            <View>
              <Text style={styles.pendingTitle}>Vérifications KYC</Text>
              <Text style={styles.pendingSubtitle}>
                {stats.pendingKyc === 0 ? 'Aucune vérification en attente' : 
                 stats.pendingKyc === 1 ? '1 vérification en attente' : 
                 `${stats.pendingKyc} vérifications en attente`}
              </Text>
            </View>
          </View>
          <Text style={styles.pendingAction}>Traiter →</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Raccourcis</Text>
        
        <View style={styles.shortcutsContainer}>
          <TouchableOpacity 
            style={styles.shortcutButton}
            onPress={() => navigation.navigate('UserManagement')}
          >
            <Text style={styles.shortcutText}>Gestion des utilisateurs</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.shortcutButton}
            onPress={() => navigation.navigate('ServiceManagement')}
          >
            <Text style={styles.shortcutText}>Gestion des services</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.shortcutButton}
            onPress={() => navigation.navigate('TransactionHistory')}
          >
            <Text style={styles.shortcutText}>Historique des transactions</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  section: {
    marginTop: 20,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  pendingCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  pendingCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 16,
    minWidth: 30,
    textAlign: 'center',
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  pendingSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  pendingAction: {
    fontSize: 16,
    color: '#007BFF',
    fontWeight: 'bold',
  },
  shortcutsContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  shortcutButton: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  shortcutText: {
    fontSize: 16,
  },
});

export default DashboardScreen;