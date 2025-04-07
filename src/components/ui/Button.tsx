import React from 'react';
import { 
  TouchableOpacity, 
  ActivityIndicator, 
  TouchableOpacityProps, 
  View,
  StyleSheet 
} from 'react-native';
import Text from './Text';
import { COLORS, SHADOWS, BORDER_RADIUS } from '../../utils/theme';

interface ButtonProps extends TouchableOpacityProps {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  rounded?: boolean;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  label,
  loading = false,
  icon,
  iconPosition = 'left',
  disabled,
  rounded = false,
  style,
  children,
  ...props
}) => {
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
  
  // Get text style based on variant
  const getTextStyle = () => {
    switch(variant) {
      case 'outline':
        return { color: getButtonColorByVariant() };
      case 'ghost':
        return { color: getButtonColorByVariant() };
      default:
        return styles.lightText;
    }
  };

  // Get button color by variant
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
  
  // Get text size
  const getTextSizeStyle = () => {
    switch(size) {
      case 'sm':
        return styles.smallText;
      case 'lg':
        return styles.largeText;
      default:
        return styles.mediumText;
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
        
        {children || (
          <Text 
            variant={size === 'sm' ? 'body2' : size === 'lg' ? 'button' : 'body1'} 
            weight="semibold"
            color={variant === 'outline' || variant === 'ghost' ? getButtonColorByVariant() : 'light'}
          >
            {label}
          </Text>
        )}
        
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
    ...SHADOWS.small,
  },
  ghostButton: {
    backgroundColor: 'transparent',
    ...SHADOWS.small,
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
  buttonText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
  lightText: {
    color: COLORS.white,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default Button;