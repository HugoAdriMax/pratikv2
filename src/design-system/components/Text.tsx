import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { COLORS } from '../tokens';

/**
 * Variantes de texte disponibles
 */
export type TextVariant = 
  | 'h1' 
  | 'h2' 
  | 'h3' 
  | 'h4' 
  | 'h5' 
  | 'body1' 
  | 'body2' 
  | 'caption' 
  | 'button' 
  | 'overline';

/**
 * Poids de texte disponibles
 */
export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

/**
 * Couleurs de texte prédéfinies
 */
export type TextColor = 
  | 'primary' 
  | 'secondary' 
  | 'success' 
  | 'danger' 
  | 'warning' 
  | 'info' 
  | 'text' 
  | 'text-secondary' 
  | 'light' 
  | string;

/**
 * Props pour le composant Text
 */
interface CustomTextProps extends TextProps {
  /**
   * Variante de texte qui définit la taille et le style
   * @default 'body1'
   */
  variant?: TextVariant;
  
  /**
   * Poids de la police (équivalent à fontWeight)
   * @default 'regular'
   */
  weight?: TextWeight;
  
  /**
   * Couleur du texte
   * @default 'text'
   */
  color?: TextColor;
  
  /**
   * Alignement du texte
   * @default 'left'
   */
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  
  /**
   * Transformer le texte (majuscules, minuscules, etc.)
   */
  transform?: 'none' | 'capitalize' | 'uppercase' | 'lowercase';
  
  /**
   * Décoration du texte (souligné, barré, etc.)
   */
  decoration?: 'none' | 'underline' | 'line-through';
  
  /**
   * Permet de tronquer le texte s'il est trop long
   */
  numberOfLines?: number;
  
  /**
   * Définit si le texte peut être sélectionné ou non
   */
  selectable?: boolean;
  
  /**
   * Ajuste l'interlettrage
   */
  letterSpacing?: number;
}

/**
 * Composant Text du design system
 * Offre un contrôle fin sur tous les aspects typographiques de l'application
 */
const Text: React.FC<CustomTextProps> = ({
  variant = 'body1',
  weight = 'regular',
  color = 'text',
  align = 'left',
  transform = 'none',
  decoration = 'none',
  style,
  children,
  numberOfLines,
  selectable,
  letterSpacing,
  ...props
}) => {
  // Get the style for the selected variant
  const getVariantStyle = () => {
    switch (variant) {
      case 'h1':
        return styles.h1;
      case 'h2':
        return styles.h2;
      case 'h3':
        return styles.h3;
      case 'h4':
        return styles.h4;
      case 'h5':
        return styles.h5;
      case 'body2':
        return styles.body2;
      case 'caption':
        return styles.caption;
      case 'button':
        return styles.button;
      case 'overline':
        return styles.overline;
      default:
        return styles.body1;
    }
  };

  // Get the style for the selected weight
  const getWeightStyle = () => {
    switch (weight) {
      case 'medium':
        return styles.medium;
      case 'semibold':
        return styles.semibold;
      case 'bold':
        return styles.bold;
      default:
        return styles.regular;
    }
  };

  // Get the color
  const getColorStyle = () => {
    switch (color) {
      case 'primary':
        return { color: COLORS.primary };
      case 'secondary':
        return { color: COLORS.secondary };
      case 'success':
        return { color: COLORS.success };
      case 'danger':
        return { color: COLORS.danger };
      case 'warning':
        return { color: COLORS.warning };
      case 'info':
        return { color: COLORS.info };
      case 'text':
        return { color: COLORS.text };
      case 'text-secondary':
        return { color: COLORS.textSecondary };
      case 'light':
        return { color: COLORS.textLight };
      default:
        // If color is a custom string (e.g. '#FF0000')
        return { color: color };
    }
  };

  return (
    <RNText
      style={[
        getVariantStyle(),
        getWeightStyle(),
        getColorStyle(),
        { 
          textAlign: align,
          textTransform: transform,
          textDecorationLine: decoration,
          letterSpacing
        },
        style,
      ]}
      numberOfLines={numberOfLines}
      selectable={selectable}
      {...props}
    >
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  // Text variants
  h1: {
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.25,
  },
  h3: {
    fontSize: 20,
    lineHeight: 28,
  },
  h4: {
    fontSize: 18,
    lineHeight: 26,
  },
  h5: {
    fontSize: 16,
    lineHeight: 24,
  },
  body1: {
    fontSize: 16,
    lineHeight: 24,
  },
  body2: {
    fontSize: 14,
    lineHeight: 22,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
  },
  button: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.5,
  },
  overline: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Font weights
  regular: {
    fontWeight: '400',
  },
  medium: {
    fontWeight: '500',
  },
  semibold: {
    fontWeight: '600',
  },
  bold: {
    fontWeight: '700',
  },
});

export default Text;