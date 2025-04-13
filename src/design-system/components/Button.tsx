import React from 'react';
import { 
  TouchableOpacity, 
  ActivityIndicator, 
  TouchableOpacityProps, 
  View,
  StyleSheet 
} from 'react-native';
import { COLORS, SHADOWS, BORDER_RADIUS, ButtonVariant, ButtonSize } from '../tokens';
import Text from '../../components/ui/Text'; // Utilisation du composant Text existant pour l'instant

/**
 * Composant Button unifié
 * 
 * Ce composant combine les fonctionnalités des deux composants Button précédents
 * et offre une API cohérente.
 */
interface ButtonProps extends TouchableOpacityProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  // Support des deux prop names pour la compatibilité
  label?: string;
  title?: string;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  rounded?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  label,
  title, // Pour la compatibilité avec l'ancien Button
  loading = false,
  icon,
  iconPosition = 'left',
  disabled,
  rounded = false,
  style,
  children,
  ...props
}) => {
  // Utiliser label ou title (pour la compatibilité)
  const buttonText = label || title;

  // Get button style based on variant
  const getButtonStyle = () => {
    switch(variant) {
      case 'primary':
        return styles.primaryButton;
      case 'secondary':
        return styles.secondaryButton;
      case 'success':
        return styles.successButton;
      case 'danger':
        return styles.dangerButton;
      case 'outline':
        return styles.outlineButton;
      case 'ghost':
        return styles.ghostButton;
      default:
        return styles.primaryButton;
    }
  };
  
  // Get button color by variant for text and icons
  const getButtonColorByVariant = () => {
    switch(variant) {
      case 'primary': return COLORS.primary;
      case 'secondary': return COLORS.secondary;
      case 'success': return COLORS.success;
      case 'danger': return COLORS.danger;
      default: return COLORS.primary;
    }
  };
  
  // Get button size
  const getSizeStyle = () => {
    switch(size) {
      case 'sm':
        return styles.smallButton;
      case 'lg':
        return styles.largeButton;
      default:
        return styles.mediumButton;
    }
  };
  
  return (
    <TouchableOpacity 
      style={[
        styles.button,
        getButtonStyle(),
        getSizeStyle(),
        rounded && styles.roundedButton,
        disabled || loading ? styles.disabledButton : {},
        style
      ]}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      <View style={styles.contentContainer}>
        {loading && (
          <ActivityIndicator 
            size="small" 
            color={variant === 'outline' || variant === 'ghost' ? getButtonColorByVariant() : '#FFFFFF'} 
            style={{ marginRight: 8 }} 
          />
        )}
        
        {icon && iconPosition === 'left' && !loading && (
          <View style={{ marginRight: 8 }}>{icon}</View>
        )}
        
        {children || (buttonText && (
          <Text 
            variant={size === 'sm' ? 'body2' : size === 'lg' ? 'button' : 'body1'} 
            weight="semibold"
            color={variant === 'outline' || variant === 'ghost' ? getButtonColorByVariant() : 'light'}
          >
            {buttonText}
          </Text>
        ))}
        
        {icon && iconPosition === 'right' && !loading && (
          <View style={{ marginLeft: 8 }}>{icon}</View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  roundedButton: {
    borderRadius: BORDER_RADIUS.round,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: COLORS.secondary,
  },
  successButton: {
    backgroundColor: COLORS.success,
  },
  dangerButton: {
    backgroundColor: COLORS.danger,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  ghostButton: {
    backgroundColor: 'transparent',
  },
  smallButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 36,
  },
  mediumButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 48,
  },
  largeButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    minHeight: 56,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default Button;