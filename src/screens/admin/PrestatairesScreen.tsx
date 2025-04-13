import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Image,
  Modal,
  ScrollView,
  SafeAreaView
} from 'react-native';
import supabase from '../../config/supabase';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES, SHADOWS, SPACING } from '../../utils/theme';
import { Text } from '../../components/ui';

interface PrestataireUser {
  id: string;
  email: string;
  phone?: string;
  name?: string;
  created_at: string;
  is_verified: boolean;
  is_active: boolean;
  has_pending_activation?: boolean;
  activation_id?: string;
  kyc_submitted?: boolean;
}

interface Service {
  id: string;
  name: string;
  category: string;
  description: string;
  is_selected?: boolean;
}

const PrestatairesScreen = ({ navigation }: any) => {
  const [prestataires, setPrestataires] = useState<PrestataireUser[]>([]);
  const [pendingActivations, setPendingActivations] = useState<PrestataireUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [selectedPrestataire, setSelectedPrestataire] = useState<PrestataireUser | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  const fetchPrestataires = async () => {
    try {
      setLoading(true);
      
      // Fetch all prestataires
      const { data: prestatairesData, error: prestatairesError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'prestataire')
        .order('created_at', { ascending: false });
        
      if (prestatairesError) throw prestatairesError;

      // Fetch active activation requests only
      const { data: activationsData, error: activationsError } = await supabase
        .from('prestataire_activations')
        .select('id, user_id, status, is_active')
        .eq('status', 'pending')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
        
      if (activationsError) {
        console.error("Erreur lors de la récupération des activations:", activationsError);
      }

      // Create maps for activation data
      const pendingActivationsMap: Record<string, string> = {};
      activationsData?.forEach(activation => {
        if (activation.is_active) {
          pendingActivationsMap[activation.user_id] = activation.id;
        }
      });
      
      // Process prestataires
      const processedPrestataires = prestatairesData?.map(prestataire => {
        const hasPendingActivation = pendingActivationsMap[prestataire.id] !== undefined;
        
        return {
          ...prestataire,
          has_pending_activation: hasPendingActivation,
          activation_id: hasPendingActivation ? pendingActivationsMap[prestataire.id] : undefined,
        };
      }) || [];

      // Separate into categories
      const pending = processedPrestataires.filter(p => 
        p.has_pending_activation
      );
      const others = processedPrestataires.filter(p => 
        p.is_active
      );

      setPendingActivations(pending);
      setPrestataires(others);
    } catch (error) {
      console.error('Error fetching prestataires:', error);
      Alert.alert('Erreur', 'Impossible de récupérer la liste des prestataires');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      setPendingActivations([]);
      setPrestataires([]);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setRefreshCount(prev => prev + 1);
      await fetchPrestataires();
    } catch (error) {
      console.error("Erreur lors du rafraîchissement:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleApprove = async (item: PrestataireUser) => {
    try {
      // Get admin user id
      let admin_id = null;
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          admin_id = authData.user.id;
        }
      } catch (authError) {
        console.error("Erreur lors de la récupération de l'utilisateur authentifié:", authError);
      }
      
      // Call RPC function
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'manage_prestataire_status',
        {
          prestataire_id: item.id,
          new_status: 'approved',
          admin_id: admin_id,
          notes_param: 'Approuvé par un administrateur'
        }
      );
      
      if (rpcError) {
        throw rpcError;
      }
      
      // Reload data
      await handleRefresh();
      
      Alert.alert('Succès', 'Le prestataire a été activé avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'activation du prestataire:', error);
      Alert.alert(
        'Erreur', 
        'Impossible d\'activer le prestataire. Veuillez vérifier les permissions et réessayer.'
      );
    }
  };

  const openRejectModal = (item: PrestataireUser) => {
    setSelectedPrestataire(item);
    setRejectReason('');
    setShowRejectModal(true);
  };
  
  const fetchPrestataireServices = async (prestataireId: string) => {
    setLoadingServices(true);
    try {
      console.log("Fetching services for prestataire:", prestataireId);
      
      // Utiliser la fonction RPC pour récupérer les services sélectionnés par le prestataire
      const { data, error } = await supabase.rpc(
        'get_prestataire_services',
        { p_prestataire_id: prestataireId }
      );
      
      if (error) throw error;
      
      console.log("Services récupérés (brut):", data);
      
      // Version simplifié: cette fonction ne retourne que les services sélectionnés
      let processedData: Service[] = [];
      
      // Si c'est un tableau d'objets JSON (SETOF jsonb)
      if (Array.isArray(data)) {
        processedData = data.map((item: any) => {
          // Si l'item est un objet JSON
          if (item && typeof item === 'object') {
            // Si les données sont sous la forme { service: { ... } }
            const serviceData = item.service || item;
            
            return {
              id: serviceData.id || '',
              name: serviceData.name || 'Service sans nom',
              category: serviceData.category || 'Autre',
              description: serviceData.description || '',
              is_selected: true
            };
          }
          return null;
        }).filter(Boolean);
      } 
      else if (data && typeof data === 'object') {
        // Si c'est un objet unique (devrait être rare)
        processedData = [{
          id: data.id || '',
          name: data.name || 'Service sans nom',
          category: data.category || 'Autre',
          description: data.description || '',
          is_selected: true
        }];
      }
      
      console.log("Services traités (final):", processedData);
      setSelectedServices(processedData);
    } catch (error) {
      console.error('Erreur lors de la récupération des services:', error);
      Alert.alert('Erreur', 'Impossible de récupérer les services sélectionnés');
      setSelectedServices([]);
    } finally {
      setLoadingServices(false);
    }
  };
  
  const openServicesModal = async (item: PrestataireUser) => {
    setSelectedPrestataire(item);
    setShowServicesModal(true);
    await fetchPrestataireServices(item.id);
  };

  const handleReject = async () => {
    if (!selectedPrestataire) return;
    
    try {
      // Get admin user id
      let admin_id = null;
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          admin_id = authData.user.id;
        }
      } catch (authError) {
        console.error("Erreur lors de la récupération de l'administrateur:", authError);
      }
      
      // Call RPC function
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'manage_prestataire_status',
        {
          prestataire_id: selectedPrestataire.id,
          new_status: 'rejected',
          admin_id: admin_id,
          notes_param: rejectReason
        }
      );
      
      if (rpcError) {
        throw rpcError;
      }
      
      // Close modal
      setShowRejectModal(false);
      setSelectedPrestataire(null);
      
      // Reload data
      await handleRefresh();
      
      Alert.alert('Succès', 'La demande d\'activation a été rejetée');
    } catch (error) {
      console.error('Erreur lors du rejet du prestataire:', error);
      Alert.alert(
        'Erreur', 
        'Impossible de rejeter la demande d\'activation. Veuillez vérifier les permissions et réessayer.'
      );
    }
  };

  const deactivatePrestataire = async (item: PrestataireUser) => {
    try {
      // Get admin user id
      let admin_id = null;
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          admin_id = authData.user.id;
        }
      } catch (authError) {
        console.error("Erreur lors de la récupération de l'administrateur:", authError);
      }
      
      // Call RPC function
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'manage_prestataire_status',
        {
          prestataire_id: item.id,
          new_status: 'pending',
          admin_id: admin_id,
          notes_param: 'Désactivé par un administrateur'
        }
      );
      
      if (rpcError) {
        throw rpcError;
      }
      
      // Reload data
      await handleRefresh();
      
      Alert.alert('Succès', 'Le prestataire a été désactivé');
    } catch (error) {
      console.error('Erreur lors de la désactivation du prestataire:', error);
      Alert.alert(
        'Erreur', 
        'Impossible de désactiver le prestataire. Veuillez vérifier les permissions et réessayer.'
      );
    }
  };

  useEffect(() => {
    fetchPrestataires();
    
    // Refresh on screen focus
    const unsubscribe = navigation.addListener('focus', () => {
      handleRefresh();
    });

    return unsubscribe;
  }, [navigation, refreshCount]);

  const filteredPending = pendingActivations.filter(item => {
    const searchTerm = searchQuery.toLowerCase();
    return (
      item.email?.toLowerCase().includes(searchTerm) ||
      item.phone?.toLowerCase().includes(searchTerm) ||
      item.name?.toLowerCase().includes(searchTerm)
    );
  });

  const filteredPrestataires = prestataires.filter(item => {
    const searchTerm = searchQuery.toLowerCase();
    return (
      item.email?.toLowerCase().includes(searchTerm) ||
      item.phone?.toLowerCase().includes(searchTerm) ||
      item.name?.toLowerCase().includes(searchTerm)
    );
  });

  const renderPendingItem = ({ item }: { item: PrestataireUser }) => {
    const date = new Date(item.created_at);
    const formattedDate = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    // Date relative (il y a X jours)
    const getDaysAgo = () => {
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return "Aujourd'hui";
      if (diffDays === 1) return "Hier";
      return `Il y a ${diffDays} jours`;
    };
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.userIconContainer}>
              <Ionicons name="person-add" size={24} color={COLORS.warning} />
            </View>
            <View>
              <Text variant="h6" weight="semibold" color="text">{item.email}</Text>
              <Text variant="caption" color="text-secondary" style={styles.dateRelative}>
                Inscrit {getDaysAgo()}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.statusBadge}>
          <Text variant="caption" weight="bold" color="warning" style={styles.statusText}>
            EN ATTENTE D'ACTIVATION
          </Text>
        </View>
        
        <View style={styles.cardDivider} />
        
        <View style={styles.infoContainer}>
          {item.name && (
            <View style={styles.infoRow}>
              <Ionicons name="business-outline" size={20} color={COLORS.primary} style={styles.infoIcon} />
              <Text variant="body2" weight="semibold" color="text">{item.name}</Text>
            </View>
          )}
          
          {item.phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} style={styles.infoIcon} />
              <Text variant="body3" color="text-secondary">{item.phone}</Text>
            </View>
          )}
        </View>
        
        {/* Status indicators */}
        <View style={styles.badgesContainer}>
          {item.kyc_submitted && (
            <View style={[styles.infoBadge, { backgroundColor: `${COLORS.success}20` }]}>
              <Ionicons name="document-text" size={16} color={COLORS.success} style={{marginRight: 5}} />
              <Text variant="caption" weight="semibold" color="success">Documents KYC soumis</Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={[styles.infoBadge, { backgroundColor: `${COLORS.info}20` }]}
            onPress={() => openServicesModal(item)}
          >
            <Ionicons name="list" size={16} color={COLORS.info} style={{marginRight: 5}} />
            <Text variant="caption" weight="semibold" color="info">Voir les services</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => openRejectModal(item)}
          >
            <Ionicons name="close-circle" size={20} color={COLORS.danger} style={{marginRight: 8}} />
            <Text style={styles.rejectText}>Rejeter</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => {
              Alert.alert(
                'Activer le prestataire',
                'Êtes-vous sûr de vouloir activer ce prestataire ?',
                [
                  { text: 'Annuler', style: 'cancel' },
                  { 
                    text: 'Activer', 
                    onPress: () => handleApprove(item)
                  }
                ]
              );
            }}
          >
            <Ionicons name="checkmark-circle" size={20} color={COLORS.white} style={{marginRight: 8}} />
            <Text style={styles.approveText}>Activer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderActiveItem = ({ item }: { item: PrestataireUser }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.userIconContainer, { backgroundColor: `${COLORS.success}15` }]}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
            </View>
            <View>
              <Text variant="h6" weight="semibold" color="text">{item.email}</Text>
              <Text variant="caption" color="text-secondary" style={styles.dateRelative}>
                Prestataire vérifié
              </Text>
            </View>
          </View>
        </View>
        
        <View style={[styles.statusBadge, { backgroundColor: `${COLORS.success}15`, borderColor: `${COLORS.success}30` }]}>
          <Text variant="caption" weight="bold" color="success" style={styles.statusText}>
            ACTIF
          </Text>
        </View>
        
        <View style={styles.cardDivider} />
        
        <View style={styles.infoContainer}>
          {item.name && (
            <View style={styles.infoRow}>
              <Ionicons name="business-outline" size={20} color={COLORS.primary} style={styles.infoIcon} />
              <Text variant="body2" weight="semibold" color="text">{item.name}</Text>
            </View>
          )}
          
          {item.phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} style={styles.infoIcon} />
              <Text variant="body3" color="text-secondary">{item.phone}</Text>
            </View>
          )}
        </View>
        
        <TouchableOpacity
          style={styles.deactivateButton}
          onPress={() => {
            Alert.alert(
              'Désactiver le prestataire',
              'Êtes-vous sûr de vouloir désactiver ce prestataire ?',
              [
                { text: 'Annuler', style: 'cancel' },
                { 
                  text: 'Désactiver', 
                  style: 'destructive',
                  onPress: () => deactivatePrestataire(item)
                }
              ]
            );
          }}
        >
          <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} style={{marginRight: 8}} />
          <Text style={styles.deactivateText}>Désactiver ce prestataire</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="people" size={24} color={COLORS.primary} style={styles.headerIcon} />
          <Text variant="h3" weight="semibold" color="text">Gestion des prestataires</Text>
        </View>
        <Text variant="body2" color="text-secondary" style={styles.headerSubtitle}>
          Gérez les activations et le statut des prestataires de services
        </Text>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un prestataire..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {/* Main container with scrolling */}
      <ScrollView 
        style={{flex: 1}} 
        contentContainerStyle={{flexGrow: 1}}
        showsVerticalScrollIndicator={false}
      >
        {/* Pending Activations Section */}
        {filteredPending.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderContainer}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="alert-circle" size={16} color={COLORS.warning} />
              </View>
              <Text variant="h4" weight="semibold" style={styles.sectionTitle}>
                En attente d'activation
              </Text>
              <View style={styles.countBadge}>
                <Text variant="caption" weight="bold" color="white">{filteredPending.length}</Text>
              </View>
            </View>
            
            <View style={styles.summaryCard}>
              <View style={styles.summaryIconContainer}>
                <Ionicons name="time-outline" size={22} color={COLORS.white} />
              </View>
              <View style={styles.summaryContent}>
                <Text variant="body2" weight="semibold" color="text-secondary">
                  {filteredPending.length === 1 
                    ? '1 prestataire en attente de validation' 
                    : `${filteredPending.length} prestataires en attente de validation`}
                </Text>
                <Text variant="caption" color="text-secondary">
                  Traitez les demandes d'activation pour permettre aux prestataires de commencer à offrir leurs services
                </Text>
              </View>
            </View>
            
            {/* List of pending prestataires */}
            {filteredPending.map(item => (
              <React.Fragment key={item.id}>
                {renderPendingItem({item})}
              </React.Fragment>
            ))}
          </View>
        )}
      
        {/* Active Prestataires Section */}
        <View style={[styles.sectionContainer, { flex: 1 }]}>
          <View style={styles.sectionHeaderContainer}>
            <View style={[styles.sectionIconBadge, { backgroundColor: `${COLORS.success}20` }]}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
            </View>
            <Text variant="h4" weight="semibold" style={styles.sectionTitle}>
              Prestataires actifs
            </Text>
            <View style={[styles.countBadge, { backgroundColor: COLORS.success }]}>
              <Text variant="caption" weight="bold" color="white">{filteredPrestataires.length}</Text>
            </View>
          </View>
          
          {filteredPrestataires.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="people-outline" size={48} color={COLORS.textSecondary} />
              </View>
              <Text variant="h5" weight="semibold" color="text-secondary" style={styles.emptyTitle}>
                Aucun prestataire actif
              </Text>
              <Text variant="body3" color="text-secondary" style={styles.emptyText}>
                Les prestataires apparaîtront ici une fois qu'ils auront été activés
              </Text>
            </View>
          ) : (
            /* Direct rendering of items without FlatList for better scrolling */
            filteredPrestataires.map(item => (
              <React.Fragment key={item.id}>
                {renderActiveItem({item})}
              </React.Fragment>
            ))
          )}
        </View>
      </ScrollView>
      
      {/* Reject Modal */}
      {showRejectModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Raison du rejet</Text>
            
            <TextInput
              style={styles.rejectInput}
              placeholder="Saisir la raison du rejet..."
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowRejectModal(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleReject}
                disabled={!rejectReason.trim()}
              >
                <Text style={styles.confirmButtonText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      
      {/* Services Modal */}
      {showServicesModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.servicesModalContainer]}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 15,
              width: '100%'
            }}>
              <View style={{flex: 1, paddingRight: 16}}>
                <Text style={{
                  fontSize: 20,
                  fontWeight: 'bold', 
                  color: COLORS.primary,
                  flexWrap: 'wrap'
                }}>Services proposés</Text>
                <Text style={{
                  fontSize: 14, 
                  color: '#666666', 
                  marginTop: 4,
                  flexWrap: 'wrap'
                }}>
                  {selectedPrestataire?.email || 'Prestataire'}
                </Text>
              </View>
              <TouchableOpacity 
                style={{
                  width: 36, 
                  height: 36, 
                  borderRadius: 18,
                  backgroundColor: `${COLORS.light}80`,
                  justifyContent: 'center', 
                  alignItems: 'center',
                  marginTop: 2
                }}
                onPress={() => setShowServicesModal(false)}
              >
                <Ionicons name="close" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            
            <View style={{
              height: 3,
              backgroundColor: `${COLORS.primary}20`,
              marginBottom: 15,
              borderRadius: 10
            }} />
            
            {loadingServices ? (
              <View style={styles.servicesLoaderContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={{ marginTop: 15 }}>Chargement des services...</Text>
              </View>
            ) : selectedServices.length === 0 ? (
              <View style={{
                flex: 1, 
                justifyContent: 'center', 
                alignItems: 'center',
                padding: 20,
                backgroundColor: '#f8fafc'
              }}>
                <View style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: '#f1f5f9',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 20
                }}>
                  <Ionicons name="list-outline" size={40} color={COLORS.textSecondary} />
                </View>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: '600', 
                  color: '#334155',
                  marginBottom: 12
                }}>
                  Aucun service sélectionné
                </Text>
                <Text style={{ 
                  fontSize: 14, 
                  color: '#64748b', 
                  textAlign: 'center',
                  maxWidth: '80%',
                  lineHeight: 20
                }}>
                  Ce prestataire n'a pas encore sélectionné de services à proposer.
                </Text>
              </View>
            ) : (
              <ScrollView 
                style={styles.servicesScrollView}
                contentContainerStyle={{paddingBottom: 20}}
                showsVerticalScrollIndicator={true}
              >
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: `${COLORS.primary}10`,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  marginBottom: 16,
                  marginHorizontal: 8
                }}>
                  <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} style={{marginRight: 8}} />
                  <Text style={{
                    fontSize: 14,
                    color: COLORS.primary, 
                    fontWeight: '500'
                  }}>
                    {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} sélectionné{selectedServices.length > 1 ? 's' : ''}
                  </Text>
                </View>
                
                {/* Log pour aider au débogage */}
                {console.log("Rendering services:", selectedServices)}
                
                {/* Regrouper les services par catégorie */}
                {(() => {
                  // Créer un objet groupé par catégorie
                  const groupedByCategory: Record<string, any[]> = {};
                  
                  // Grouper les services par catégorie
                  selectedServices.forEach(service => {
                    const category = service.category || 'Autre';
                    if (!groupedByCategory[category]) {
                      groupedByCategory[category] = [];
                    }
                    groupedByCategory[category].push(service);
                  });
                  
                  console.log("Grouped services:", groupedByCategory);
                  
                  // Rendu des catégories et services
                  return Object.entries(groupedByCategory).map(([category, services]) => (
                    <View key={category} style={styles.serviceCategoryContainer}>
                      <View style={{
                        backgroundColor: COLORS.primary,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        marginBottom: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginHorizontal: 8
                      }}>
                        <Ionicons name="grid-outline" size={18} color="#fff" style={{marginRight: 8}} />
                        <Text style={{ 
                          fontSize: 16, 
                          fontWeight: 'bold', 
                          color: '#fff' 
                        }}>{category}</Text>
                      </View>
                      
                      {services.map(service => (
                        <View key={service.id} style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: '#fff',
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 8,
                          marginHorizontal: 8,
                          borderWidth: 1,
                          borderColor: '#e2e8f0',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.1,
                          shadowRadius: 2,
                          elevation: 2
                        }}>
                          <View style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: `${COLORS.success}15`,
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 12
                          }}>
                            <Ionicons name="checkmark" size={22} color={COLORS.success} />
                          </View>
                          <View style={{flex: 1}}>
                            <Text style={{ 
                              fontSize: 15, 
                              color: '#334155', 
                              fontWeight: '600',
                              marginBottom: 2,
                              flexWrap: 'wrap'
                            }}>{service.name}</Text>
                            {service.description && (
                              <Text style={{ 
                                fontSize: 13, 
                                color: '#64748b',
                                lineHeight: 18,
                                flexWrap: 'wrap'
                              }}>
                                {service.description}
                              </Text>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  ));
                })()}
              </ScrollView>
            )}
            
            <TouchableOpacity
              style={{
                height: 50,
                backgroundColor: COLORS.primary,
                borderRadius: 12,
                justifyContent: 'center',
                alignItems: 'center',
                marginTop: 16,
                flexDirection: 'row'
              }}
              activeOpacity={0.7}
              onPress={() => setShowServicesModal(false)}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{marginRight: 6}} />
              <Text style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: '600'
              }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    flexGrow: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  servicesModalContainer: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    minHeight: 600,
    maxHeight: '90%',
    padding: 24,
    ...SHADOWS.medium,
  },
  servicesModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `${COLORS.light}80`,
  },
  servicesSubtitleContainer: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.border}50`,
  },
  servicesScrollView: {
    flex: 1,
    backgroundColor: '#ffffff',
    minHeight: 400,
    maxHeight: 600,
  },
  serviceCategoryContainer: {
    marginBottom: 20,
  },
  serviceCategoryHeader: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: 10,
    marginBottom: 10,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.border}30`,
  },
  serviceItemContent: {
    flex: 1,
  },
  closeServicesButton: {
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  servicesLoaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyServicesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 18,
    ...SHADOWS.small,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerIcon: {
    marginRight: 12,
  },
  headerSubtitle: {
    opacity: 0.7,
    marginTop: 5,
    marginBottom: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.light,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.base,
    marginTop: SIZES.base,
  },
  searchInput: {
    flex: 1,
    height: 40,
    marginLeft: SIZES.base,
    color: COLORS.dark,
  },
  sectionContainer: {
    paddingTop: SIZES.padding,
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  sectionIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${COLORS.warning}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    flex: 1,
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.warning,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 15,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  summaryIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.warning,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  summaryContent: {
    flex: 1,
  },
  emptyIconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: `${COLORS.background}80`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    maxWidth: '80%',
    opacity: 0.6,
  },
  listContainer: {
    padding: SIZES.padding,
    paddingTop: SIZES.base,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    marginHorizontal: SPACING.md,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: `${COLORS.primary}10`,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.base,
  },
  emailText: {
    ...FONTS.body3,
    fontWeight: 'bold',
    color: COLORS.dark,
    flex: 1,
  },
  dateText: {
    ...FONTS.body5,
    color: COLORS.textSecondary,
  },
  phoneText: {
    ...FONTS.body4,
    color: COLORS.text,
    marginBottom: SIZES.base / 2,
  },
  nameText: {
    ...FONTS.body4,
    color: COLORS.text,
    marginBottom: SIZES.base,
  },
  statusBadgeContainer: {
    flexDirection: 'column',
    marginBottom: SIZES.base,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: SIZES.radius,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    ...FONTS.body5,
    color: COLORS.dark,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginHorizontal: 5,
    ...SHADOWS.small,
  },
  rejectButton: {
    backgroundColor: `${COLORS.danger}10`,
    borderWidth: 1.5,
    borderColor: COLORS.danger,
  },
  rejectText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.danger,
  },
  approveButton: {
    backgroundColor: COLORS.success,
    borderWidth: 1.5,
    borderColor: `${COLORS.success}80`,
  },
  approveText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20, 
    backgroundColor: `${COLORS.warning}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dateRelative: {
    marginTop: 3,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: `${COLORS.warning}15`,
    borderWidth: 1,
    borderColor: `${COLORS.warning}30`,
    alignSelf: 'flex-start',
    marginTop: 2,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  cardDivider: {
    height: 1,
    backgroundColor: `${COLORS.border}50`,
    marginVertical: 15,
  },
  infoContainer: {
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoIcon: {
    width: 24,
    marginRight: 10,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  deactivateButton: {
    height: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: `${COLORS.error}08`,
    borderWidth: 1,
    borderColor: `${COLORS.error}20`,
    marginTop: 5,
  },
  deactivateText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.padding * 2,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: SIZES.radius,
  },
  refreshButtonText: {
    ...FONTS.body4,
    color: COLORS.primary,
    marginLeft: 5,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(2px)',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    ...SHADOWS.medium,
  },
  modalTitle: {
    ...FONTS.h4,
    color: COLORS.dark,
    marginBottom: SIZES.padding,
  },
  rejectInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    padding: SIZES.base,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SIZES.padding,
  },
  modalButton: {
    paddingVertical: SIZES.base,
    paddingHorizontal: SIZES.padding,
    borderRadius: SIZES.radius,
    marginLeft: SIZES.base,
  },
  cancelButton: {
    backgroundColor: COLORS.light,
  },
  cancelButtonText: {
    ...FONTS.body4,
    color: COLORS.text,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
  },
  confirmButtonText: {
    ...FONTS.body4,
    color: COLORS.white,
    fontWeight: 'bold',
  }
});

export default PrestatairesScreen;