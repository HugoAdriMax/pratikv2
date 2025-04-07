import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  RefreshControl
} from 'react-native';
import supabase from '../../config/supabase';
import { KYCStatus } from '../../types';

interface KycItem {
  id: string;
  user_id: string;
  doc_url: string;
  status: KYCStatus;
  created_at: string;
  user?: {
    email: string;
    phone?: string;
  };
}

const KycVerificationScreen = ({ navigation }: any) => {
  const [kycItems, setKycItems] = useState<KycItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KycItem | null>(null);

  const fetchPendingKyc = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('kyc')
        .select('*, user:user_id(email, phone)')
        .eq('status', KYCStatus.PENDING)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      
      setKycItems(data as KycItem[]);
    } catch (error) {
      console.error('Error fetching pending KYC:', error);
      Alert.alert('Erreur', 'Impossible de récupérer les vérifications KYC en attente');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPendingKyc();
    setRefreshing(false);
  };

  const handleApprove = async (item: KycItem) => {
    try {
      // Mettre à jour le statut du KYC
      const { error: kycError } = await supabase
        .from('kyc')
        .update({ status: KYCStatus.VERIFIED })
        .eq('id', item.id);
        
      if (kycError) throw kycError;
      
      // Mettre à jour le statut de vérification de l'utilisateur
      const { error: userError } = await supabase
        .from('users')
        .update({ is_verified: true })
        .eq('id', item.user_id);
        
      if (userError) throw userError;
      
      // Mettre à jour la liste locale
      setKycItems(prev => prev.filter(kyc => kyc.id !== item.id));
      
      Alert.alert('Succès', 'Le prestataire a été approuvé avec succès');
    } catch (error) {
      console.error('Error approving KYC:', error);
      Alert.alert('Erreur', 'Impossible d\'approuver le prestataire');
    }
  };

  const handleReject = async (item: KycItem) => {
    try {
      // Mettre à jour le statut du KYC
      const { error: kycError } = await supabase
        .from('kyc')
        .update({ status: KYCStatus.REJECTED })
        .eq('id', item.id);
        
      if (kycError) throw kycError;
      
      // Mettre à jour la liste locale
      setKycItems(prev => prev.filter(kyc => kyc.id !== item.id));
      
      Alert.alert('Succès', 'La demande a été rejetée');
    } catch (error) {
      console.error('Error rejecting KYC:', error);
      Alert.alert('Erreur', 'Impossible de rejeter la demande');
    }
  };

  useEffect(() => {
    fetchPendingKyc();
    
    // Rafraîchir lors du focus sur l'écran
    const unsubscribe = navigation.addListener('focus', () => {
      fetchPendingKyc();
    });

    return unsubscribe;
  }, [navigation]);

  const renderItem = ({ item }: { item: KycItem }) => {
    // Formatez la date
    const date = new Date(item.created_at);
    const formattedDate = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return (
      <TouchableOpacity
        style={styles.kycCard}
        onPress={() => setSelectedItem(item)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.userEmail}>{item.user?.email}</Text>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>
        
        {item.user?.phone && (
          <Text style={styles.phone}>Tél: {item.user.phone}</Text>
        )}
        
        <View style={styles.docPreview}>
          <Image
            source={{ uri: item.doc_url || 'https://via.placeholder.com/100' }}
            style={styles.docImage}
            resizeMode="cover"
          />
          <Text style={styles.docLabel}>Document d'identité</Text>
        </View>
        
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => {
              Alert.alert(
                'Rejeter la demande',
                'Êtes-vous sûr de vouloir rejeter cette demande de vérification ?',
                [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Rejeter', style: 'destructive', onPress: () => handleReject(item) }
                ]
              );
            }}
          >
            <Text style={styles.rejectButtonText}>Rejeter</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => {
              Alert.alert(
                'Approuver le prestataire',
                'Êtes-vous sûr de vouloir approuver ce prestataire ?',
                [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Approuver', onPress: () => handleApprove(item) }
                ]
              );
            }}
          >
            <Text style={styles.approveButtonText}>Approuver</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vérifications KYC en attente</Text>
      
      {kycItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Aucune vérification KYC en attente</Text>
        </View>
      ) : (
        <FlatList
          data={kycItems}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}
      
      {/* Modal pour afficher l'image en plein écran (simplifié pour cet exemple) */}
      {selectedItem && (
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setSelectedItem(null)}
        >
          <Image
            source={{ uri: selectedItem.doc_url || 'https://via.placeholder.com/100' }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      )}
    </View>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    margin: 16,
  },
  listContainer: {
    padding: 16,
  },
  kycCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  date: {
    fontSize: 12,
    color: '#777',
  },
  phone: {
    fontSize: 14,
    color: '#555',
    marginBottom: 12,
  },
  docPreview: {
    alignItems: 'center',
    marginVertical: 12,
  },
  docImage: {
    width: 200,
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  docLabel: {
    fontSize: 14,
    color: '#555',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  rejectButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  rejectButtonText: {
    color: '#dc3545',
    fontWeight: 'bold',
  },
  approveButton: {
    backgroundColor: '#28a745',
  },
  approveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#777',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  fullImage: {
    width: '90%',
    height: '80%',
  },
});

export default KycVerificationScreen;