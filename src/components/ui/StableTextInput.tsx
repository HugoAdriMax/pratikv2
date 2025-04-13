import React, { forwardRef, useState } from 'react';
import { TextInput, TextInputProps, StyleSheet, View, Platform, NativeSyntheticEvent, TextInputFocusEventData } from 'react-native';
import { COLORS } from '../../utils/theme';

/**
 * A stable TextInput component that prevents keyboard from dismissing after each character input
 * on problematic devices/OS versions.
 */
const StableTextInput = forwardRef<TextInput, TextInputProps>((props, ref) => {
  const [inputKey, setInputKey] = useState(1);
  
  // Reconstruct props with safe defaults
  const safeProps = {
    ...props,
    blurOnSubmit: false,
    autoCapitalize: props.autoCapitalize || 'none',
    autoCorrect: false,
    spellCheck: false,
    contextMenuHidden: true,
    disableFullscreenUI: true,
    // This is crucial - some keyboard issues are related to auto-completion
    autoCompleteType: 'off' as any, // Type cast for older RN versions
    textContentType: props.textContentType || 'none' as any, // Type cast for older RN versions
  };

  // This focuses handler helps keep focus on some Android devices
  const handleFocus = (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
    if (props.onFocus) {
      props.onFocus(e);
    }
    
    // Perform a "refresh" of the input on focus to help on some Android devices
    if (Platform.OS === 'android') {
      setTimeout(() => {
        setInputKey(prev => prev + 1);
      }, 100);
    }
  };

  return (
    <View style={[styles.container, props.style]}>
      <TextInput
        {...safeProps}
        key={inputKey}
        ref={ref}
        style={[styles.input, safeProps.style]}
        placeholderTextColor={safeProps.placeholderTextColor || COLORS.textSecondary}
        onFocus={handleFocus}
        // Apply a consistent style to help prevent quirks
        underlineColorAndroid="transparent"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  input: {
    flex: 1,
    minHeight: 40,
    fontSize: 16,
    color: COLORS.text,
  },
});

export default StableTextInput;