import React from 'react';
import {
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../utils/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  shadowLevel?: 'none' | 'small' | 'medium' | 'large';
}

const Card: React.FC<CardProps> = ({
  children,
  style,
  shadowLevel = 'small',
}) => {
  const getShadow = () => {
    switch (shadowLevel) {
      case 'none':
        return {};
      case 'medium':
        return SHADOWS.medium;
      case 'large':
        return SHADOWS.large;
      case 'small':
      default:
        return SHADOWS.small;
    }
  };

  return (
    <View style={[styles.card, getShadow(), style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    padding: SIZES.padding,
    marginVertical: SIZES.base,
  },
});

export default Card;