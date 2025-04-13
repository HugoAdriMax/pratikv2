import React from 'react';
import { View, StyleSheet, ViewProps, StyleProp, ViewStyle } from 'react-native';
import { SPACING } from '../tokens';

/**
 * Propriétés pour le composant Row
 */
interface RowProps extends ViewProps {
  /**
   * Espace entre les colonnes
   * @default 'md'
   */
  spacing?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Alignement horizontal des éléments
   * @default 'flex-start'
   */
  justify?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
  
  /**
   * Alignement vertical des éléments
   * @default 'center'
   */
  align?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  
  /**
   * Permet aux éléments de passer à la ligne
   * @default true
   */
  wrap?: boolean;
}

/**
 * Props pour le composant Col
 */
interface ColProps extends ViewProps {
  /**
   * Nombre de colonnes occupées (sur 12)
   * @default 'auto'
   */
  size?: number | 'auto';
  
  /**
   * Style supplémentaire pour la colonne
   */
  colStyle?: StyleProp<ViewStyle>;
}

/**
 * Composant Row
 * 
 * Crée une ligne qui contient des colonnes (Col) avec un espacement uniforme
 */
export const Row: React.FC<RowProps> = ({
  children,
  spacing = 'md',
  justify = 'flex-start',
  align = 'center',
  wrap = true,
  style,
  ...props
}) => {
  // Détermine l'espacement entre les colonnes
  const getSpacing = () => {
    switch (spacing) {
      case 'none': return 0;
      case 'xs': return SPACING.xs;
      case 'sm': return SPACING.sm;
      case 'lg': return SPACING.lg;
      case 'xl': return SPACING.xl;
      case 'md':
      default: return SPACING.md;
    }
  };
  
  // Calculer la marge négative pour compenser l'espacement des colonnes
  const negativeMargin = getSpacing() / 2;
  
  return (
    <View
      style={[
        styles.row,
        {
          justifyContent: justify,
          alignItems: align,
          flexWrap: wrap ? 'wrap' : 'nowrap',
          marginHorizontal: -negativeMargin,
        },
        style,
      ]}
      {...props}
    >
      {/* Ajouter l'espacement aux enfants */}
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        
        return React.cloneElement(child, {
          style: [
            child.props.style,
            { marginHorizontal: negativeMargin },
          ],
        });
      })}
    </View>
  );
};

/**
 * Composant Col
 * 
 * Représente une colonne dans une grille
 */
export const Col: React.FC<ColProps> = ({
  children,
  size = 'auto',
  colStyle,
  style,
  ...props
}) => {
  // Calcule le pourcentage de largeur en fonction de la taille
  const getWidth = () => {
    if (size === 'auto') return 'auto';
    const percentage = (size / 12) * 100;
    return `${percentage}%`;
  };
  
  return (
    <View
      style={[
        styles.col,
        {
          width: getWidth(),
          flex: size === 'auto' ? 1 : undefined,
        },
        colStyle,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  col: {
    // Styles par défaut pour la colonne
  },
});

/**
 * Composant Grid combiné
 * 
 * Un wrapper pour utiliser Row et Col ensemble
 */
const Grid = {
  Row,
  Col,
};

export default Grid;