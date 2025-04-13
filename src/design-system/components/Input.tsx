import React, { useState } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../tokens';
import Text from './Text';
import { Ionicons } from '@expo/vector-icons';

/**
 * États de validation de l'input
 */
type InputState = 'default' | 'success' | 'error';

/**
 * Variantes visuelles de l'input
 */
type InputVariant = 'filled' | 'outlined' | 'underlined' | 'unstyled';

/**
 * Tailles disponibles pour l'input
 */
type InputSize = 'sm' | 'md' | 'lg';

/**
 * Props du composant Input
 */
interface InputProps extends TextInputProps {
  /**
   * Label affiché au-dessus de l'input
   */
  label?: string;
  
  /**
   * Message d'erreur affiché sous l'input
   */
  error?: string;
  
  /**
   * Message d'aide affiché sous l'input
   */
  helper?: string;
  
  /**
   * État de validation de l'input
   * @default 'default'
   */
  state?: InputState;
  
  /**
   * Variante visuelle de l'input
   * @default 'filled'
   */
  variant?: InputVariant;
  
  /**
   * Taille de l'input
   * @default 'md'
   */
  size?: InputSize;
  
  /**
   * Icône affichée à gauche de l'input
   */
  leftIcon?: React.ReactNode;
  
  /**
   * Icône affichée à droite de l'input
   */
  rightIcon?: React.ReactNode;
  
  /**
   * Élément affiché à droite de l'input (bouton, etc.)
   */
  rightElement?: React.ReactNode;
  
  /**
   * Fonction appelée lorsque l'élément à droite est pressé
   */
  onRightElementPress?: () => void;
  
  /**
   * Style du conteneur principal
   */
  containerStyle?: any;
  
  /**
   * Style du conteneur de l'input
   */
  inputContainerStyle?: any;
  
  /**
   * Si true, l'input aura des coins arrondis
   * @default false
   */
  rounded?: boolean;
  
  /**
   * Si true, l'input prendra toute la largeur disponible
   * @default true
   */
  fullWidth?: boolean;
  
  /**
   * Si true, désactive l'auto-correction
   * @default true
   */
  disableAutoCorrect?: boolean;
}

/**
 * Composant Input du design system
 * 
 * Input est un composant contrôlé qui permet aux utilisateurs de saisir du texte.
 * Il prend en charge différentes variantes, états, et options de personnalisation.
 */
const Input: React.FC<InputProps> = ({
  label,
  error,
  helper,
  state = 'default',
  variant = 'filled',
  size = 'md',
  leftIcon,
  rightIcon,
  rightElement,
  onRightElementPress,
  containerStyle,
  inputContainerStyle,
  style,
  rounded = false,
  fullWidth = true,
  disableAutoCorrect = true,
  secureTextEntry,
  placeholder,
  value,
  onChangeText,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);

  // Déterminer l'état visuel (normal, succès, erreur)
  const getInputState = () => {
    if (error) return 'error';
    if (state === 'success') return 'success';
    return 'default';
  };

  // Obtenir la couleur de bordure en fonction de l'état
  const getBorderColor = () => {
    const currentState = getInputState();
    
    if (currentState === 'error') return COLORS.danger;
    if (currentState === 'success') return COLORS.success;
    if (isFocused) return COLORS.primary;
    return COLORS.border;
  };

  // Obtenir le style en fonction de la variante
  const getVariantStyle = () => {
    switch (variant) {
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: getBorderColor(),
        };
      case 'underlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderBottomWidth: 1.5,
          borderColor: getBorderColor(),
          borderRadius: 0,
        };
      case 'unstyled':
        return {
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
        };
      case 'filled':
      default:
        return {
          backgroundColor: isFocused ? COLORS.white : COLORS.input,
          borderWidth: 1.5,
          borderColor: getBorderColor(),
        };
    }
  };

  // Obtenir le style en fonction de la taille
  const getSizeStyle = () => {
    switch (size) {
      case 'sm':
        return {
          minHeight: 36,
          paddingHorizontal: SPACING.sm,
        };
      case 'lg':
        return {
          minHeight: 56,
          paddingHorizontal: SPACING.lg,
        };
      case 'md':
      default:
        return {
          minHeight: 48,
          paddingHorizontal: SPACING.md,
        };
    }
  };

  // Basculer la visibilité du mot de passe
  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <View style={[styles.container, fullWidth && styles.fullWidth, containerStyle]}>
      {label && (
        <Text 
          variant="body2" 
          weight="medium" 
          style={styles.label}
        >
          {label}
        </Text>
      )}
      
      <View
        style={[
          styles.inputContainer,
          rounded ? styles.roundedInput : styles.regularInput,
          getVariantStyle(),
          getSizeStyle(),
          inputContainerStyle,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        
        <TextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            (rightIcon || secureTextEntry || rightElement) && styles.inputWithRightIcon,
            size === 'sm' ? { fontSize: 14 } : size === 'lg' ? { fontSize: 18 } : { fontSize: 16 },
            style,
          ]}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={COLORS.textSecondary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          autoCapitalize={disableAutoCorrect ? 'none' : undefined}
          autoCorrect={!disableAutoCorrect}
          {...props}
        />
        
        {secureTextEntry && (
          <TouchableOpacity 
            style={styles.rightIcon} 
            onPress={togglePasswordVisibility}
          >
            <Ionicons 
              name={isPasswordVisible ? "eye-off-outline" : "eye-outline"} 
              size={22} 
              color={COLORS.textSecondary} 
            />
          </TouchableOpacity>
        )}
        
        {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
        
        {rightElement && (
          <TouchableOpacity 
            style={styles.rightIcon}
            onPress={onRightElementPress}
          >
            {rightElement}
          </TouchableOpacity>
        )}
      </View>
      
      {(error || helper) && (
        <Text 
          variant="caption" 
          color={error ? 'danger' : 'text-secondary'}
          style={styles.helperText}
        >
          {error || helper}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  fullWidth: {
    width: '100%',
  },
  label: {
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  regularInput: {
    borderRadius: BORDER_RADIUS.md,
  },
  roundedInput: {
    borderRadius: BORDER_RADIUS.round,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    paddingVertical: 0, // Important pour iOS
    minHeight: Platform.OS === 'ios' ? 20 : undefined, // Fix pour iOS
  },
  inputWithLeftIcon: {
    paddingLeft: 6,
  },
  inputWithRightIcon: {
    paddingRight: 6,
  },
  leftIcon: {
    paddingLeft: SPACING.sm,
    marginRight: 6,
  },
  rightIcon: {
    paddingRight: SPACING.sm,
    marginLeft: 6,
  },
  helperText: {
    marginTop: 4,
  },
});

export default Input;