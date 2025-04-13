import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity, Image, ActivityIndicator, Platform } from 'react-native';
import { Text } from './ui/Text';
import { COLORS, BORDER_RADIUS, SHADOWS, SPACING } from '../utils/theme';
import { Ionicons } from '@expo/vector-icons';

interface ChatMessageProps {
  text: string;
  isUser: boolean;
  imageUrl?: string;
  animationValue?: Animated.Value;
  onImagePress?: (imageUrl: string) => void;
  timestamp?: string; // Timestamp optionnel pour afficher l'heure du message
}

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  text, 
  isUser,
  imageUrl,
  animationValue = new Animated.Value(0),
  onImagePress,
  timestamp
}) => {
  const [imageLoading, setImageLoading] = useState(!!imageUrl);
  
  // Formater l'heure
  const formattedTime = timestamp ? new Date(timestamp).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  }) : '';
  useEffect(() => {
    // Animation d'entrée
    Animated.timing(animationValue, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const translateY = animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const opacity = animationValue;

  return (
    <Animated.View 
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.botContainer,
        { opacity, transform: [{ translateY }] }
      ]}
    >
      <View 
        style={[
          styles.bubble, 
          isUser ? styles.userBubble : styles.botBubble,
          isUser ? SHADOWS.small : {}
        ]}
      >
        {/* Suppression de l'en-tête de message avec les icônes */}
        
        {/* Contenu du message */}
        <View style={styles.contentContainer}>
          {imageUrl && (
            <TouchableOpacity 
              onPress={() => onImagePress && onImagePress(imageUrl)}
              style={styles.imageContainer}
              activeOpacity={0.9}
            >
              {imageLoading && (
                <ActivityIndicator 
                  size="small" 
                  color={isUser ? COLORS.light : COLORS.primary} 
                  style={styles.imageLoader} 
                />
              )}
              
              <Image 
                source={{ uri: imageUrl }}
                style={styles.messageImage} 
                resizeMode="cover"
                onLoadStart={() => setImageLoading(true)}
                onLoadEnd={() => setImageLoading(false)}
              />
              
              <View style={styles.imageOverlay}>
                <Ionicons name="expand-outline" size={18} color={COLORS.white} />
              </View>
            </TouchableOpacity>
          )}
          
          {text ? (
            <Text
              style={[
                styles.messageText, 
                imageUrl ? styles.messageTextWithImage : null,
              ]}
              color={isUser ? 'light' : 'text'}
            >
              {text}
            </Text>
          ) : null}
        </View>
        
        {/* Pied du message (timestamp) */}
        {timestamp && (
          <View style={styles.messageFooter}>
            <Text variant="caption" style={[
              styles.timestamp,
              isUser ? styles.userTimestamp : styles.otherTimestamp
            ]}>
              {formattedTime}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    paddingHorizontal: 12,
    maxWidth: '85%',
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  botContainer: {
    alignSelf: 'flex-start',
  },
  bubble: {
    padding: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 20,
    minHeight: 36,
    position: 'relative',
    elevation: 1,
  },
  userBubble: {
    backgroundColor: '#3478F6', // Bleu moderne
    borderBottomRightRadius: 4,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    ...SHADOWS.small,
  },
  botBubble: {
    backgroundColor: '#F2F2F7', // Gris clair légèrement bleuté
    borderBottomLeftRadius: 4,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    ...SHADOWS.small,
  },
  // Conteneur de contenu
  contentContainer: {
    position: 'relative',
  },
  messageText: {
    fontSize: 15.5,
    lineHeight: 21,
    fontFamily: 'System',
    letterSpacing: 0.1,
  },
  messageTextWithImage: {
    marginTop: SPACING.xs,
  },
  imageContainer: {
    width: 200,
    height: 150,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.background + '70', // Fond de couleur semi-transparent
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  messageImage: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.backgroundDark,
  },
  imageLoader: {
    position: 'absolute',
    zIndex: 2,
  },
  imageOverlay: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    padding: 4,
    zIndex: 1,
  },
  // Pied de message avec horodatage amélioré
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 9.5,
    letterSpacing: 0.1,
    fontWeight: '500',
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  otherTimestamp: {
    color: 'rgba(60, 60, 67, 0.6)',
  },
});

export default ChatMessage;