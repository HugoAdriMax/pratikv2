import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, Button } from '../../components/ui';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';

const FieldEditorScreen = ({ navigation, route }: any) => {
  // Récupérer les paramètres passés à l'écran
  const { fieldName, currentValue, label, onSave } = route.params;
  
  // État pour stocker la valeur éditée
  const [value, setValue] = useState(currentValue || '');
  
  // Déterminer le type de clavier en fonction du champ
  const getKeyboardType = () => {
    switch (fieldName) {
      case 'phone':
        return 'phone-pad';
      case 'business_reg_number':
        return 'number-pad';
      default:
        return 'default';
    }
  };
  
  // Déterminer si le champ doit être multiline
  const isMultiline = fieldName === 'address';
  
  // Fonction pour enregistrer les modifications et retourner à l'écran précédent
  const handleSave = () => {
    // Appeler la fonction onSave passée en paramètre
    if (onSave) {
      onSave(value);
    }
    
    // Retourner à l'écran précédent
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text variant="h4" weight="semibold">Modifier {label}</Text>
      </View>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <View style={styles.inputContainer}>
          <Text variant="body2" style={styles.label}>{label}</Text>
          <TextInput
            style={[
              styles.input,
              isMultiline && styles.multilineInput
            ]}
            value={value}
            onChangeText={setValue}
            placeholder={`Saisir votre ${label.toLowerCase()}`}
            placeholderTextColor={COLORS.textSecondary}
            keyboardType={getKeyboardType()}
            multiline={isMultiline}
            numberOfLines={isMultiline ? 4 : 1}
            autoFocus={true}
            returnKeyType={isMultiline ? 'default' : 'done'}
            blurOnSubmit={!isMultiline}
            autoCapitalize={fieldName === 'name' ? 'words' : 'none'}
          />
        </View>
        
        <View style={styles.buttonContainer}>
          <Button
            variant="outline"
            label="Annuler"
            onPress={() => navigation.goBack()}
            style={styles.button}
          />
          <Button
            variant="primary"
            label="Enregistrer"
            onPress={handleSave}
            style={[styles.button, styles.saveButton]}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
  },
  backButton: {
    marginRight: SPACING.md,
    padding: 4,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  inputContainer: {
    marginTop: SPACING.md,
  },
  label: {
    marginBottom: SPACING.sm,
    color: COLORS.text,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
    height: 50,
  },
  multilineInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xl,
  },
  button: {
    flex: 1,
  },
  saveButton: {
    marginLeft: SPACING.md,
  },
});

export default FieldEditorScreen;