import React, { useState } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  success?: boolean;
  helper?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: any;
  inputContainerStyle?: any;
  rounded?: boolean;
  rightElement?: React.ReactNode;
  onRightElementPress?: () => void;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  success,
  helper,
  leftIcon,
  rightIcon,
  containerStyle,
  inputContainerStyle,
  style,
  rounded = false,
  rightElement,
  onRightElementPress,
  secureTextEntry,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);

  // Determine container border color
  const getBorderColor = () => {
    if (error) return COLORS.danger;
    if (success) return COLORS.success;
    if (isFocused) return COLORS.primary;
    return COLORS.border;
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View
        style={[
          styles.inputContainer,
          rounded ? styles.roundedInput : styles.regularInput,
          { borderColor: getBorderColor() },
          isFocused && styles.focused,
          error && styles.errorInput,
          success && styles.successInput,
          inputContainerStyle,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        
        <TextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            (rightIcon || secureTextEntry || rightElement) && styles.inputWithRightIcon,
            style,
          ]}
          placeholderTextColor={COLORS.textSecondary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          {...props}
        />
        
        {secureTextEntry && (
          <TouchableOpacity 
            style={styles.rightIcon} 
            onPress={togglePasswordVisibility}
          >
            <Ionicons 
              name={isPasswordVisible ? "eye-off" : "eye"} 
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
        <Text style={[styles.helperText, error && styles.errorText]}>
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
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    color: COLORS.text,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    backgroundColor: COLORS.input,
  },
  regularInput: {
    borderRadius: BORDER_RADIUS.md,
  },
  roundedInput: {
    borderRadius: BORDER_RADIUS.round,
  },
  focused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  errorInput: {
    borderColor: COLORS.danger,
  },
  successInput: {
    borderColor: COLORS.success,
  },
  input: {
    flex: 1,
    minHeight: 50,
    fontSize: 16,
    color: COLORS.text,
    paddingHorizontal: SPACING.md,
  },
  inputWithLeftIcon: {
    paddingLeft: 6,
  },
  inputWithRightIcon: {
    paddingRight: 6,
  },
  leftIcon: {
    paddingLeft: SPACING.md,
  },
  rightIcon: {
    paddingRight: SPACING.md,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    color: COLORS.textSecondary,
  },
  errorText: {
    color: COLORS.danger,
  },
});

export default Input;