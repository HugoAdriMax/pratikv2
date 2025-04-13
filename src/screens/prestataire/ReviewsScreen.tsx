import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card, Avatar, Badge } from '../../components/ui';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getUserById } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import supabase from '../../config/supabase';

// Composant pour afficher un nombre d'étoiles
const StarRating = ({ rating, size = 16, showText = false, style = {} }) => {
  const filledStars = Math.floor(rating);
  const halfStar = rating - filledStars >= 0.5;
  const maxStars = 5;
  
  return (
    <View style={[styles.starContainer, style]}>
      {[...Array(maxStars)].map((_, i) => (
        <Ionicons
          key={i}
          name={
            i < filledStars
              ? 'star'
              : i === filledStars && halfStar
              ? 'star-half'
              : 'star-outline'
          }
          size={size}
          color={COLORS.warning}
          style={{ marginRight: 2 }}
        />
      ))}
      {showText && (
        <Text variant="body2" weight="medium" style={{ marginLeft: 4 }}>
          {rating.toFixed(1)}
        </Text>
      )}
    </View>
  );
};

// Composant pour la carte d'évaluation individuelle
const ReviewCard = ({ review }) => {
  const [reviewer, setReviewer] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchReviewer = async () => {
      try {
        const user = await getUserById(review.reviewer_id);
        setReviewer(user);
      } catch (error) {
        console.error('Erreur lors de la récupération du reviewer:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchReviewer();
  }, [review]);
  
  const formattedDate = formatDistanceToNow(new Date(review.created_at), {
    addSuffix: true,
    locale: fr
  });
  
  const reviewerInitials = reviewer?.email ? reviewer.email.charAt(0).toUpperCase() : "?";
  const reviewerName = reviewer?.name || reviewer?.email || "Utilisateur";
  
  return (
    <Card style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerInfo}>
          <Avatar
            size="sm"
            initials={reviewerInitials}
            backgroundColor={COLORS.primaryLight}
          />
          <View style={styles.reviewerDetails}>
            <Text variant="body2" weight="medium">{reviewerName}</Text>
            <Text variant="caption" color="text-secondary">{formattedDate}</Text>
          </View>
        </View>
        <StarRating rating={review.rating} />
      </View>
      
      {review.comment && (
        <Text variant="body2" style={styles.reviewComment}>
          {review.comment}
        </Text>
      )}
    </Card>
  );
};

// Composant pour les statistiques d'évaluation
const ReviewStats = ({ stats }) => {
  if (!stats) return null;
  
  const { average_rating, review_count, five_star_count, four_star_count, three_star_count, two_star_count, one_star_count } = stats;
  
  const calculatePercentage = (count) => {
    return review_count > 0 ? (count / review_count) * 100 : 0;
  };
  
  return (
    <Card style={styles.statsCard}>
      <View style={styles.ratingHeader}>
        <View style={styles.averageRating}>
          <Text variant="h2" weight="bold">{average_rating ? average_rating.toFixed(1) : '0.0'}</Text>
          <StarRating rating={average_rating || 0} size={20} style={styles.averageStars} />
          <Text variant="caption" color="text-secondary">
            {review_count} {review_count === 1 ? 'avis' : 'avis'}
          </Text>
        </View>
        
        <View style={styles.ratingBars}>
          {[
            { count: five_star_count, label: '5' },
            { count: four_star_count, label: '4' },
            { count: three_star_count, label: '3' },
            { count: two_star_count, label: '2' },
            { count: one_star_count, label: '1' },
          ].map((item, index) => (
            <View key={index} style={styles.ratingBarContainer}>
              <Text variant="caption" style={styles.ratingBarLabel}>{item.label}</Text>
              <View style={styles.ratingBarWrapper}>
                <View 
                  style={[
                    styles.ratingBarFill, 
                    { width: `${calculatePercentage(item.count)}%` }
                  ]} 
                />
              </View>
              <Text variant="caption" style={styles.ratingBarCount}>{item.count}</Text>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
};

const ReviewsScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Le userId peut être passé en paramètre ou on utilise l'id de l'utilisateur connecté
  const userId = route.params?.userId || user?.id;
  
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const fetchReviews = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      
      // Récupérer les statistiques
      const { data: statsData, error: statsError } = await supabase
        .from('user_review_stats')
        .select('*')
        .eq('reviewed_user_id', userId)
        .single();
        
      if (statsError && statsError.code !== 'PGRST116') {
        console.error('Erreur lors de la récupération des statistiques:', statsError);
      }
      
      if (statsData) {
        setStats(statsData);
      }
      
      // Récupérer les évaluations
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select('*')
        .eq('reviewed_user_id', userId)
        .order('created_at', { ascending: false });
        
      if (reviewsError) {
        console.error('Erreur lors de la récupération des évaluations:', reviewsError);
        return;
      }
      
      setReviews(reviewsData || []);
    } catch (error) {
      console.error('Erreur lors de la récupération des données:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);
  
  const handleRefresh = () => {
    setRefreshing(true);
    fetchReviews();
  };
  
  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);
  
  const renderEmptyState = () => {
    if (loading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="star-outline" size={64} color={COLORS.textSecondary} />
        <Text variant="body1" weight="medium" color="text-secondary" style={styles.emptyText}>
          Aucune évaluation
        </Text>
        <Text variant="body2" color="text-secondary" style={styles.emptySubtext}>
          Les évaluations apparaîtront ici lorsque vous en recevrez
        </Text>
      </View>
    );
  };
  
  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <ReviewCard review={item} />}
          ListHeaderComponent={<ReviewStats stats={stats} />}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          contentContainerStyle={styles.listContent}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    flexGrow: 1,
    padding: SPACING.md,
  },
  statsCard: {
    marginBottom: SPACING.md,
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  averageRating: {
    flex: 2,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingRight: SPACING.md,
  },
  averageStars: {
    marginVertical: SPACING.xs,
  },
  ratingBars: {
    flex: 3,
    paddingLeft: SPACING.md,
  },
  ratingBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  ratingBarLabel: {
    width: 15,
    textAlign: 'center',
  },
  ratingBarWrapper: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.backgroundDark,
    borderRadius: 4,
    marginHorizontal: SPACING.xs,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: COLORS.warning,
    borderRadius: 4,
  },
  ratingBarCount: {
    width: 20,
    textAlign: 'right',
  },
  reviewCard: {
    marginBottom: SPACING.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewerDetails: {
    marginLeft: SPACING.sm,
  },
  reviewComment: {
    marginTop: SPACING.xs,
  },
  starContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    marginTop: SPACING.md,
  },
  emptySubtext: {
    marginTop: SPACING.sm,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
});

export default ReviewsScreen;