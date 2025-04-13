import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './ui';
import { COLORS, SPACING } from '../utils/theme';
import supabase from '../config/supabase';

interface RatingDisplayProps {
  userId: string;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  horizontal?: boolean;
  style?: any;
}

/**
 * Composant réutilisable pour afficher la note moyenne d'un utilisateur
 */
const RatingDisplay: React.FC<RatingDisplayProps> = ({
  userId,
  size = 'md',
  showCount = true,
  horizontal = true,
  style = {}
}) => {
  const [rating, setRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchRating = async () => {
      if (!userId) return;
      
      try {
        const { data, error } = await supabase
          .from('user_review_stats')
          .select('average_rating, review_count')
          .eq('reviewed_user_id', userId)
          .single();
          
        if (error && error.code !== 'PGRST116') {
          console.error('Erreur lors de la récupération de la note:', error);
        }
        
        if (data) {
          setRating(data.average_rating || 0);
          setReviewCount(data.review_count || 0);
        }
      } catch (error) {
        console.error('Erreur:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRating();
  }, [userId]);
  
  if (loading) return null;
  
  // Configuration de la taille des étoiles et du texte
  const getSize = () => {
    switch (size) {
      case 'sm': return { star: 12, text: 'caption' };
      case 'lg': return { star: 20, text: 'body1' };
      default:  return { star: 16, text: 'body2' };
    }
  };
  
  const { star: starSize, text: textVariant } = getSize();
  
  // Calculer le nombre d'étoiles pleines, à moitié et vides
  const filledStars = Math.floor(rating);
  const halfStar = rating - filledStars >= 0.5;
  const maxStars = 5;
  
  const renderStars = () => (
    <View style={styles.starsContainer}>
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
          size={starSize}
          color={COLORS.warning}
          style={{ marginRight: size === 'sm' ? 1 : 2 }}
        />
      ))}
    </View>
  );
  
  const renderCount = () => {
    if (!showCount) return null;
    
    return (
      <Text
        variant={textVariant as any}
        color="text-secondary"
        style={horizontal ? styles.countHorizontal : styles.countVertical}
      >
        ({reviewCount})
      </Text>
    );
  };
  
  return (
    <View style={[horizontal ? styles.containerHorizontal : styles.containerVertical, style]}>
      {renderStars()}
      {renderCount()}
    </View>
  );
};

const styles = StyleSheet.create({
  containerHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  containerVertical: {
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countHorizontal: {
    marginLeft: SPACING.xs,
  },
  countVertical: {
    marginTop: SPACING.xxs,
  },
});

export default RatingDisplay;