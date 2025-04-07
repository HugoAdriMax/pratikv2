import React, { useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text } from './ui/Text';
import { COLORS, BORDER_RADIUS, SHADOWS, SPACING } from '../utils/theme';

interface ChatMessageProps {
  text: string;
  isUser: boolean;
  animationValue?: Animated.Value;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  text, 
  isUser,
  animationValue = new Animated.Value(0)
}) => {
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
        <Text
          style={styles.messageText}
          color={isUser ? 'light' : 'text'}
        >
          {text}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
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
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    minHeight: 36,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
    ...SHADOWS.small,
  },
  botBubble: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 20,
  },
});

export default ChatMessage;