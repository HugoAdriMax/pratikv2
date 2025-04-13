import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../tokens';

interface BoxProps extends ViewProps {
  /**
   * Padding intérieur du box
   */
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Marge extérieure du box
   */
  margin?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Couleur d'arrière-plan
   */
  background?: 'transparent' | 'primary' | 'secondary' | 'white' | 'light' | 'dark' | string;
  
  /**
   * Niveau d'ombrage
   */
  elevation?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Rayon de bordure
   */
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'round';
  
  /**
   * Largeur de bordure
   */
  borderWidth?: number;
  
  /**
   * Couleur de bordure
   */
  borderColor?: 'primary' | 'secondary' | 'border' | string;
  
  /**
   * Direction du flex
   */
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  
  /**
   * Alignement des éléments sur l'axe principal
   */
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  
  /**
   * Alignement des éléments sur l'axe secondaire
   */
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  
  /**
   * Si true, prendra tout l'espace disponible (flex: 1)
   */
  flex?: boolean;
}

/**
 * Box est un composant de mise en page de base très flexible pour créer des layouts.
 */
const Box: React.FC<BoxProps> = ({
  children,
  padding = 'none',
  margin = 'none',
  background = 'transparent',
  elevation = 'none',
  borderRadius = 'none',
  borderWidth = 0,
  borderColor = 'border',
  flexDirection,
  justifyContent,
  alignItems,
  flex = false,
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
      case 'secondary': return COLORS.secondary;
      case 'light': return COLORS.background;
      case 'dark': return COLORS.backgroundDark;
      case 'white': return COLORS.white;
      default: return background; // Couleur personnalisée
    }
  };
  
  // Détermine l'ombrage
  const getElevation = () => {
    switch (elevation) {
      case 'none': return SHADOWS.none;
      case 'xs': return SHADOWS.small;
      case 'sm': return SHADOWS.small;
      case 'md': return SHADOWS.medium;
      case 'lg': return SHADOWS.large;
      case 'xl': return SHADOWS.extra;
      default: return SHADOWS.none;
    }
  };
  
  // Détermine le rayon de bordure
  const getBorderRadius = () => {
    switch (borderRadius) {
      case 'none': return 0;
      case 'sm': return BORDER_RADIUS.sm;
      case 'lg': return BORDER_RADIUS.lg;
      case 'round': return BORDER_RADIUS.round;
      case 'md':
      default: return BORDER_RADIUS.md;
    }
  };
  
  // Détermine la couleur de bordure
  const getBorderColor = () => {
    switch (borderColor) {
      case 'primary': return COLORS.primary;
      case 'secondary': return COLORS.secondary;
      case 'border':
      default: return COLORS.border;
    }
  };
  
  return (
    <View
      style={[
        {
          padding: getPadding(),
          margin: getMargin(),
          backgroundColor: getBackground(),
          borderRadius: getBorderRadius(),
          borderWidth,
          borderColor: getBorderColor(),
          flexDirection,
          justifyContent,
          alignItems,
          flex: flex ? 1 : undefined,
          ...getElevation(),
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

export default Box;