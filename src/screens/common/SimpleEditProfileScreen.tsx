import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  StatusBar,
  ScrollView,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { uploadProfilePicture } from '../../services/api';
import supabase from '../../config/supabase';

// Import des composants du design system
import {
  Box,
  Text,
  Card,
  Button,
  Input,
  Divider,
  Spacer,
  COLORS
} from '../../design-system';

/**
 * Écran d'édition de profil utilisant le design system
 */
const SimpleEditProfileScreen = ({ navigation }: any) => {
  const { user, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [localImageBase64, setLocalImageBase64] = useState<string | null>(null);
  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [businessRegNumber, setBusinessRegNumber] = useState('');

  // Load existing user data
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setAddress(user.address || '');
      setBusinessRegNumber(user.business_reg_number || '');
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    
    try {
      setSaveLoading(true);
      
      // Vérifier les données
      if (name.trim() === '') {
        Alert.alert('Erreur', 'Veuillez entrer un nom.');
        setSaveLoading(false);
        return;
      }
      
      // Créer un nouvel objet avec les données à jour
      const updatedData = {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        business_reg_number: businessRegNumber.trim(),
        updated_at: new Date().toISOString()
      };
      
      console.log('Mise à jour du profil avec:', updatedData);
      
      // Mettre à jour le profil dans Supabase
      const { error } = await supabase
        .from('users')
        .update(updatedData)
        .eq('id', user.id);
      
      if (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
        Alert.alert('Erreur', 'Impossible de mettre à jour votre profil. Veuillez réessayer.');
        return;
      }
      
      // Rafraîchir les données du profil
      await refreshProfile();
      
      Alert.alert(
        'Succès', 
        'Votre profil a été mis à jour avec succès !',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la mise à jour de votre profil.');
    } finally {
      setSaveLoading(false);
    }
  };

  // État de chargement
  if (!user) {
    return (
      <Box flex centerY centerX background="light">
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Spacer size="md" />
        <Text variant="body2" color="text-secondary">
          Chargement...
        </Text>
      </Box>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text variant="h3" weight="semibold">Modifier mon profil</Text>
        </View>
      </View>
      
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Card style={styles.formCard} elevation="sm">
            <View style={styles.formHeader}>
              <Ionicons name="person-circle" size={22} color={COLORS.primary} />
              <Text variant="h5" weight="semibold" style={styles.formTitle}>
                Informations personnelles
              </Text>
            </View>
            
            <Divider color="border" marginVertical="sm" />
            
            <Input
              label="Nom"
              placeholder="Votre nom complet"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              leftIcon={<Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />}
            />
            
            <Spacer size="md" />
            
            <Input
              label="Téléphone"
              placeholder="Votre numéro de téléphone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              leftIcon={<Ionicons name="call-outline" size={20} color={COLORS.textSecondary} />}
            />
            
            <Spacer size="md" />
            
            <View style={{ marginBottom: 16 }}>
              <Text variant="body1" weight="medium" style={{ marginBottom: 4, color: COLORS.text }}>
                Adresse
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: 12,
                  backgroundColor: COLORS.white,
                  minHeight: 100,
                }}
              >
                <View style={{ 
                  paddingLeft: 12, 
                  paddingTop: 14,
                  alignItems: 'center'
                }}>
                  <Ionicons name="location-outline" size={20} color={COLORS.textSecondary} />
                </View>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Input
                    placeholder="Votre adresse complète"
                    value={address}
                    onChangeText={setAddress}
                    multiline={true}
                    numberOfLines={3}
                    style={{ 
                      textAlignVertical: 'top',
                      paddingTop: 12,
                      borderWidth: 0,
                      height: 100
                    }}
                    containerStyle={{
                      borderWidth: 0,
                      paddingHorizontal: 0,
                      paddingVertical: 0,
                      marginBottom: 0
                    }}
                    inputContainerStyle={{
                      borderWidth: 0,
                      backgroundColor: 'transparent'
                    }}
                  />
                </View>
              </View>
            </View>
            
            {user.role === 'prestataire' && (
              <>
                <Spacer size="md" />
                
                <Input
                  label="Numéro SIRET/SIREN"
                  placeholder="Votre numéro d'entreprise"
                  value={businessRegNumber}
                  onChangeText={setBusinessRegNumber}
                  keyboardType="numeric"
                  leftIcon={<Ionicons name="business-outline" size={20} color={COLORS.textSecondary} />}
                />
              </>
            )}
          </Card>

          <View style={styles.buttonContainer}>
            <Button
              variant="outline"
              label="Annuler"
              onPress={() => navigation.goBack()}
              style={styles.cancelButton}
            />
            <Button
              variant="primary"
              label={saveLoading ? "Enregistrement..." : "Enregistrer"}
              onPress={handleSaveProfile}
              loading={saveLoading}
              style={styles.saveButton}
            />
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
      
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 50,
  },
  header: {
    padding: 16, // SPACING.md
    backgroundColor: COLORS.white,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 8, // SPACING.sm
    padding: 4,
  },
  formCard: {
    marginHorizontal: 16, // SPACING.md
    marginTop: 16, // SPACING.md
    padding: 20, // SPACING.lg (approximation)
    marginBottom: 24, // SPACING.lg
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16, // SPACING.md
  },
  formTitle: {
    marginLeft: 8, // SPACING.sm
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16, // SPACING.md
    marginTop: 16, // SPACING.md
    marginBottom: 24, // SPACING.lg
  },
  saveButton: {
    flex: 1,
    marginLeft: 8, // SPACING.sm
  },
  cancelButton: {
    flex: 1,
    marginRight: 8, // SPACING.sm
  },
  marginLeft: {
    marginLeft: 16, // SPACING.md
  },
});

export default SimpleEditProfileScreen;