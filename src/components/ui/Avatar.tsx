import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity, ViewProps } from 'react-native';
import { COLORS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import Text from './Text';

interface AvatarProps extends ViewProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  source?: { uri: string } | null | number;
  initials?: string;
  backgroundColor?: string;
  textColor?: string;
  online?: boolean;
  borderColor?: string;
  borderWidth?: number;
  iconName?: string;
  onPress?: () => void;
}

export const Avatar: React.FC<AvatarProps> = ({
  size = 'md',
  source,
  initials,
  backgroundColor = COLORS.primary,
  textColor = COLORS.white,
  online,
  style,
  borderColor = COLORS.border,
  borderWidth = 0,
  iconName,
  onPress,
  ...props
}) => {
  // Tailles
  const sizesInPx = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 72,
  };
  
  // Tailles texte
  const textVariants = {
    xs: 'caption',
    sm: 'caption',
    md: 'body2',
    lg: 'body1',
    xl: 'body1',
  };
  
  // Statut online
  const statusSizes = {
    xs: 8,
    sm: 10,
    md: 12,
    lg: 14,
    xl: 16,
  };
  
  const sizeInPx = typeof size === 'number' ? size : sizesInPx[size];
  const avatarSize = { width: sizeInPx, height: sizeInPx };
  const statusSize = typeof size === 'number' ? sizeInPx / 3 : statusSizes[size];
  const iconSize = typeof size === 'number' ? sizeInPx / 2 : sizeInPx / 2;
  
  const renderContent = () => {
    if (source) {
      return (
        <Image
          source={source}
          style={[styles.image, avatarSize]}
          resizeMode="cover"
        />
      );
    }
    
    if (iconName) {
      return (
        <Ionicons
          name={iconName as any}
          size={iconSize}
          color={textColor}
        />
      );
    }
    
    if (initials) {
      return (
        <Text 
          variant={typeof size === 'number' ? 'body2' : textVariants[size]} 
          weight="medium" 
          color="light"
        >
          {initials.substring(0, 2).toUpperCase()}
        </Text>
      );
    }
    
    return (
      <Ionicons
        name="person"
        size={iconSize}
        color={textColor}
      />
    );
  };
  
  const Container = onPress ? TouchableOpacity : View;
  
  return (
    <View style={[styles.wrapper, style]} {...props}>
      <Container 
        style={[
          styles.container, 
          avatarSize, 
          { 
            backgroundColor,
            borderColor,
            borderWidth
          }
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {renderContent()}
      </Container>
      
      {online !== undefined && (
        <View 
          style={[
            styles.statusIndicator,
            {
              width: statusSize,
              height: statusSize,
              backgroundColor: online ? COLORS.success : COLORS.gray
            }
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  container: {
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: COLORS.white,
  }
});

export default Avatar;