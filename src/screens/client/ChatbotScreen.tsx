import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Animated,
  Keyboard,
  Dimensions,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { analyzeChatMessage, generateChatbotResponse } from '../../services/chatbot';
import { createRequest, getServiceIdByName } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChatMessage from '../../components/ChatMessage';
import { Text, Button, Card } from '../../components/ui';
import { COLORS, BORDER_RADIUS, SHADOWS, SPACING } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { geocodeAddress } from '../../services/location';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  animValue: Animated.Value;
}

interface FormData {
  service?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  urgency?: number;
  notes?: string;
}

const { width } = Dimensions.get('window');

const ChatbotScreen = ({ navigation }: any) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    location: {}
  });
  const [formComplete, setFormComplete] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const flatListRef = useRef<FlatList>(null);
  const messageHistoryRef = useRef<string[]>([]);

  // Initial chatbot message - réinitialisé à chaque fois que l'écran reçoit le focus
  useEffect(() => {
    const resetChatbot = () => {
      console.log("Réinitialisation du chatbot...");
      
      const initialMessage = {
        id: Date.now().toString(),
        text: "Salut ! Je suis Pat, ton assistant Pratik. 😊 Dis-moi comment je peux t'aider aujourd'hui ? Tu as besoin d'un plombier, électricien ou autre service ?",
        isUser: false,
        animValue: new Animated.Value(0)
      };
      
      // Réinitialiser tous les états
      setMessages([initialMessage]);
      messageHistoryRef.current = ["Assistant: Salut ! Je suis Pat, ton assistant Pratik. 😊 Dis-moi comment je peux t'aider aujourd'hui ? Tu as besoin d'un plombier, électricien ou autre service ?"];
      setFormData({ location: {} });
      setFormComplete(false);
      setInputText('');
      setLoading(false);
    };
    
    // Initialisation au premier chargement
    resetChatbot();
    
    // Ajouter un écouteur d'événement pour réinitialiser le chatbot quand on revient à cet écran
    const unsubscribe = navigation.addListener('focus', resetChatbot);
    
    return () => {
      unsubscribe();
    };
  }, [navigation]);

  // Keyboard listeners
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setKeyboardVisible(true);
      }
    );
    
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setKeyboardVisible(false);
      }
    );
    
    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // Check if form is complete
  useEffect(() => {
    if (
      formData.service &&
      formData.location?.address &&
      formData.urgency
    ) {
      setFormComplete(true);
    }
  }, [formData]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    
    const userMessage = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      animValue: new Animated.Value(0)
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);
    
    try {
      // Add user message to history
      messageHistoryRef.current.push(`Utilisateur: ${inputText}`);
      
      // Analyze message
      const analysis = await analyzeChatMessage(inputText, messageHistoryRef.current);
      
      // Update form data based on analysis (now async for address validation)
      await updateFormData(analysis);
      
      // Pour les validations d'adresse, on utilise une approche plus directe sans dépendre de formData
      if (analysis.type === 'location') {
        // Vérifier si une location a été trouvée (en vérifiant directement l'analyse, pas formData)
        const isAddressValid = analysis.data && analysis.data.coordinates && 
          analysis.data.coordinates.latitude && analysis.data.coordinates.longitude;
        
        if (isAddressValid) {
          // Enregistrer la validation dans l'historique avec les coordonnées de l'analyse
          const validatedMsg = `L'adresse a été validée: ${analysis.data.formattedAddress || analysis.content}`;
          console.log(validatedMsg);
          messageHistoryRef.current.push(`Système: ${validatedMsg}`);
          
          // Ajouter directement un message de confirmation avec l'adresse validée
          const confirmationMessage = {
            id: `address-confirm-${Date.now()}`,
            text: `J'ai bien enregistré votre adresse: ${analysis.data.formattedAddress || analysis.content}. Avez-vous des précisions sur le problème à résoudre?`,
            isUser: false,
            animValue: new Animated.Value(0)
          };
          
          setMessages(prev => [...prev, confirmationMessage]);
        } else if (analysis.errorMessage) {
          // Si l'analyse contient un message d'erreur, on l'affiche et on arrête
          console.log(`Adresse invalide: ${analysis.errorMessage}`);
          setLoading(false);
          return;
        }
      }
      
      // Generate response
      const botResponse = await generateChatbotResponse(analysis, messageHistoryRef.current);
      
      // Add bot response to history
      messageHistoryRef.current.push(`Assistant: ${botResponse}`);
      
      const newBotMessage = {
        id: (Date.now() + 1).toString(),
        text: botResponse,
        isUser: false,
        animValue: new Animated.Value(0)
      };
      
      setMessages(prev => [...prev, newBotMessage]);
    } catch (error) {
      console.error('Error in chat flow:', error);
      
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: "Je suis désolé, une erreur s'est produite. Pouvez-vous réessayer?",
        isUser: false,
        animValue: new Animated.Value(0)
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = async (analysis: any) => {
    switch (analysis.type) {
      case 'service_request':
        setFormData(prev => ({
          ...prev,
          service: analysis.content
        }));
        break;
      case 'location':
        try {
          // Validation de l'adresse avec le service de géocodage
          setLoading(true);
          
          console.log(`Tentative de géocodage pour: "${analysis.content}"`);
          const geocodedLocation = await geocodeAddress(analysis.content);
          
          if (!geocodedLocation) {
            // L'adresse n'a pas pu être géocodée
            console.log(`Adresse non trouvée: "${analysis.content}"`);
            
            const errorMessage = {
              id: `location-error-${Date.now()}`,
              text: "Je n'ai pas pu trouver cette adresse. Pouvez-vous me donner une adresse plus précise, avec le nom de la rue, le numéro et la ville?",
              isUser: false,
              animValue: new Animated.Value(0)
            };
            
            setMessages(prev => [...prev, errorMessage]);
            return;
          }
          
          // L'adresse est valide, mettre à jour les données du formulaire avec les coordonnées précises
          const updatedLocation = {
            latitude: geocodedLocation.latitude,
            longitude: geocodedLocation.longitude,
            address: geocodedLocation.formattedAddress || analysis.content
          };
          
          console.log(`Adresse validée avec succès: "${analysis.content}" => Coord: ${geocodedLocation.latitude}, ${geocodedLocation.longitude}`);
          
          // Important: mettre à jour l'état avec les nouvelles coordonnées
          setFormData(prev => {
            console.log("Mise à jour de formData.location avec les coordonnées validées");
            return {
              ...prev,
              location: updatedLocation
            };
          });
          
          // Permettre au formData de se mettre à jour avant que handleSendMessage ne continue
          await new Promise(resolve => setTimeout(resolve, 300));
          
          console.log("formData après mise à jour:", JSON.stringify(updatedLocation));
        } catch (error) {
          console.error('Erreur lors de la validation de l\'adresse:', error);
          
          const errorMessage = {
            id: `location-error-exception-${Date.now()}`,
            text: "Une erreur s'est produite lors de la validation de votre adresse. Pouvez-vous essayer avec une autre adresse?",
            isUser: false,
            animValue: new Animated.Value(0)
          };
          
          setMessages(prev => [...prev, errorMessage]);
        } finally {
          setLoading(false);
        }
        break;
      case 'urgency':
        // Convert description to number (1-5)
        let urgencyLevel = 3; // default
        
        if (analysis.data && typeof analysis.data.level === 'number') {
          urgencyLevel = analysis.data.level;
        } else {
          // Simple text-based analysis
          const text = analysis.content.toLowerCase();
          if (text.includes('très urgent') || text.includes('immédiat')) {
            urgencyLevel = 5;
          } else if (text.includes('urgent')) {
            urgencyLevel = 4;
          } else if (text.includes('peut attendre') || text.includes('pas urgent')) {
            urgencyLevel = 1;
          }
        }
        
        setFormData(prev => ({
          ...prev,
          urgency: urgencyLevel
        }));
        break;
      case 'additional_info':
        setFormData(prev => ({
          ...prev,
          notes: analysis.content
        }));
        break;
    }
  };

  const handleSubmitRequest = async () => {
    if (!user || !formComplete) return;
    
    try {
      setLoading(true);
      
      // Vérification finale de l'adresse
      if (!formData.location?.latitude || !formData.location?.longitude) {
        const errorMessage = {
          id: Date.now().toString(),
          text: "L'adresse fournie n'est pas valide. Veuillez indiquer une adresse précise avant de soumettre votre demande.",
          isUser: false,
          animValue: new Animated.Value(0)
        };
        
        setMessages(prev => [...prev, errorMessage]);
        setLoading(false);
        return;
      }
      
      console.log(`[Chatbot] Création d'une demande pour le service: "${formData.service}"`);
      
      // Get a valid UUID for the service
      const serviceId = await getServiceIdByName(formData.service || 'Plomberie');
      console.log(`[Chatbot] Service ID obtenu: "${serviceId}"`);
      
      const requestData = {
        client_id: user.id,
        service_id: serviceId,
        location: {
          latitude: formData.location.latitude,
          longitude: formData.location.longitude,
          address: formData.location.address || ''
        },
        urgency: formData.urgency || 3,
        notes: formData.notes
      };
      
      console.log(`[Chatbot] Données de la demande:`, JSON.stringify(requestData, null, 2));
      console.log(`[Chatbot] Adresse géocodée: ${requestData.location.address} (${requestData.location.latitude}, ${requestData.location.longitude})`);
      
      const createdRequest = await createRequest(requestData);
      console.log(`[Chatbot] Demande créée avec ID: ${createdRequest.id}, service_id: "${createdRequest.service_id}"`);
      
      const successMessage = {
        id: Date.now().toString(),
        text: "Votre demande a été enregistrée avec succès ! Vous recevrez bientôt des offres de prestataires.",
        isUser: false,
        animValue: new Animated.Value(0)
      };
      
      setMessages(prev => [...prev, successMessage]);
      
      // Reset form
      setFormData({
        location: {}
      });
      setFormComplete(false);
      
      // Navigate to requests screen after a short delay
      setTimeout(() => {
        navigation.navigate('ClientTabs', { screen: 'Requests' });
      }, 2000);
    } catch (error) {
      console.error('Error submitting request:', error);
      
      const errorMessage = {
        id: Date.now().toString(),
        text: "Une erreur s'est produite lors de l'enregistrement de votre demande. Veuillez réessayer.",
        isUser: false,
        animValue: new Animated.Value(0)
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: Message }) => (
    <ChatMessage 
      text={item.text} 
      isUser={item.isUser}
      animationValue={item.animValue}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <Image 
              source={{ uri: 'https://i.imgur.com/VhfSTEy.png' }} 
              style={styles.headerIcon} 
              resizeMode="cover"
            />
          </View>
          <View style={styles.headerTextContainer}>
            <Text variant="h4" weight="semibold" color="text">
              Pat, votre assistant intelligent
            </Text>
            <Text variant="body2" color="text-secondary">
              Trouvez le service idéal en quelques messages
            </Text>
          </View>
        </View>
      </View>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{flex: 1}}
        keyboardVerticalOffset={10}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          style={styles.chatList}
          contentContainerStyle={{
            padding: SPACING.md,
            paddingBottom: formComplete ? 280 : 100,
          }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        />
        
        {formComplete && (
          <View style={styles.formSummaryContainer}>
            <Card 
              elevation="md" 
              style={styles.formSummary}
              borderRadius={BORDER_RADIUS.lg}
            >
              <Text variant="h4" weight="semibold" style={styles.summaryTitle}>
                Récapitulatif
              </Text>
              
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <View style={styles.summaryIconContainer}>
                    <Ionicons name="construct" size={18} color={COLORS.primary} />
                  </View>
                  <View style={styles.summaryContent}>
                    <Text variant="caption" color="text-secondary">Service</Text>
                    <Text variant="body2" weight="medium">{formData.service}</Text>
                  </View>
                </View>
                
                <View style={styles.summaryItem}>
                  <View style={styles.summaryIconContainer}>
                    <Ionicons name="location" size={18} color={COLORS.primary} />
                  </View>
                  <View style={styles.summaryContent}>
                    <Text variant="caption" color="text-secondary">Adresse</Text>
                    <Text variant="body2" weight="medium" numberOfLines={2}>
                      {formData.location?.address}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.summaryItem}>
                  <View style={styles.summaryIconContainer}>
                    <Ionicons name="alarm" size={18} color={COLORS.primary} />
                  </View>
                  <View style={styles.summaryContent}>
                    <Text variant="caption" color="text-secondary">Urgence</Text>
                    <View style={styles.urgencyContainer}>
                      {[1, 2, 3, 4, 5].map(dot => (
                        <View
                          key={dot}
                          style={[
                            styles.urgencyDot,
                            dot <= (formData.urgency || 0) ? styles.activeDot : styles.inactiveDot
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                </View>
              </View>
              
              {formData.notes && (
                <View style={styles.notesContainer}>
                  <Text variant="caption" color="text-secondary">Notes</Text>
                  <Text variant="body2">{formData.notes}</Text>
                </View>
              )}
              
              <Button
                label={loading ? 'Envoi en cours...' : 'Valider ma demande'}
                onPress={handleSubmitRequest}
                disabled={loading}
                variant="primary"
                loading={loading}
                size="md"
                style={styles.submitButton}
              />
            </Card>
          </View>
        )}
        
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Tapez votre message..."
              placeholderTextColor={COLORS.textSecondary}
              editable={!loading}
              multiline={false}
              maxLength={500}
            />
            
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || loading) && styles.sendButtonDisabled
              ]}
              onPress={handleSendMessage}
              disabled={!inputText.trim() || loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Ionicons name="send" size={18} color={COLORS.white} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
    overflow: 'hidden',
  },
  headerIcon: {
    width: 40,
    height: 40,
  },
  headerTextContainer: {
    flex: 1,
  },
  chatList: {
    flex: 1,
  },
  formSummaryContainer: {
    position: 'absolute',
    bottom: 70,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
    zIndex: 5,
  },
  formSummary: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
  },
  summaryTitle: {
    marginBottom: SPACING.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    margin: -4,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '50%',
    padding: 4,
    marginBottom: SPACING.sm,
  },
  summaryIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  summaryContent: {
    flex: 1,
  },
  urgencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  urgencyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  activeDot: {
    backgroundColor: COLORS.warning,
  },
  inactiveDot: {
    backgroundColor: COLORS.backgroundDark,
  },
  notesContainer: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
  },
  submitButton: {
    marginTop: SPACING.md,
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.input,
    borderRadius: BORDER_RADIUS.round,
    paddingLeft: 16,
    paddingRight: 4,
    height: 40,
    width: '85%',
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: 'transparent',
    fontSize: 15,
    color: COLORS.text,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    height: 32,
    width: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.small,
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
    opacity: 0.5,
  },
});

export default ChatbotScreen;