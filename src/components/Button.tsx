import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle
} from 'react-native';
import { COLORS, FONTS, SIZES, SHADOWS } from '../utils/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'success' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon
}) => {
  // Définir les styles en fonction de la variante et de la taille
  const getButtonStyle = () => {
    let backgroundColor;
    let borderColor;
    let borderWidth = 0;

    switch (variant) {
      case 'secondary':
        backgroundColor = COLORS.secondary;
        break;
      case 'outline':
        backgroundColor = 'transparent';
        borderColor = COLORS.primary;
        borderWidth = 1;
        break;
      case 'success':
        backgroundColor = COLORS.success;
        break;
      case 'danger':
        backgroundColor = COLORS.danger;
        break;
      case 'primary':
      default:
        backgroundColor = COLORS.primary;
        break;
    }

    let paddingVertical;
    let paddingHorizontal;

    switch (size) {
      case 'small':
        paddingVertical = SIZES.base;
        paddingHorizontal = SIZES.base * 1.5;
        break;
      case 'large':
        paddingVertical = SIZES.padding;
        paddingHorizontal = SIZES.padding * 1.5;
        break;
      case 'medium':
      default:
        paddingVertical = SIZES.base * 1.5;
        paddingHorizontal = SIZES.padding;
        break;
    }

    return {
      backgroundColor,
      borderColor,
      borderWidth,
      paddingVertical,
      paddingHorizontal,
      opacity: disabled ? 0.6 : 1
    };
  };

  // Définir les styles de texte en fonction de la variante et de la taille
  const getTextStyle = () => {
    let color;

    switch (variant) {
      case 'outline':
        color = COLORS.primary;
        break;
      default:
        color = COLORS.white;
        break;
    }

    let fontSize;

    switch (size) {
      case 'small':
        fontSize = SIZES.body3;
        break;
      case 'large':
        fontSize = SIZES.body1;
        break;
      case 'medium':
      default:
        fontSize = SIZES.body2;
        break;
    }

    return {
      color,
      fontSize,
      fontWeight: 'bold'
    };
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getButtonStyle(),
        SHADOWS.small,
        style
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' ? COLORS.primary : COLORS.white}
        />
      ) : (
        <>
          {icon && icon}
          <Text style={[styles.text, getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: SIZES.radius,
    marginVertical: SIZES.base,
  },
  text: {
    textAlign: 'center',
    width: '100%'
  }
});

export default Button;