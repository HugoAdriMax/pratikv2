import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Text as RNText,
  TextInput,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/ui';
import { createReview, getJobByOfferId } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, SHADOWS, BORDER_RADIUS } from '../../utils/theme';
import supabase from '../../config/supabase';

const ReviewScreen = ({ route, navigation }: any) => {
  const { jobId, requestId } = route.params;
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingJob, setLoadingJob] = useState(true);
  const [job, setJob] = useState(null);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  useEffect(() => {
    const fetchJobDetails = async () => {
      try {
        setLoadingJob(true);
        
        if (!jobId) {
          // Cas de test
          setJob({
            id: 'test',
            prestataire_id: 'test-prestataire',
            prestataires: {
              name: 'Prestataire Test',
              email: 'test@example.com'
            }
          });
          return;
        }
        
        const jobData = await getJobByOfferId(jobId);
        setJob(jobData);
      } catch (error) {
        console.error('Error fetching job details:', error);
        Alert.alert('Erreur', 'Impossible de récupérer les détails de la mission');
      } finally {
        setLoadingJob(false);
      }
    };
    
    fetchJobDetails();
  }, [jobId]);
  
  const handleSubmitReview = async () => {
    if (!job || !user) {
      Alert.alert('Erreur', 'Données manquantes pour créer une évaluation');
      return;
    }
    
    try {
      setLoading(true);
      
      if (job.id === 'test') {
        // Simulation pour les tests
        Alert.alert('Test', `Évaluation: ${rating} étoiles, Commentaire: ${comment}`);
      } else {
        // Utiliser la fonction normale pour les jobs réels
        await createReview({
          job_id: job.id,
          reviewer_id: user.id,
          reviewed_user_id: job.prestataire_id,
          rating,
          comment
        });
        
        // React Native n'a pas localStorage, utilisons AsyncStorage dans un projet réel
        // Cet exemple montre le concept, mais ne fonctionnera pas tel quel
        try {
          // Dans un vrai projet, on utiliserait:
          // import AsyncStorage from '@react-native-async-storage/async-storage';
          // const reviewedRequests = JSON.parse(await AsyncStorage.getItem('reviewedRequests') || '[]');
          // await AsyncStorage.setItem('reviewedRequests', JSON.stringify(reviewedRequests));
          console.log('Avis soumis pour la demande:', requestId);
        } catch (e) {
          console.log('Note: le stockage local n\'est pas implémenté dans ce prototype', e);
        }
      }
      
      // Marquer l'écran précédent comme ayant été évalué en passant un paramètre
      Alert.alert(
        'Merci pour votre évaluation !',
        'Votre évaluation a été enregistrée avec succès.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Retourner au détail de la demande avec un paramètre indiquant qu'il a été évalué
              navigation.navigate({
                name: 'RequestDetail',
                params: { requestId: route.params?.requestId, hasBeenReviewed: true },
                merge: true,
              })
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error submitting review:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer votre évaluation: ' + (error.message || 'Erreur inconnue'));
    } finally {
      setLoading(false);
    }
  };

  // Composant pour l'affichage des étoiles
  const StarRating = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            style={styles.starButton}
          >
            <Ionicons 
              name={star <= rating ? 'star' : 'star-outline'} 
              size={36} 
              color="#FFB800" 
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const getRatingText = () => {
    switch(rating) {
      case 1: return 'Très insatisfait';
      case 2: return 'Insatisfait';
      case 3: return 'Correct';
      case 4: return 'Satisfait';
      case 5: return 'Très satisfait';
      default: return '';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Zone du commentaire */}
          <View style={styles.section}>
            <RNText style={styles.sectionTitle}>Commentaire (optionnel)</RNText>
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Partagez votre expérience..."
                placeholderTextColor={COLORS.textSecondary}
                multiline
                numberOfLines={5}
                value={comment}
                onChangeText={setComment}
                blurOnSubmit={false}
              />
            </View>
          </View>
          
          {/* Zone d'évaluation par étoiles */}
          <View style={styles.section}>
            <RNText style={styles.sectionTitle}>Votre satisfaction</RNText>
            <RNText style={styles.sectionSubtitle}>
              Comment évaluez-vous cette prestation ?
            </RNText>
            
            <StarRating />
            
            <RNText style={styles.ratingText}>
              {getRatingText()}
            </RNText>
          </View>
          
          {/* Boutons d'action */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity 
              style={styles.skipButton}
              onPress={() => navigation.navigate('ClientTabs', { screen: 'Requests' })}
              disabled={loading}
            >
              <RNText style={styles.skipButtonText}>Passer</RNText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleSubmitReview}
              disabled={loading}
            >
              <RNText style={styles.submitButtonText}>
                {loading ? 'Envoi en cours...' : 'Envoyer mon évaluation'}
              </RNText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2A2D34',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: '#737987',
    marginBottom: 16,
    textAlign: 'center',
  },
  textInputContainer: {
    borderWidth: 1.5,
    borderColor: '#E1E3EA',
    borderRadius: 8,
    backgroundColor: '#F7F8FA',
  },
  textInput: {
    padding: 12,
    fontSize: 16,
    color: '#2A2D34',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 16,
  },
  starButton: {
    padding: 6,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4C6FFF',
    textAlign: 'center',
    marginTop: 8,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  skipButton: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#4C6FFF',
    borderRadius: 10,
    padding: 14,
    marginRight: 8,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#4C6FFF',
    fontWeight: '600',
    fontSize: 15,
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#4C6FFF',
    borderRadius: 10,
    padding: 14,
    marginLeft: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default ReviewScreen;