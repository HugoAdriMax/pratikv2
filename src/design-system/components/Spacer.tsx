import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { SPACING } from '../tokens';

interface SpacerProps extends ViewProps {
  /**
   * Taille de l'espacement
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  
  /**
   * Direction de l'espacement (horizontal ou vertical)
   */
  direction?: 'horizontal' | 'vertical';
  
  /**
   * Si true, prendra tout l'espace disponible (flex: 1)
   */
  flex?: boolean;
}

/**
 * Spacer est un composant utilitaire qui crée un espace vide entre les éléments.
 */
const Spacer: React.FC<SpacerProps> = ({
  size = 'md',
  direction = 'vertical',
  flex = false,
  style,
  ...props
}) => {
  // Détermine la taille en fonction de l'option
  const getSize = () => {
    if (typeof size === 'number') return size;
    
    switch (size) {
      case 'xs': return SPACING.xs;
      case 'sm': return SPACING.sm;
      case 'lg': return SPACING.lg;
      case 'xl': return SPACING.xl;
      case 'md':
      default: return SPACING.md;
    }
  };
  
  return (
    <View
      style={[
        {
          width: direction === 'horizontal' ? getSize() : undefined,
          height: direction === 'vertical' ? getSize() : undefined,
          flex: flex ? 1 : undefined,
        },
        style,
      ]}
      {...props}
    />
  );
};

export default Spacer;