import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../tokens';

/**
 * Niveaux d'élévation disponibles pour la carte
 */
type CardElevation = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Props du composant Card
 */
interface CardProps extends ViewProps {
  /**
   * Niveau d'élévation (ombre) de la carte
   * @default 'sm'
   */
  elevation?: CardElevation;
  
  /**
   * Padding intérieur de la carte
   * @default 'none'
   */
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Marge extérieure de la carte
   * @default 'none'
   */
  margin?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Rayon des coins de la carte
   * @default 'md'
   */
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'round';
  
  /**
   * Couleur d'arrière-plan de la carte
   * @default 'white'
   */
  background?: 'white' | 'light' | 'dark' | 'primary' | 'transparent' | string;
  
  /**
   * Largeur de la bordure
   * @default 0
   */
  borderWidth?: number;
  
  /**
   * Couleur de la bordure
   * @default 'border'
   */
  borderColor?: 'primary' | 'secondary' | 'border' | string;
  
  /**
   * Si true, la carte prendra toute la hauteur disponible
   * @default false
   */
  fullHeight?: boolean;
  
  /**
   * Si true, la carte prendra toute la largeur disponible
   * @default false
   */
  fullWidth?: boolean;
  
  /**
   * Fonction appelée lorsque la carte est pressée (rend la carte pressable)
   */
  onPress?: () => void;
}

/**
 * Composant Card du design system
 * 
 * La Card est un conteneur basique avec élévation qui structure visuellement
 * le contenu et regroupe des éléments liés.
 */
const Card: React.FC<CardProps> = ({
  children,
  elevation = 'sm',
  padding = 'none',
  margin = 'none',
  borderRadius = 'md',
  background = 'white',
  borderWidth = 0,
  borderColor = 'border',
  fullHeight = false,
  fullWidth = false,
  style,
  ...props
}) => {
  // Détermine l'élévation en fonction de l'option
  const getElevation = () => {
    switch (elevation) {
      case 'none': return SHADOWS.none;
      case 'xs': return SHADOWS.small;
      case 'sm': return SHADOWS.small;
      case 'md': return SHADOWS.medium;
      case 'lg': return SHADOWS.large;
      case 'xl': return SHADOWS.extra;
      default: return SHADOWS.small;
    }
  };
  
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
  
  // Détermine le rayon de bordure en fonction de l'option
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
  
  // Détermine la couleur d'arrière-plan en fonction de l'option
  const getBackground = () => {
    switch (background) {
      case 'light': return COLORS.background;
      case 'dark': return COLORS.backgroundDark;
      case 'primary': return COLORS.primary;
      case 'transparent': return 'transparent';
      case 'white':
      default: return COLORS.white;
    }
  };
  
  // Détermine la couleur de bordure en fonction de l'option
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
          backgroundColor: getBackground(),
          borderRadius: getBorderRadius(),
          padding: getPadding(),
          margin: getMargin(),
          borderWidth,
          borderColor: getBorderColor(),
          height: fullHeight ? '100%' : undefined,
          width: fullWidth ? '100%' : undefined,
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

export default Card;