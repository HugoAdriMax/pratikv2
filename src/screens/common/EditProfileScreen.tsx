import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  StatusBar,
  ScrollView,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { Text, Card, Button } from '../../components/ui';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { uploadProfilePicture } from '../../services/api';
import supabase from '../../config/supabase';

const EditProfileScreen = ({ navigation }: any) => {
  const { user, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [localImageBase64, setLocalImageBase64] = useState<string | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [businessRegNumber, setBusinessRegNumber] = useState('');
  const [tempAddress, setTempAddress] = useState('');

  // Load existing user data
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setAddress(user.address || '');
      setBusinessRegNumber(user.business_reg_number || '');
    }
  }, [user]);
  
  const handleNameChange = (text: string) => {
    setName(text);
  };
  
  const handlePhoneChange = (text: string) => {
    setPhone(text);
  };
  
  const handleBusinessRegChange = (text: string) => {
    setBusinessRegNumber(text);
  };
  
  const handleAddressChange = (text: string) => {
    setTempAddress(text);
  };

  // Fonction pour gérer la sélection d'image de profil
  const handleProfilePictureSelection = async () => {
    Alert.alert(
      'Photo de profil',
      'Ajouter une photo de profil ?',
      [
        {
          text: 'Annuler',
          style: 'cancel'
        },
        {
          text: 'Prendre une photo',
          onPress: () => takePhotoFromCamera()
        },
        {
          text: 'Choisir une photo',
          onPress: () => pickImageFromGallery()
        }
      ]
    );
  };
  
  // Prendre une photo avec la caméra
  const takePhotoFromCamera = async () => {
    try {
      // Demander les permissions de caméra
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'L\'application a besoin d\'accéder à votre caméra pour prendre une photo.');
        return;
      }
      
      // Lancer la caméra
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await processAndUploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erreur lors de la prise de photo:', error);
      Alert.alert('Erreur', 'Impossible de prendre une photo. Veuillez réessayer.');
    }
  };
  
  // Sélectionner une image depuis la galerie
  const pickImageFromGallery = async () => {
    try {
      // Demander les permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'L\'application a besoin d\'accéder à votre galerie pour sélectionner une image.');
        return;
      }
      
      // Lancer le sélecteur d'images
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await processAndUploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erreur lors de la sélection d\'image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner une image. Veuillez réessayer.');
    }
  };
  
  // Traiter et uploader l'image
  const processAndUploadImage = async (uri: string) => {
    if (!user) return;
    
    try {
      setImageLoading(true);
      
      // Redimensionner et compresser l'image
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      // Uploader vers Supabase
      console.log("Uploading processed image:", manipResult.uri);
      const result = await uploadProfilePicture(user.id, manipResult.uri);
      
      if (result) {
        console.log("Image uploaded successfully:", result);
        
        // Stocker l'image en base64 localement
        setLocalImageBase64(result.base64Image);
        
        Alert.alert('Succès', 'Votre photo de profil a été mise à jour avec succès !');
      } else {
        Alert.alert('Erreur', 'Impossible d\'uploader l\'image. Veuillez réessayer.');
      }
    } catch (error) {
      console.error('Erreur lors du traitement et de l\'upload de l\'image:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la mise à jour de votre photo de profil.');
    } finally {
      setImageLoading(false);
    }
  };
  
  
  // Fonction principale de sauvegarde
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

  const confirmAddressChange = () => {
    setAddress(tempAddress);
    setShowAddressModal(false);
  };

  if (!user) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text variant="body2" color="text-secondary" style={styles.marginTop}>
          Chargement...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text variant="h3" weight="semibold">Modifier mon profil</Text>
        </View>
      </View>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Formulaire */}
          <Card style={styles.formCard} elevation="sm">
            <View style={styles.formHeader}>
              <Ionicons name="person-circle" size={22} color={COLORS.primary} />
              <Text variant="h5" weight="semibold" style={styles.formTitle}>
                Informations personnelles
              </Text>
            </View>
            
            <View style={styles.formGroup}>
              <Text variant="body2" weight="medium" style={styles.label}>Nom</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Votre nom complet"
                  value={name}
                  onChangeText={handleNameChange}
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="words"
                  keyboardType="default"
                />
              </View>
            </View>
            
            <View style={styles.formGroup}>
              <Text variant="body2" weight="medium" style={styles.label}>Téléphone</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Votre numéro de téléphone"
                  value={phone}
                  onChangeText={handlePhoneChange}
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
            
            <View style={styles.formGroup}>
              <Text variant="body2" weight="medium" style={styles.label}>Adresse</Text>
              <TouchableOpacity
                style={styles.addressInputContainer}
                onPress={() => {
                  setTempAddress(address);
                  setShowAddressModal(true);
                }}
              >
                <Ionicons name="location-outline" size={20} color={COLORS.textSecondary} style={styles.addressIcon} />
                <Text 
                  style={[
                    styles.addressText, 
                    !address.trim() && styles.addressPlaceholder
                  ]}
                  numberOfLines={2}
                >
                  {address.trim() || "Votre adresse complète"}
                </Text>
                <Ionicons name="create-outline" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            
            {user.role === 'prestataire' && (
              <View style={styles.formGroup}>
                <Text variant="body2" weight="medium" style={styles.label}>Numéro SIRET/SIREN</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="business-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Votre numéro d'entreprise"
                    value={businessRegNumber}
                    onChangeText={handleBusinessRegChange}
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
            )}
          </Card>

          {/* Boutons d'action */}
          <View style={styles.buttonContainer}>
            <View style={styles.buttonRow}>
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Modal pour l'adresse */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAddressModal}
        onRequestClose={() => setShowAddressModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="h5" weight="semibold" style={styles.modalTitle}>
                Modifier l'adresse
              </Text>
              <TouchableOpacity 
                onPress={() => setShowAddressModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalDivider} />
            
            <TextInput
              style={styles.addressInput}
              placeholder="Entrez votre adresse complète"
              value={tempAddress}
              onChangeText={handleAddressChange}
              multiline={true}
              autoFocus={true}
              placeholderTextColor={COLORS.textSecondary}
            />
            
            <View style={styles.modalActions}>
              <Button
                variant="outline"
                label="Annuler"
                onPress={() => setShowAddressModal(false)}
                style={styles.modalButton}
              />
              <Button
                variant="primary"
                label="Confirmer"
                onPress={confirmAddressChange}
                style={[styles.modalButton, styles.marginLeft]}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 50,
  },
  header: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: SPACING.sm,
    padding: 4,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.medium,
    marginBottom: SPACING.lg,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  formTitle: {
    marginLeft: SPACING.sm,
  },
  formGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    marginBottom: SPACING.sm,
    color: COLORS.text,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.white,
    height: 50,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: COLORS.text,
  },
  addressInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
  },
  addressIcon: {
    marginRight: SPACING.sm,
  },
  addressText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
  },
  addressPlaceholder: {
    color: COLORS.textSecondary,
  },
  buttonContainer: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  saveButton: {
    flex: 1,
    marginLeft: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    height: 50,
  },
  cancelButton: {
    flex: 1,
    marginRight: SPACING.sm,
    borderColor: COLORS.primary,
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.md,
    height: 50,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: SPACING.md,
  },
  modalContent: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.medium,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.round,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    flex: 1,
  },
  modalDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  addressInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
  },
  modalButton: {
    flex: 1,
  },
  marginTop: {
    marginTop: SPACING.md,
  },
  marginLeft: {
    marginLeft: SPACING.md,
  },
});

export default EditProfileScreen;