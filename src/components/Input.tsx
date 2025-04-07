import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { COLORS, FONTS, SIZES, SHADOWS } from '../utils/theme';

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  error?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  multiline?: boolean;
  numberOfLines?: number;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  editable?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
}

const Input: React.FC<InputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  error,
  keyboardType = 'default',
  multiline = false,
  numberOfLines = 1,
  icon,
  style,
  inputStyle,
  labelStyle,
  rightIcon,
  onRightIconPress,
  editable = true,
  autoCapitalize = 'none',
  maxLength,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, labelStyle]}>
          {label}
        </Text>
      )}
      
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.focused,
          error && styles.errorInput,
          !editable && styles.disabled,
          SHADOWS.small
        ]}
      >
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        
        <TextInput
          style={[
            styles.input,
            multiline && { height: numberOfLines * 24, textAlignVertical: 'top' },
            inputStyle
          ]}
          placeholder={placeholder}
          placeholderTextColor={COLORS.gray}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onFocus={handleFocus}
          onBlur={handleBlur}
          editable={editable}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
        />
        
        {rightIcon && (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SIZES.padding,
  },
  label: {
    ...FONTS.body2,
    color: COLORS.dark,
    marginBottom: SIZES.base / 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.white,
    paddingHorizontal: SIZES.padding,
  },
  iconContainer: {
    marginRight: SIZES.base,
  },
  input: {
    flex: 1,
    height: 50,
    color: COLORS.dark,
    ...FONTS.body2,
    paddingVertical: SIZES.base,
  },
  rightIconContainer: {
    marginLeft: SIZES.base,
  },
  errorText: {
    ...FONTS.body3,
    color: COLORS.danger,
    marginTop: SIZES.base / 2,
  },
  focused: {
    borderColor: COLORS.primary,
  },
  errorInput: {
    borderColor: COLORS.danger,
  },
  disabled: {
    backgroundColor: COLORS.grayLight,
  },
});

export default Input;