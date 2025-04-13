import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { COLORS, SPACING } from '../tokens';

interface DividerProps extends ViewProps {
  /**
   * Orientation du divider
   */
  orientation?: 'horizontal' | 'vertical';
  
  /**
   * Épaisseur du divider
   */
  thickness?: number;
  
  /**
   * Couleur du divider
   */
  color?: 'primary' | 'secondary' | 'light' | 'border' | string;
  
  /**
   * Marge autour du divider
   */
  spacing?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  
  /**
   * Longueur du divider (en pourcentage pour horizontal, en hauteur pour vertical)
   */
  length?: number | string;
}

/**
 * Divider est un composant qui crée une ligne de séparation horizontale ou verticale.
 */
const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  thickness = 1,
  color = 'border',
  spacing = 'sm',
  length,
  style,
  ...props
}) => {
  // Obtient la couleur en fonction de l'option
  const getColor = () => {
    switch (color) {
      case 'primary': return COLORS.primary;
      case 'secondary': return COLORS.secondary;
      case 'light': return COLORS.backgroundLight;
      case 'border':
      default: return COLORS.border;
    }
  };
  
  // Obtient l'espacement en fonction de l'option
  const getSpacing = () => {
    switch (spacing) {
      case 'none': return 0;
      case 'xs': return SPACING.xs;
      case 'sm': return SPACING.sm;
      case 'lg': return SPACING.lg;
      case 'md':
      default: return SPACING.md;
    }
  };
  
  // Style pour l'orientation horizontale
  const horizontalStyle = {
    height: thickness,
    width: length || '100%',
    backgroundColor: getColor(),
    marginVertical: getSpacing(),
  };
  
  // Style pour l'orientation verticale
  const verticalStyle = {
    width: thickness,
    height: length || '100%',
    backgroundColor: getColor(),
    marginHorizontal: getSpacing(),
  };
  
  return (
    <View
      style={[
        orientation === 'horizontal' ? horizontalStyle : verticalStyle,
        style,
      ]}
      {...props}
    />
  );
};

export default Divider;