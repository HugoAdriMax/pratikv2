import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView
} from 'react-native';
import { createReview } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// Simple composant pour l'affichage des étoiles
const StarRating = ({ rating, setRating }: { rating: number; setRating: (rating: number) => void }) => {
  return (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map(star => (
        <TouchableOpacity
          key={star}
          onPress={() => setRating(star)}
        >
          <Text style={[styles.star, star <= rating ? styles.starFilled : styles.starEmpty]}>
            ★
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const ReviewScreen = ({ route, navigation }: any) => {
  const { jobId } = route.params;
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmitReview = async () => {
    if (!user) return;
    
    if (rating === 0) {
      Alert.alert('Erreur', 'Veuillez sélectionner une note');
      return;
    }
    
    try {
      setLoading(true);
      
      await createReview({
        job_id: jobId,
        reviewer_id: user.id,
        rating,
        comment
      });
      
      Alert.alert(
        'Merci pour votre évaluation !',
        'Votre évaluation a été enregistrée avec succès.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Requests')
          }
        ]
      );
    } catch (error) {
      console.error('Error submitting review:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer votre évaluation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Évaluer la prestation</Text>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Votre satisfaction globale</Text>
        <Text style={styles.ratingLabel}>Comment évaluez-vous cette prestation ?</Text>
        
        <StarRating rating={rating} setRating={setRating} />
        
        <Text style={styles.ratingText}>
          {rating === 1 && 'Très insatisfait'}
          {rating === 2 && 'Insatisfait'}
          {rating === 3 && 'Correct'}
          {rating === 4 && 'Satisfait'}
          {rating === 5 && 'Très satisfait'}
        </Text>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Commentaire (optionnel)</Text>
        <TextInput
          style={styles.commentInput}
          value={comment}
          onChangeText={setComment}
          placeholder="Partagez votre expérience..."
          multiline
          numberOfLines={4}
        />
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => navigation.navigate('Requests')}
          disabled={loading}
        >
          <Text style={styles.skipButtonText}>
            Passer
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmitReview}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              Envoyer mon évaluation
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  ratingLabel: {
    fontSize: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 16,
  },
  star: {
    fontSize: 40,
    marginHorizontal: 8,
  },
  starEmpty: {
    color: '#ddd',
  },
  starFilled: {
    color: '#FFD700', // Gold color for stars
  },
  ratingText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    height: 120,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    margin: 16,
  },
  skipButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  skipButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#28a745',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default ReviewScreen;