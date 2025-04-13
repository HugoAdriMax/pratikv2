import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../tokens';

interface ContainerProps extends ViewProps {
  /**
   * Padding intérieur du container
   */
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Marge extérieur du container
   */
  margin?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Arrière-plan du container
   */
  background?: 'transparent' | 'primary' | 'white' | 'light' | 'dark';
  
  /**
   * Arrondi des coins
   */
  rounded?: boolean;
  
  /**
   * Largeur du container
   */
  width?: 'auto' | 'full';
  
  /**
   * Centrer horizontalement le contenu
   */
  centerX?: boolean;
  
  /**
   * Centrer verticalement le contenu
   */
  centerY?: boolean;
  
  /**
   * Hauteur du container
   */
  height?: 'auto' | 'full';
}

/**
 * Container est un composant de mise en page fondamental qui fournit
 * des options de style cohérentes pour les sections de l'application.
 */
const Container: React.FC<ContainerProps> = ({
  children,
  padding = 'md',
  margin = 'none',
  background = 'white',
  rounded = false,
  width = 'auto',
  height = 'auto',
  centerX = false,
  centerY = false,
  style,
  ...props
}) => {
  // Détermine le padding en fonction de l'option
  const getPadding = () => {
    switch (padding) {
      case 'none': return 0;
      case 'xs': return SPACING.xs;
      case 'sm': return SPACING.sm;
      case 'lg': return SPACING.lg;
      case 'xl': return SPACING.xl;
      case 'md':
      default: return SPACING.md;
    }
  };
  
  // Détermine la marge en fonction de l'option
  const getMargin = () => {
    switch (margin) {
      case 'none': return 0;
      case 'xs': return SPACING.xs;
      case 'sm': return SPACING.sm;
      case 'lg': return SPACING.lg;
      case 'xl': return SPACING.xl;
      case 'md':
      default: return SPACING.md;
    }
  };
  
  // Détermine la couleur d'arrière-plan
  const getBackground = () => {
    switch (background) {
      case 'transparent': return 'transparent';
      case 'primary': return COLORS.primary;
      case 'light': return COLORS.background;
      case 'dark': return COLORS.backgroundDark;
      case 'white':
      default: return COLORS.white;
    }
  };
  
  return (
    <View
      style={[
        {
          padding: getPadding(),
          margin: getMargin(),
          backgroundColor: getBackground(),
          borderRadius: rounded ? BORDER_RADIUS.md : 0,
          width: width === 'full' ? '100%' : undefined,
          height: height === 'full' ? '100%' : undefined,
          alignItems: centerX ? 'center' : undefined,
          justifyContent: centerY ? 'center' : undefined,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

export default Container;