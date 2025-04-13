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
  Keyboard,
  Animated,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChatMessage from '../../components/ChatMessage';
import { Text } from '../../components/ui';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { 
  sendMessage, 
  getMessagesByJobId, 
  markMessagesAsRead, 
  listenToNewMessages,
  pickImage,
  takePhoto
} from '../../services/chat';
import { getJobByOfferId } from '../../services/api';
import { ChatMessage as ChatMessageType, Job } from '../../types';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  imageUrl?: string;
  animValue: Animated.Value;
  timestamp: string; // Horodatage du message
}

const ChatScreen = ({ route, navigation }: any) => {
  // Accepter soit jobId soit offerId dans les paramètres
  const { jobId: directJobId, offerId } = route.params;
  const jobId = directJobId || offerId; // Utiliser l'un ou l'autre
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const flatListRef = useRef<FlatList>(null);

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

  // Fetch job and messages
  useEffect(() => {
    const fetchJobAndMessages = async () => {
      setLoading(true);
      try {
        if (!jobId) {
          console.error('Aucun ID fourni (ni jobId ni offerId)');
          throw new Error('Paramètres manquants');
        }
        
        console.log(`Tentative de récupération des données avec ID: ${jobId}`);
        
        // Récupérer le job
        const jobData = await getJobByOfferId(jobId);
        let chatMessages = [];
        let effectiveJobId = jobId;
        
        if (jobData) {
          console.log(`Job trouvé avec l'ID ${jobId}:`, jobData.id);
          // Utiliser les données telles quelles, sans enrichissement qui pourrait causer des erreurs
          setJob(jobData);
          
          // Récupérer les messages - utiliser l'ID réel du job s'il est différent
          effectiveJobId = jobData.id !== jobId ? jobData.id : jobId;
          console.log(`Récupération des messages pour jobId: ${effectiveJobId}`);
          chatMessages = await getMessagesByJobId(effectiveJobId);
        } else {
          console.log(`Aucun job trouvé pour l'ID ${jobId}, création d'un job virtuel`);
          
          // Erreur - On ne peut pas créer de job virtuel car les messages sont liés aux jobs
          // dans la base de données par contrainte de clé étrangère
          Alert.alert(
            "Impossible d'accéder au chat",
            "Aucun job n'a été trouvé pour cette conversation. Le chat sera disponible une fois que la mission aura été créée."
          );
          
          // Pour éviter les erreurs, on crée un job virtuel pour l'affichage uniquement
          const virtualJob = {
            id: jobId,
            offer_id: offerId || jobId,
            client_id: user?.role === 'client' ? user.id : 'unknown-client',
            prestataire_id: user?.role === 'prestataire' ? user.id : 'unknown-prestataire',
            tracking_status: 'not_started',
            is_completed: false,
            created_at: new Date().toISOString()
          };
          
          setJob(virtualJob);
          
          // Pas de messages pour ce job car il n'existe pas en base de données
          console.log("Impossible de récupérer les messages pour un job inexistant");
          chatMessages = [];
        }
          
        // Convertir les messages
        const formattedMessages = chatMessages.map(msg => {
          // Pour les messages existants, essayer de récupérer l'image base64 si disponible
          let displayUrl = null;
          
          // Vérifier si le message contient des métadonnées avec image base64
          const meta = msg.meta as any; // Type casting pour accéder à meta
          const hasBase64 = meta && meta.has_image && meta.image_base64;
          
          if (hasBase64) {
            // Utiliser l'image base64 stockée
            displayUrl = meta.image_base64;
            console.log(`Message ${msg.id} a une image base64`);
          } else if (msg.image_url) {
            // Essayer d'utiliser l'URL de l'image avec timestamp pour éviter le cache
            displayUrl = `${msg.image_url}?t=${Date.now()}`;
            console.log(`Message ${msg.id} utilise l'URL Supabase: ${displayUrl}`);
          }
          
          return {
            id: msg.id,
            text: msg.content,
            isUser: msg.sender_id === user?.id,
            imageUrl: displayUrl,
            animValue: new Animated.Value(1), // Pas d'animation pour les messages existants
            timestamp: msg.created_at || new Date().toISOString() // Utiliser l'horodatage réel
          };
        });
        
        setMessages(formattedMessages);
        
        // Marquer les messages comme lus
        if (user) {
          markMessagesAsRead(jobId, user.id);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération du job et des messages:', error);
        Alert.alert(
          'Erreur',
          'Impossible de charger la conversation. Veuillez réessayer plus tard.'
        );
      } finally {
        setLoading(false);
      }
    };
    
    fetchJobAndMessages();
  }, [jobId, user?.id, offerId]);

  // Listen for new messages
  useEffect(() => {
    if (!jobId) return;
    
    // S'abonner aux nouveaux messages
    const unsubscribe = listenToNewMessages(jobId, (newMessage) => {
      if (newMessage.sender_id !== user?.id) {
        // C'est un message reçu d'une autre personne
        console.log("Nouveau message reçu:", newMessage);
        console.log("Message contient une image:", newMessage.image_url ? "Oui" : "Non");
        
        // Vérifier si le message contient une image
        let displayUrl = null;
        
        // Vérifier si le message contient des métadonnées avec image base64
        const meta = newMessage.meta as any; // Type casting pour accéder à meta
        const hasBase64 = meta && meta.has_image && meta.image_base64;
        
        if (hasBase64) {
          // Utiliser l'image base64 stockée dans les métadonnées
          displayUrl = meta.image_base64;
          console.log("Utilisation de l'image base64 du message");
        } else if (newMessage.image_url) {
          // Essayer d'utiliser l'URL de l'image avec timestamp pour éviter le cache
          displayUrl = `${newMessage.image_url}?t=${Date.now()}`;
          console.log("Utilisation de l'URL Supabase:", displayUrl);
        }
        
        const formattedMessage = {
          id: newMessage.id,
          text: newMessage.content,
          isUser: false,
          imageUrl: displayUrl, // Sera undefined si pas d'image
          animValue: new Animated.Value(0),
          timestamp: newMessage.created_at || new Date().toISOString() // Utiliser l'horodatage réel ou actuel
        };
        
        setMessages(prev => [...prev, formattedMessage]);
        
        // Marquer le message comme lu
        if (user) {
          markMessagesAsRead(jobId, user.id);
        }
      }
    });
    
    // Nettoyer l'abonnement
    return () => {
      unsubscribe();
    };
  }, [jobId, user?.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [messages]);

  const handleImagePress = (imageUrl: string) => {
    setViewingImage(imageUrl);
    setModalVisible(true);
  };

  const handleAddImage = async () => {
    Alert.alert(
      'Ajouter une image',
      'Choisissez une source pour votre image',
      [
        {
          text: 'Galerie',
          onPress: async () => {
            const uri = await pickImage();
            if (uri) {
              setSelectedImage(uri);
            }
          }
        },
        {
          text: 'Appareil photo',
          onPress: async () => {
            const uri = await takePhoto();
            if (uri) {
              setSelectedImage(uri);
            }
          }
        },
        {
          text: 'Annuler',
          style: 'cancel'
        }
      ]
    );
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
  };

  const handleSendMessage = async () => {
    if ((!inputText.trim() && !selectedImage) || !user || !job) return;
    
    // Vérifier que le job existe réellement avant d'essayer d'envoyer un message
    if (job.id === jobId && !job.tracking_status) {
      // C'est probablement un job virtuel, afficher un message d'erreur
      Alert.alert(
        "Impossible d'envoyer le message",
        "Aucun job n'a été trouvé pour cette conversation. Le chat sera disponible une fois que la mission aura été créée."
      );
      return;
    }
    
    const receiverId = user.id === job.client_id 
      ? job.prestataire_id 
      : job.client_id;
    
    // Ajouter le message à l'interface utilisateur immédiatement
    const localImageUri = selectedImage; // Conserver l'URI locale pour référence
    console.log("URI locale de l'image avant envoi:", localImageUri);
    
    const tempMessage = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      imageUrl: localImageUri || undefined,
      animValue: new Animated.Value(0),
      timestamp: new Date().toISOString() // Ajouter l'horodatage actuel
    };
    
    setMessages(prev => [...prev, tempMessage]);
    setInputText('');
    setSelectedImage(null);
    setSending(true);
    
    try {
      // Récupérer le vrai job ID si on utilise un offerId
      let effectiveJobId = job.id;
      console.log(`Tentative d'envoi du message avec le jobId: ${effectiveJobId}`);
      
      // Envoyer le message à la base de données
      const sentMessage = await sendMessage(
        effectiveJobId,
        user.id,
        receiverId,
        inputText,
        selectedImage || undefined
      );
      
      // Remplacer le message temporaire par le message réel
      // Utiliser l'URL de démonstration pour l'affichage
      console.log("Message envoyé, URL d'image stockée:", sentMessage.image_url);
      console.log("URL d'affichage temporaire:", sentMessage.temp_display_url);
      
      // Décider quelle source d'image utiliser pour l'affichage
      // Priorité: 1. URI locale, 2. Base64, 3. URL Supabase, 4. Image de démonstration
      const imageSource = localImageUri || sentMessage.base64_image || sentMessage.temp_display_url || null;
      
      console.log("Source d'image choisie:", imageSource ? 
                (imageSource.startsWith('file://') ? 'URI locale' : 
                 imageSource.startsWith('data:') ? 'Base64' : 'URL') : 'Aucune');
      
      const messageWithImage = {
        id: sentMessage.id,
        text: sentMessage.content,
        isUser: true,
        imageUrl: imageSource,
        animValue: tempMessage.animValue,
        timestamp: sentMessage.created_at || tempMessage.timestamp,
        // Ajouter des métadonnées auxiliaires
        base64Image: sentMessage.base64_image // Conserver l'image base64 pour le partage
      };
      
      console.log("Image URL utilisée dans le message:", messageWithImage.imageUrl);
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempMessage.id ? messageWithImage : msg
        )
      );
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      // Marquer le message comme ayant échoué
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempMessage.id 
            ? { ...msg, text: `${msg.text} (non envoyé)` }
            : msg
        )
      );
      
      // Afficher une alerte plus détaillée pour aider au débogage
      Alert.alert(
        "Erreur lors de l'envoi du message",
        "Impossible d'envoyer votre message. Vérifiez que la mission a bien été créée.",
        [{ text: "OK" }]
      );
    } finally {
      setSending(false);
    }
  };

  const renderMessageItem = ({ item, index }: { item: Message, index: number }) => {
    // Vérifier s'il faut afficher une séparation de date
    const showDateSeparator = index === 0 || (
      index > 0 && 
      new Date(item.timestamp).toDateString() !== new Date(messages[index - 1].timestamp).toDateString()
    );
    
    // Composant rendu
    return (
      <>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text variant="caption" color="text-secondary" style={styles.dateSeparatorText}>
              {new Date(item.timestamp).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </Text>
          </View>
        )}
        <ChatMessage 
          text={item.text}
          isUser={item.isUser}
          imageUrl={item.imageUrl}
          animationValue={item.animValue}
          onImagePress={handleImagePress}
          timestamp={item.timestamp}
        />
      </>
    );
  };

  const getHeaderTitle = () => {
    if (!job) return 'Chat';
    
    const isClient = user?.id === job.client_id;
    let name = '';
    
    if (isClient && job.prestataires) {
      // Le client parle au prestataire
      name = job.prestataires.name || job.prestataires.email?.split('@')[0] || 'Prestataire';
    } else if (!isClient && job.clients) {
      // Le prestataire parle au client
      name = job.clients.name || job.clients.email?.split('@')[0] || 'Client';
    }
    
    return name;
  };

  // Mettre à jour le titre du header de navigation
  useEffect(() => {
    navigation.setOptions({
      title: getHeaderTitle()
    });
  }, [job, navigation]);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Vérifier si le job est virtuel (créé localement) ou réel (vient de la base de données)
  const isVirtualJob = job ? (job.id === jobId && !job.tracking_status) : false;
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {job && (
          <View style={[styles.jobInfoBanner, isVirtualJob ? styles.virtualJobBanner : null]}>
            <Ionicons 
              name={isVirtualJob ? "alert-circle-outline" : "briefcase-outline"} 
              size={16} 
              color={COLORS.white} 
              style={styles.bannerIcon} 
            />
            <Text variant="body2" color="light">
              {isVirtualJob ? "Mission en attente de création" : `Mission #${job.id.substring(0, 8)}`}
            </Text>
            <TouchableOpacity 
              style={styles.infoButton}
              onPress={() => {
                Alert.alert(
                  'Informations de la mission', 
                  isVirtualJob 
                    ? "Cette mission est en attente de création. Le chat sera disponible une fois la mission créée."
                    : `Détails de la mission:\n${job.offers?.requests?.service_name || 'Service'} - Prix: ${job.offers?.price || '0'}€`
                );
              }}
            >
              <Ionicons name="information-circle-outline" size={18} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        )}
        
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessageItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons 
                  name={isVirtualJob ? "alert-circle-outline" : "chatbubbles-outline"} 
                  size={40} 
                  color="#FFFFFF" 
                />
              </View>
              <Text variant="h6" weight="semibold" style={styles.emptyTitle}>
                {isVirtualJob ? "Chat non disponible" : "Aucun message"}
              </Text>
              <Text variant="body2" color="text-secondary" style={styles.emptySubtitle}>
                {isVirtualJob 
                  ? "Le chat sera disponible une fois que la mission aura été créée."
                  : "Commencez la conversation en envoyant un message ci-dessous"}
              </Text>
            </View>
          }
        />
        
        {/* Modal pour afficher une image en plein écran */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setModalVisible(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="close-outline" size={32} color="#FFFFFF" />
            </TouchableOpacity>
            {viewingImage && (
              <View style={styles.fullImageContainer}>
                <Image 
                  source={{ uri: viewingImage }} 
                  style={styles.fullImage} 
                  resizeMode="contain"
                />
              </View>
            )}
          </View>
        </Modal>
        
        {/* Prévisualisation de l'image sélectionnée */}
        {selectedImage && (
          <View style={styles.imagePreviewContainer}>
            <Image 
              source={{ uri: selectedImage }} 
              style={styles.imagePreview} 
              resizeMode="cover"
            />
            <TouchableOpacity 
              style={styles.removeImageButton}
              onPress={handleRemoveImage}
            >
              <Ionicons name="close-circle" size={24} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        )}
        
        <Animated.View style={[
          styles.inputContainer,
          {
            transform: [
              { translateY: keyboardHeight > 0 ? -keyboardHeight + (Platform.OS === 'ios' ? 0 : 10) : 0 }
            ]
          }
        ]}>
          {isVirtualJob ? (
            <View style={styles.disabledInputContainer}>
              <Text style={styles.disabledInputText}>
                Le chat sera disponible quand la mission sera créée
              </Text>
            </View>
          ) : (
            <View style={styles.inputToolbar}>
              <View style={styles.inputMainRow}>
                <TouchableOpacity
                  style={styles.modernAddImageButton}
                  onPress={handleAddImage}
                  disabled={sending || isVirtualJob}
                >
                  <Ionicons name="image-outline" size={22} color="#555555" />
                </TouchableOpacity>
                
                <View style={styles.modernInputWrapper}>
                  <TextInput
                    style={styles.modernInput}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="Message"
                    placeholderTextColor="#8E8E93"
                    editable={!sending && !isVirtualJob}
                    multiline={true}
                    numberOfLines={3}
                    maxLength={500}
                  />
                </View>
                
                <TouchableOpacity
                  style={[
                    styles.modernSendButton,
                    ((!inputText.trim() && !selectedImage) || sending || isVirtualJob) ? 
                      styles.sendButtonDisabled : styles.sendButtonActive
                  ]}
                  onPress={handleSendMessage}
                  disabled={(!inputText.trim() && !selectedImage) || sending || isVirtualJob}
                  activeOpacity={0.7}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>
              
              {inputText.length > 0 && !isVirtualJob && (
                <View style={styles.typingIndicatorContainer}>
                  <View style={styles.modernTypingIndicator}>
                    <Ionicons name="ellipsis-horizontal" size={16} color="#8E8E93" />
                    <Text variant="caption" color="text-secondary" style={styles.typingText}>
                      En train d'écrire...
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </Animated.View>
      </View>
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
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jobInfoBanner: {
    backgroundColor: 'rgba(52, 120, 246, 0.95)', // Bleu avec légère transparence
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...SHADOWS.medium,
    marginBottom: 2,
  },
  virtualJobBanner: {
    backgroundColor: 'rgba(245, 166, 35, 0.95)', // Orange avec légère transparence
  },
  bannerIcon: {
    marginRight: 8,
  },
  infoButton: {
    padding: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledInputContainer: {
    backgroundColor: '#F2F2F7',
    padding: SPACING.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  disabledInputText: {
    color: '#8E8E93',
    fontSize: 14,
    fontStyle: 'italic',
  },
  messagesContainer: {
    padding: SPACING.md,
    paddingBottom: 100, // Espace suffisant pour ne pas être caché par la barre d'entrée
    paddingTop: SPACING.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
    height: 350,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3478F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    ...SHADOWS.medium,
  },
  emptyTitle: {
    fontSize: 18,
    color: '#333333',
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
    color: '#8E8E93',
  },
  // Séparateur de date
  dateSeparator: {
    alignItems: 'center',
    marginVertical: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dateSeparatorText: {
    backgroundColor: COLORS.backgroundDark,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    fontSize: 12,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  // Image modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImageContainer: {
    width: '100%',
    height: '85%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  fullImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  fullImageLoader: {
    position: 'absolute',
    zIndex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 45,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 24,
    padding: 10,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  // Image preview styles
  imagePreviewContainer: {
    padding: SPACING.sm,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: BORDER_RADIUS.md,
  },
  previewLoader: {
    position: 'absolute',
    zIndex: 1,
  },
  removeImageButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: 0,
    zIndex: 2,
    ...SHADOWS.small,
  },
  // Styles modernes pour la zone de saisie
  inputContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.md,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 8,
    ...SHADOWS.medium,
    zIndex: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  inputToolbar: {
    width: '100%',
  },
  inputMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  modernAddImageButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#F2F2F7',
  },
  modernInputWrapper: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 38,
    maxHeight: 120,
  },
  modernInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    paddingVertical: 0,
  },
  typingIndicatorContainer: {
    width: '100%',
    alignItems: 'flex-start',
    marginTop: 4,
    paddingLeft: 46,
  },
  modernTypingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingText: {
    marginLeft: 4,
    fontSize: 11,
  },
  modernSendButton: {
    height: 38,
    width: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    ...SHADOWS.small,
  },
  sendButtonActive: {
    backgroundColor: '#3478F6',
  },
  sendButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
});

export default ChatScreen;