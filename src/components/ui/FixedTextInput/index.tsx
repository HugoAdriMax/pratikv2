import React, { forwardRef } from 'react';
import { TextInput as RNTextInput, TextInputProps, StyleSheet, View } from 'react-native';
import { COLORS } from '../../../utils/theme';

interface FixedTextInputProps extends TextInputProps {
  containerStyle?: any;
}

const FixedTextInput = forwardRef<RNTextInput, FixedTextInputProps>(
  ({ style, containerStyle, ...props }, ref) => {
    // Force certain props that prevent keyboard dismissal issues
    const fixedProps = {
      ...props,
      blurOnSubmit: false, // Prevent dismissal on submit
      autoCapitalize: props.autoCapitalize || 'none',
      spellCheck: false,
      // Use controlled mode more reliably
      defaultValue: undefined,
      value: props.value || '',
    };

    return (
      <View style={[styles.container, containerStyle]}>
        <RNTextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={COLORS.textSecondary}
          underlineColorAndroid="transparent"
          {...fixedProps}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  input: {
    backgroundColor: COLORS.input,
    width: '100%',
    minHeight: 50,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: COLORS.text,
  },
});

export default FixedTextInput;