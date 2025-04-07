import React from 'react';
import { View, ViewProps, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from './Text';
import { COLORS, BORDER_RADIUS, SPACING } from '../../utils/theme';

interface BadgeProps extends ViewProps {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info';
  size?: 'sm' | 'md' | 'lg';
  label: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onPress?: () => void;
  solid?: boolean;
  border?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'primary',
  size = 'md',
  label,
  leftIcon,
  rightIcon,
  style,
  onPress,
  solid = false,
  border = false,
  ...props
}) => {
  // Get variant background color
  const getVariantStyle = () => {
    const color = getVariantColor();
    
    if (solid) {
      return { backgroundColor: color };
    }
    
    return { 
      backgroundColor: color + '15', // 15% opacity
      ...(border && { borderWidth: 1, borderColor: color })
    };
  };
  
  // Get variant color
  const getVariantColor = () => {
    switch(variant) {
      case 'secondary':
        return COLORS.secondary;
      case 'success':
        return COLORS.success;
      case 'danger':
        return COLORS.danger;
      case 'warning':
        return COLORS.warning;
      case 'info':
        return COLORS.info;
      default:
        return COLORS.primary;
    }
  };
  
  // Get text color
  const getTextColor = () => {
    if (solid) {
      return 'light';
    }
    
    return variant;
  };
  
  // Get badge size
  const getSizeStyle = () => {
    switch(size) {
      case 'sm':
        return styles.smallBadge;
      case 'lg':
        return styles.largeBadge;
      default:
        return styles.mediumBadge;
    }
  };
  
  // Get text size
  const getTextVariant = () => {
    switch(size) {
      case 'sm':
        return 'caption';
      case 'lg':
        return 'body1';
      default:
        return 'body2';
    }
  };
  
  const Wrapper = onPress ? TouchableOpacity : View;
  
  return (
    <Wrapper 
      style={[
        styles.badge, 
        getVariantStyle(), 
        getSizeStyle(), 
        style
      ]} 
      onPress={onPress}
      activeOpacity={0.8}
      {...props}
    >
      {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
      <Text 
        variant={getTextVariant()} 
        weight="medium" 
        color={getTextColor()}
      >
        {label}
      </Text>
      {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.round,
    alignSelf: 'flex-start',
  },
  smallBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  mediumBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  largeBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  leftIcon: {
    marginRight: 4,
  },
  rightIcon: {
    marginLeft: 4,
  },
});

export default Badge;