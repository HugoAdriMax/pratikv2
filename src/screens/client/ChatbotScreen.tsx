import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Animated,
  Keyboard,
  Dimensions,
} from 'react-native';
import { analyzeChatMessage, generateChatbotResponse } from '../../services/chatbot';
import { createRequest, getServiceIdByName } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChatMessage from '../../components/ChatMessage';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Text from '../../components/ui/Text';
import { COLORS, FONTS, BORDER_RADIUS, SHADOWS, SPACING } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';

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
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const flatListRef = useRef<FlatList>(null);
  const messageHistoryRef = useRef<string[]>([]);

  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Initial chatbot message
  useEffect(() => {
    const initialMessage = {
      id: Date.now().toString(),
      text: "Bonjour ! Je suis votre assistant personnel. Comment puis-je vous aider aujourd'hui ?",
      isUser: false,
      animValue: new Animated.Value(0)
    };
    
    setMessages([initialMessage]);
    messageHistoryRef.current = ["Assistant: Bonjour ! Je suis votre assistant personnel. Comment puis-je vous aider aujourd'hui ?"];
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
      
      // Update form data based on analysis
      updateFormData(analysis);
      
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

  const updateFormData = (analysis: any) => {
    switch (analysis.type) {
      case 'service_request':
        setFormData(prev => ({
          ...prev,
          service: analysis.content
        }));
        break;
      case 'location':
        // Ideally, we would use a geocoding service to get lat/lng
        setFormData(prev => ({
          ...prev,
          location: {
            ...prev.location,
            address: analysis.content
          }
        }));
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
      
      // Get a valid UUID for the service
      const serviceId = await getServiceIdByName(formData.service || 'Plomberie');
      
      await createRequest({
        client_id: user.id,
        service_id: serviceId,
        location: {
          latitude: formData.location?.latitude || 0,
          longitude: formData.location?.longitude || 0,
          address: formData.location?.address || ''
        },
        urgency: formData.urgency || 3,
        notes: formData.notes
      });
      
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
        navigation.navigate('Requests');
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
      
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerIconContainer}>
              <Ionicons name="chatbubble-ellipses" size={24} color={COLORS.white} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text variant="h4" weight="semibold" color="text">
                Assistant
              </Text>
              <Text variant="body2" color="text-secondary">
                Je vous aide à formuler votre demande
              </Text>
            </View>
          </View>
        </View>
        
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.messagesContainer,
            formComplete && { paddingBottom: 180 }
          ]}
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
  container: {
    flex: 1,
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
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  headerTextContainer: {
    flex: 1,
  },
  messagesContainer: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  formSummaryContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
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
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8, // Plus grand sur iOS pour éviter la barre home
    ...SHADOWS.small,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.input,
    borderRadius: BORDER_RADIUS.round,
    paddingLeft: 16,
    paddingRight: 4,
    height: 40,
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