import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Modal, 
  Animated, 
  TouchableWithoutFeedback, 
  Dimensions, 
  PanResponder,
  StyleSheet
} from 'react-native';
import { COLORS, BORDER_RADIUS, SHADOWS } from '../../utils/theme';

const { height } = Dimensions.get('window');

interface BottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  snapPoint?: number;
  backgroundColor?: string;
  handleColor?: string;
  borderRadius?: number;
  children: React.ReactNode;
  contentStyle?: any;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isVisible,
  onClose,
  snapPoint = 50, // pourcentage de l'écran
  backgroundColor = COLORS.white,
  handleColor = COLORS.border,
  borderRadius = BORDER_RADIUS.xl,
  children,
  contentStyle,
}) => {
  const translateY = useRef(new Animated.Value(height)).current;
  const sheetHeight = (snapPoint / 100) * height;
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Si on fait glisser la sheet vers le bas plus que 20% de sa hauteur, on la ferme
        if (gestureState.dy > sheetHeight * 0.2) {
          Animated.timing(translateY, {
            toValue: height,
            duration: 250,
            useNativeDriver: true,
          }).start(onClose);
        } else {
          // Sinon on la remet en place
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Animer l'ouverture et la fermeture
  useEffect(() => {
    if (isVisible) {
      translateY.setValue(height);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, translateY]);

  if (!isVisible) return null;

  return (
    <Modal
      transparent
      animationType="none"
      visible={isVisible}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.bottomSheet,
                {
                  height: sheetHeight,
                  backgroundColor,
                  borderTopLeftRadius: borderRadius,
                  borderTopRightRadius: borderRadius,
                  transform: [{ translateY }],
                },
              ]}
              {...panResponder.panHandlers}
            >
              <View 
                style={[
                  styles.handle, 
                  { backgroundColor: handleColor }
                ]} 
              />
              
              <View style={[styles.content, contentStyle]}>
                {children}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    width: '100%',
    ...SHADOWS.large,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    marginTop: 10,
    marginBottom: 10,
    alignSelf: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  }
});

export default BottomSheet;