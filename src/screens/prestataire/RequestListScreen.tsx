import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  SafeAreaView
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import supabase from '../../config/supabase';
import { Request, RequestStatus } from '../../types';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Badge, Card } from '../../components/ui';
import { getServiceById, mockRequests } from '../../utils/mockData';

const RequestListScreen = ({ navigation }: any) => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const fetchNearbyRequests = async () => {
    if (!user) {
      console.log("Aucun utilisateur connecté, impossible de récupérer les demandes");
      return;
    }
    
    // Vérifier l'état de l'authentification Supabase
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("Erreur d'authentification Supabase:", sessionError);
      Alert.alert("Erreur d'authentification", "Veuillez vous reconnecter");
      return;
    }
    
    // Afficher les informations de l'utilisateur connecté
    console.log("Session Supabase:", sessionData?.session ? "Active" : "Inactive");
    console.log("User ID:", user.id);
    console.log("User Email:", user.email);
    console.log("User Role:", user.role);
    
    try {
      setLoading(true);
      
      // Vérifier d'abord que la table 'requests' existe
      console.log("Vérification de la connexion à Supabase...");
      
      // Pour cet exemple, nous récupérons TOUTES les demandes sans aucun filtre
      // pour diagnostiquer le problème de connexion
      const { data, error } = await supabase
        .from('requests')
        .select('count')
        .limit(1);
      
      if (error) {
        console.error("Erreur de connexion à la table 'requests':", error);
        throw error;
      }
      
      console.log("Connexion à la table 'requests' réussie, tentative de récupération des données...");
      
      // Maintenant, récupérer toutes les demandes
      const { data: requestsData, error: requestsError } = await supabase
        .from('requests')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (requestsError) {
        console.error("Erreur de récupération des demandes:", requestsError);
        throw requestsError;
      }
      
      // Afficher les informations de débogage pour voir les statuts des demandes
      console.log(`Nombre total de demandes récupérées: ${requestsData?.length || 0}`);
      if (requestsData && requestsData.length > 0) {
        console.log('Statuts des demandes:');
        requestsData.forEach((req, index) => {
          console.log(`Demande ${index+1}: ID=${req.id}, Status=${req.status}, Service=${req.service_id}, Client=${req.client_id}`);
        });
        
        // Utiliser les données réelles de Supabase
        setRequests(requestsData as Request[]);
      } else {
        console.log('Aucune demande récupérée, utilisation des données de démonstration');
        
        // Utiliser des données simulées puisque la base de données ne renvoie rien
        // Filtrer pour n'inclure que les demandes en statut PENDING ou OFFERED
        const filteredMockRequests = mockRequests.filter(
          req => req.status === RequestStatus.PENDING || req.status === RequestStatus.OFFERED
        ) as Request[];
        
        console.log(`Chargement de ${filteredMockRequests.length} demandes simulées`);
        filteredMockRequests.forEach((req, index) => {
          console.log(`Demande simulée ${index+1}: ID=${req.id}, Status=${req.status}, Service=${req.service_id}`);
        });
        
        setRequests(filteredMockRequests);
        
        // Tenter de créer une demande test pour vérifier les permissions d'écriture
        console.log("Tentative de création d'une demande test...");
        try {
          const testRequestResult = await supabase
            .from('requests')
            .insert({
              client_id: user.id,
              service_id: (await supabase.from('services').select('id').limit(1).single()).data?.id || '1',
              location: { latitude: 48.8566, longitude: 2.3522, address: "123 Test Street" },
              urgency: 3,
              notes: "Demande de test",
              status: "pending",
            })
            .select();
            
          if (testRequestResult.error) {
            console.error("Erreur de création de la demande test:", testRequestResult.error);
          } else {
            console.log("Création de la demande test réussie:", testRequestResult.data);
          }
        } catch (error) {
          console.error("Exception lors de la création de la demande test:", error);
        }
      }
    } catch (error) {
      console.error('Error fetching nearby requests:', error);
      Alert.alert('Erreur', 'Impossible de récupérer les demandes à proximité. Vérifiez la connexion à Supabase.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchNearbyRequests();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchNearbyRequests();
    
    // Rafraîchir lors du focus sur l'écran
    const unsubscribe = navigation.addListener('focus', () => {
      fetchNearbyRequests();
    });

    // Abonnement en temps réel aux nouvelles demandes
    const channel = supabase
      .channel('new-requests')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'requests' 
      }, payload => {
        // Ajouter la nouvelle demande si elle est à proximité et en statut PENDING
        const newRequest = payload.new as Request;
        if (newRequest.status === RequestStatus.PENDING) {
          setRequests(prev => [newRequest, ...prev]);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'requests'
      }, payload => {
        const updatedRequest = payload.new as Request;
        
        // Si la demande est passée à ACCEPTED, la retirer de la liste
        if (updatedRequest.status === RequestStatus.ACCEPTED) {
          setRequests(prev => prev.filter(req => req.id !== updatedRequest.id));
        } 
        // Sinon, mettre à jour la demande dans la liste
        else if ([RequestStatus.PENDING, RequestStatus.OFFERED].includes(updatedRequest.status as RequestStatus)) {
          setRequests(prev => prev.map(req => req.id === updatedRequest.id ? updatedRequest : req));
        }
      })
      .subscribe();

    return () => {
      unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [navigation, user]);

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

  const getServiceIcon = (serviceId: string) => {
    // On associe des icônes spécifiques à chaque type de service
    const serviceIcons: Record<string, string> = {
      '1': 'construct-outline',  // Plomberie
      '2': 'flash-outline',      // Électricité
      '3': 'leaf-outline',       // Jardinage
      '4': 'home-outline',       // Ménage
      '5': 'hammer-outline',     // Bricolage
      '6': 'color-palette-outline', // Peinture
      '7': 'car-outline',        // Déménagement
    };
    
    // Si le serviceId est un chiffre simple (1-7), utiliser l'icône correspondante
    // Sinon, utiliser une icône par défaut
    const serviceNumber = serviceId.charAt(0);
    if (serviceNumber && !isNaN(parseInt(serviceNumber)) && parseInt(serviceNumber) <= 7) {
      return serviceIcons[serviceNumber];
    }
    
    return 'build-outline'; // Icône par défaut
  };

  const renderItem = ({ item }: { item: Request }) => {
    // Formatez la date
    const date = new Date(item.created_at);
    const formattedDate = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Calculer la distance (simulé pour l'exemple)
    const distance = Math.floor(Math.random() * 5) + 1; // 1-5 km
    
    // Récupérer les informations du service
    const service = getServiceById(item.service_id);
    const serviceName = service ? service.name : 'Service';
    
    const statusBadgeProps = getStatusBadgeProps(item.status);
    const serviceIcon = getServiceIcon(item.service_id);
    
    return (
      <Card
        style={styles.requestCard}
        elevation="sm"
        onPress={() => navigation.navigate('RequestDetail', { requestId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.leftContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name={serviceIcon} size={20} color={COLORS.primary} />
            </View>
            <View style={styles.serviceInfo}>
              <Text variant="h5" weight="semibold">{serviceName}</Text>
              <Badge 
                variant={statusBadgeProps.variant as any} 
                label={statusBadgeProps.label} 
                size="sm"
                border
                style={styles.marginTopXs}
              />
            </View>
          </View>
          <Badge
            variant="secondary"
            label={`${distance} km`}
            size="sm"
            leftIcon={<Ionicons name="location-outline" size={12} color={COLORS.secondary} />}
            border
          />
        </View>
        
        <View style={styles.separator} />
        
        <View style={styles.addressContainer}>
          <Ionicons name="navigate-outline" size={16} color={COLORS.textSecondary} />
          <Text 
            variant="body2" 
            color="text-secondary" 
            style={styles.address}
          >
            {item.location.address}
          </Text>
        </View>
        
        <View style={styles.separator} />
        
        <View style={styles.cardFooter}>
          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
            <Text 
              variant="caption" 
              color="text-secondary" 
              style={styles.marginLeft}
            >
              {formattedDate}
            </Text>
          </View>
          
          <View style={styles.urgencyContainer}>
            <Text variant="caption" color="text-secondary" style={styles.urgencyLabel}>
              Urgence:
            </Text>
            <View style={styles.urgencyDots}>
              {[1, 2, 3, 4, 5].map(dot => (
                <View
                  key={dot}
                  style={[
                    styles.urgencyDot,
                    dot <= item.urgency ? styles.activeDot : styles.inactiveDot
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      </Card>
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
        <Text variant="h3" weight="semibold">Demandes à proximité</Text>
        <TouchableOpacity 
          style={styles.refreshIconButton}
          onPress={handleRefresh}
        >
          <Ionicons name="refresh" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.infoBar}>
        <Text variant="body2" color="text-secondary">
          {refreshing 
            ? 'Actualisation en cours...' 
            : `${requests.length} demande(s) trouvée(s)`
          }
        </Text>
      </View>
      
      {requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons 
              name="search-outline" 
              size={60} 
              color={COLORS.textSecondary} 
            />
          </View>
          <Text 
            variant="body1" 
            color="text-secondary" 
            style={styles.emptyText}
          >
            Aucune demande à proximité pour le moment
          </Text>
          <Text 
            variant="body3" 
            color="text-secondary" 
            style={styles.emptySubtext}
          >
            Revenez plus tard ou élargissez votre zone de recherche
          </Text>
          
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            activeOpacity={0.8}
          >
            <Text variant="button" weight="semibold" color="light">
              Rafraîchir
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
  },
  refreshIconButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: `${COLORS.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBar: {
    padding: SPACING.sm,
    backgroundColor: COLORS.backgroundDark,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  listContainer: {
    padding: SPACING.md,
    paddingTop: SPACING.sm,
  },
  requestCard: {
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  serviceInfo: {
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  address: {
    marginLeft: SPACING.sm,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  urgencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  urgencyLabel: {
    marginRight: SPACING.xs,
  },
  urgencyDots: {
    flexDirection: 'row',
  },
  urgencyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  activeDot: {
    backgroundColor: COLORS.accent,
  },
  inactiveDot: {
    backgroundColor: COLORS.border,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
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
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.small,
  },
  marginLeft: {
    marginLeft: SPACING.sm,
  },
  marginTopXs: {
    marginTop: SPACING.xs,
  },
});

export default RequestListScreen;