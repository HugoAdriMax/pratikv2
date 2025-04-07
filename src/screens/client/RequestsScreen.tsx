import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { getClientRequests } from '../../services/api';
import { Request, RequestStatus } from '../../types';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Card, Badge } from '../../components/ui';

const RequestsScreen = ({ navigation }: any) => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const fetchRequests = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const data = await getClientRequests(user.id);
      setRequests(data);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchRequests();
    
    // Refresh on screen focus
    const unsubscribe = navigation.addListener('focus', () => {
      fetchRequests();
    });

    // Set up periodic refresh to check for new offers
    const refreshInterval = setInterval(() => {
      fetchRequests();
    }, 10000); // Check every 10 seconds

    return () => {
      unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [navigation, user]);

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

  const renderItem = ({ item }: { item: Request }) => {
    // Format date
    const date = new Date(item.created_at);
    const formattedDate = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
    
    const badgeProps = getStatusBadgeProps(item);
    const serviceIcon = getServiceIcon(item.service_id);
    
    return (
      <Card
        style={styles.requestCard}
        elevation="sm"
        onPress={() => navigation.navigate('RequestDetail', { requestId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.serviceContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name={serviceIcon} size={20} color={COLORS.primary} />
            </View>
            <Text variant="h5" weight="semibold" style={styles.marginLeft}>
              {item.service_id.replace(/-/g, ' ').split(' ')[0]}
            </Text>
          </View>
          <Badge 
            variant={badgeProps.variant as any} 
            label={badgeProps.label} 
            size="sm"
            border
          />
        </View>
        
        <View style={styles.separator} />
        
        <View style={styles.locationContainer}>
          <Ionicons name="location-outline" size={18} color={COLORS.textSecondary} />
          <Text 
            variant="body2" 
            color="text-secondary" 
            style={styles.marginLeft} 
            numberOfLines={1}
          >
            {item.location.address}
          </Text>
        </View>
        
        <View style={styles.cardFooter}>
          <View style={styles.dateContainer}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
            <Text variant="caption" color="text-secondary" style={styles.marginLeft}>
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
        
        {item.status === RequestStatus.OFFERED && (
          <View style={styles.offersBadge}>
            <Text variant="caption" weight="semibold" color="light">
              Nouvelles offres
            </Text>
          </View>
        )}
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
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text variant="h3" weight="semibold">Mes demandes</Text>
      </View>
      
      {requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="document-text-outline" size={60} color={COLORS.textSecondary} />
          </View>
          <Text variant="body1" color="text-secondary" style={styles.emptyText}>
            Vous n'avez pas encore de demandes
          </Text>
          <TouchableOpacity
            style={styles.newRequestButton}
            onPress={() => navigation.navigate('Chatbot')}
            activeOpacity={0.8}
          >
            <Text variant="button" weight="semibold" color="light">
              Nouvelle demande
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
      
      <TouchableOpacity
        style={[
          styles.fab, 
          { bottom: 20 + (insets.bottom > 0 ? insets.bottom - 10 : 0) }
        ]}
        onPress={() => navigation.navigate('Chatbot')}
        activeOpacity={0.9}
      >
        <Ionicons name="add" size={24} color={COLORS.white} />
      </TouchableOpacity>
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
    ...SHADOWS.small,
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
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  serviceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    backgroundColor: `${COLORS.primary}15`,
    borderRadius: BORDER_RADIUS.round,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
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
    marginRight: 4,
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
    backgroundColor: COLORS.warning,
  },
  inactiveDot: {
    backgroundColor: COLORS.backgroundDark,
  },
  offersBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.round,
    ...SHADOWS.small,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  emptyIconContainer: {
    backgroundColor: `${COLORS.textSecondary}15`,
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyText: {
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  newRequestButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.small,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: COLORS.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  marginLeft: {
    marginLeft: SPACING.sm,
  },
});

export default RequestsScreen;