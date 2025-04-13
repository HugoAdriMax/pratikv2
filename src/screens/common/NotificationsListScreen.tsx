import React, { useState, useEffect, useCallback } from 'react';
import {
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  View,
  StyleSheet
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getUserNotifications, markNotificationAsRead } from '../../services/notification';

// Import des composants du design system
import { Text, Card, Badge } from '../../components/ui';

interface Notification {
  id: string;
  title: string;
  body: string;
  data: any;
  read: boolean;
  created_at: string;
}

/**
 * Écran de liste des notifications utilisant notre design system
 */
const NotificationsListScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  const fetchNotifications = useCallback(async (pageNumber = 0, refresh = false) => {
    if (!user) return;
    
    try {
      if (refresh) {
        setRefreshing(true);
      } else if (pageNumber === 0) {
        setLoading(true);
      }
      
      const limit = 10;
      const offset = pageNumber * limit;
      const data = await getUserNotifications(user.id, limit, offset);
      
      if (!data || data.length === 0) {
        setHasMore(false);
        if (refresh) {
          setNotifications([]);
        }
      } else {
        setNotifications(prev => 
          refresh || pageNumber === 0 
            ? data as Notification[] 
            : [...prev, ...(data as Notification[])]
        );
        setHasMore(data.length === limit);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);
  
  const handleRefresh = useCallback(() => {
    setPage(0);
    setHasMore(true);
    fetchNotifications(0, true);
  }, [fetchNotifications]);
  
  const handleLoadMore = useCallback(() => {
    if (!hasMore || loading || refreshing) return;
    
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage);
  }, [page, hasMore, loading, refreshing, fetchNotifications]);
  
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);
  
  const handleNotificationPress = async (notification: Notification) => {
    try {
      if (!notification.read) {
        await markNotificationAsRead(notification.id);
        
        // Mettre à jour l'état local
        setNotifications(prev => 
          prev.map(n => 
            n.id === notification.id 
              ? { ...n, read: true } 
              : n
          )
        );
      }
      
      // Navigation basée sur le type de notification
      if (notification.data) {
        switch (notification.data.type) {
          case 'status_update':
            if (notification.data.jobId) {
              navigation.navigate('JobTracking', { jobId: notification.data.jobId });
            }
            break;
            
          case 'new_offer':
            if (notification.data.requestId) {
              navigation.navigate('RequestDetail', { requestId: notification.data.requestId });
            }
            break;
            
          case 'message':
            if (notification.data.chatId) {
              // Navigation vers l'écran de chat
              navigation.navigate('Chat', { jobId: notification.data.chatId });
            }
            break;
            
          default:
            // Ne rien faire pour les types non reconnus
            break;
        }
      }
    } catch (error) {
      console.error('Erreur lors du traitement de la notification:', error);
    }
  };
  
  // Composant pour afficher une notification
  const NotificationItem = ({ item }: { item: Notification }) => {
    const formattedDate = formatDistanceToNow(new Date(item.created_at), { 
      addSuffix: true,
      locale: fr 
    });
    
    return (
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={() => handleNotificationPress(item)}
      >
        <Card 
          style={[
            styles.notificationCard,
            !item.read && styles.unreadCard
          ]}
          elevation="sm"
        >
          <View style={styles.cardHeader}>
            <View style={styles.titleContainer}>
              <Text variant="body1" weight="semibold" numberOfLines={1}>
                {item.title}
              </Text>
              {!item.read && (
                <View style={styles.badgeContainer}>
                  <Badge 
                    variant="primary" 
                    label="Nouveau" 
                    size="xs" 
                  />
                </View>
              )}
            </View>
            <Text variant="caption" color="text-secondary">
              {formattedDate}
            </Text>
          </View>
          
          <Text 
            variant="body2" 
            color={item.read ? "text-secondary" : "text"}
            style={styles.notificationBody}
          >
            {item.body}
          </Text>
          
          <View style={styles.iconContainer}>
            {getNotificationIcon(item.data?.type)}
            <Text variant="caption" color="text-secondary" style={styles.iconLabel}>
              {getNotificationTypeLabel(item.data?.type)}
            </Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };
  
  const getNotificationTypeLabel = (type?: string) => {
    switch (type) {
      case 'status_update':
        return 'Mise à jour de statut';
      case 'new_offer':
        return 'Nouvelle offre';
      case 'message':
        return 'Message';
      default:
        return 'Notification';
    }
  };
  
  const getNotificationIcon = (type?: string) => {
    let iconName = 'notifications-outline';
    let iconColor = COLORS.textSecondary;
    
    switch (type) {
      case 'status_update':
        iconName = 'time-outline';
        iconColor = COLORS.info;
        break;
      case 'new_offer':
        iconName = 'briefcase-outline';
        iconColor = COLORS.success;
        break;
      case 'message':
        iconName = 'chatbubble-outline';
        iconColor = COLORS.primary;
        break;
    }
    
    return <Ionicons name={iconName as any} size={16} color={iconColor} />;
  };
  
  // Composant pour afficher un message quand la liste est vide
  const EmptyList = () => {
    if (loading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="notifications-off-outline" size={64} color={COLORS.textSecondary} />
        <View style={styles.emptyTextContainer}>
          <Text variant="body1" weight="medium" color="text-secondary">
            Aucune notification
          </Text>
          <Text variant="body2" color="text-secondary" align="center" style={styles.emptyDescription}>
            Les notifications apparaîtront ici lorsque vous en recevrez
          </Text>
        </View>
      </View>
    );
  };
  
  // Composant pour le pied de la liste (loader)
  const ListFooter = () => {
    if (!hasMore) return null;
    
    return (
      <View style={styles.footerContainer}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  };
  
  // Afficher un loader pendant le chargement initial
  if (loading && page === 0 && notifications.length === 0) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }
  
  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]}>
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <NotificationItem item={item} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyList />}
        ListFooterComponent={<ListFooter />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    flexGrow: 1,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  notificationCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  badgeContainer: {
    marginLeft: SPACING.sm,
  },
  notificationBody: {
    marginBottom: SPACING.sm,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconLabel: {
    marginLeft: SPACING.xs,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
  },
  emptyTextContainer: {
    marginTop: SPACING.md,
    alignItems: 'center',
  },
  emptyDescription: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  footerContainer: {
    alignItems: 'center',
    padding: SPACING.md,
  },
});

export default NotificationsListScreen;