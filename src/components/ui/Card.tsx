import React from 'react';
import { View, ViewProps, TouchableOpacity, StyleSheet, Text as RNText } from 'react-native';
import { COLORS, SHADOWS, BORDER_RADIUS, SPACING } from '../../utils/theme';

interface CardProps extends ViewProps {
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  onPress?: () => void;
  title?: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: boolean;
  borderRadius?: number;
  border?: boolean;
}

export const Card: React.FC<CardProps> = ({
  elevation = 'md',
  onPress,
  title,
  subtitle,
  rightElement,
  footer,
  padding = true,
  borderRadius = BORDER_RADIUS.lg,
  border = false,
  children,
  style,
  ...props
}) => {
  // Get elevation style
  const getElevationStyle = () => {
    switch(elevation) {
      case 'none':
        return {};
      case 'sm':
        return SHADOWS.small;
      case 'lg':
        return SHADOWS.large;
      default:
        return SHADOWS.medium;
    }
  };
  
  const CardContent = () => (
    <View 
      {...props} 
      style={[
        styles.card, 
        getElevationStyle(), 
        { borderRadius },
        border && styles.border,
        style
      ]}
    >
      {(title || subtitle || rightElement) && (
        <View style={[styles.header, padding && styles.headerPadding]}>
          <View style={styles.headerTextContainer}>
            {title && <RNText style={styles.title}>{title}</RNText>}
            {subtitle && <RNText style={styles.subtitle}>{subtitle}</RNText>}
          </View>
          {rightElement && <View>{rightElement}</View>}
        </View>
      )}
      
      <View style={[styles.content, padding && styles.contentPadding]}>
        {children}
      </View>
      
      {footer && (
        <View style={[styles.footer, padding && styles.footerPadding]}>
          {footer}
        </View>
      )}
    </View>
  );
  
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <CardContent />
      </TouchableOpacity>
    );
  }
  
  return <CardContent />;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  border: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerPadding: {
    padding: SPACING.md,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    padding: SPACING.md,
  },
  footer: {
    backgroundColor: COLORS.backgroundDark,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerPadding: {
    padding: SPACING.md,
  },
});

export default Card;