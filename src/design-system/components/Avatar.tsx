import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity, ImageSourcePropType, ActivityIndicator } from 'react-native';
import { COLORS, SPACING } from '../tokens';
import Text from './Text';

/**
 * Tailles disponibles pour l'avatar
 */
type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

/**
 * Formes disponibles pour l'avatar
 */
type AvatarShape = 'circle' | 'square' | 'rounded';

/**
 * Props du composant Avatar
 */
interface AvatarProps {
  /**
   * Taille de l'avatar
   * @default 'md'
   */
  size?: AvatarSize;
  
  /**
   * Forme de l'avatar
   * @default 'circle'
   */
  shape?: AvatarShape;
  
  /**
   * Source de l'image
   */
  source?: ImageSourcePropType;
  
  /**
   * Initiales à afficher lorsqu'il n'y a pas d'image
   */
  initials?: string;
  
  /**
   * Couleur d'arrière-plan lorsqu'il n'y a pas d'image
   * @default 'primary'
   */
  backgroundColor?: string;
  
  /**
   * Couleur du texte des initiales
   * @default 'white'
   */
  textColor?: string;
  
  /**
   * Fonction appelée lorsque l'avatar est pressé
   */
  onPress?: () => void;
  
  /**
   * Indique si l'avatar est en cours de chargement
   * @default false
   */
  loading?: boolean;
  
  /**
   * Bordure autour de l'avatar
   * @default false
   */
  bordered?: boolean;
  
  /**
   * Couleur de la bordure
   * @default 'white'
   */
  borderColor?: string;
  
  /**
   * Épaisseur de la bordure
   * @default 2
   */
  borderWidth?: number;
  
  /**
   * Styles supplémentaires pour le conteneur
   */
  style?: any;
}

/**
 * Composant Avatar du design system
 * 
 * Affiche une image ou des initiales dans un cercle ou un carré.
 */
const Avatar: React.FC<AvatarProps> = ({
  size = 'md',
  shape = 'circle',
  source,
  initials,
  backgroundColor = COLORS.primary,
  textColor = COLORS.white,
  onPress,
  loading = false,
  bordered = false,
  borderColor = COLORS.white,
  borderWidth = 2,
  style,
}) => {
  // Convertir la taille nommée en valeur numérique
  const getSizeValue = () => {
    if (typeof size === 'number') return size;
    
    switch(size) {
      case 'xs': return 24;
      case 'sm': return 32;
      case 'lg': return 56;
      case 'xl': return 72;
      case 'md':
      default: return 40;
    }
  };
  
  // Obtenir la taille de la police en fonction de la taille de l'avatar
  const getFontSize = () => {
    const avatarSize = getSizeValue();
    return avatarSize * 0.4;
  };
  
  // Obtenir le rayon de bordure en fonction de la forme
  const getBorderRadius = () => {
    const avatarSize = getSizeValue();
    
    switch(shape) {
      case 'square': return 0;
      case 'rounded': return avatarSize * 0.2;
      case 'circle':
      default: return avatarSize / 2;
    }
  };
  
  // Préparer les styles de l'avatar
  const avatarContainerStyle = {
    width: getSizeValue(),
    height: getSizeValue(),
    borderRadius: getBorderRadius(),
    backgroundColor: source ? undefined : backgroundColor,
    borderWidth: bordered ? borderWidth : 0,
    borderColor,
  };
  
  // Contenu de l'avatar
  const renderAvatarContent = () => {
    if (loading) {
      return (
        <ActivityIndicator 
          size={getSizeValue() > 40 ? 'large' : 'small'} 
          color={source ? COLORS.primary : textColor} 
        />
      );
    }
    
    if (source) {
      return (
        <Image
          source={source}
          style={[
            styles.image,
            { borderRadius: getBorderRadius() },
          ]}
        />
      );
    }
    
    if (initials) {
      return (
        <Text
          style={[
            styles.initials,
            { fontSize: getFontSize(), color: textColor },
          ]}
        >
          {initials.slice(0, 2)}
        </Text>
      );
    }
    
    // Fallback au cas où ni source ni initials ne sont fournis
    return (
      <Text
        style={[
          styles.initials,
          { fontSize: getFontSize(), color: textColor },
        ]}
      >
        ?
      </Text>
    );
  };
  
  // Rendre l'avatar avec ou sans onPress
  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.container, avatarContainerStyle, style]}
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.7}
      >
        {renderAvatarContent()}
      </TouchableOpacity>
    );
  }
  
  return (
    <View style={[styles.container, avatarContainerStyle, style]}>
      {renderAvatarContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  initials: {
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});

export default Avatar;