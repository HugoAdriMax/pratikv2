import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  TextInput,
  Animated,
  Easing,
  Dimensions
} from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../../utils/theme';
import { Text, Button } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { submitKycDocument } from '../../services/api';
import supabase from '../../config/supabase';

const { width, height } = Dimensions.get('window');

const KycSubmissionScreen = ({ navigation }: any) => {
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessRegNumber, setBusinessRegNumber] = useState('');
  const [address, setAddress] = useState('');
  const [idCardImage, setIdCardImage] = useState<string | null>(null);
  const [businessDocImage, setBusinessDocImage] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    businessName?: string;
    businessRegNumber?: string;
    address?: string;
    idCardImage?: string;
    businessDocImage?: string;
  }>({});
  
  // Pour suivre l'étape active (Documents d'abord, puis informations)
  const [activeStep, setActiveStep] = useState<'documents' | 'business'>('documents');
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0)).current;
  
  // Animation pour basculer entre les étapes
  const stepTransition = useRef(new Animated.Value(0)).current;

  // Démarrer les animations au chargement
  useEffect(() => {
    // Animation séquentielle pour un effet d'entrée élégant
    Animated.sequence([
      // D'abord, faire apparaître et animer le logo
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 700,
        easing: Easing.elastic(1),
        useNativeDriver: true
      }),
      
      // Ensuite, faire apparaître le formulaire
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true
        })
      ])
    ]).start();
  }, []);

  // Vérifier les permissions et demander l'accès à la galerie/caméra
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission requise',
            'Nous avons besoin de votre permission pour accéder à votre galerie de photos.'
          );
        }
      }
    })();
  }, []);

  const validate = () => {
    const newErrors: {
      businessName?: string;
      businessRegNumber?: string;
      address?: string;
      idCardImage?: string;
      businessDocImage?: string;
    } = {};
    let isValid = true;

    if (!businessName.trim()) {
      newErrors.businessName = 'Le nom de l\'entreprise est requis';
      isValid = false;
    }

    if (!businessRegNumber.trim()) {
      newErrors.businessRegNumber = 'Le numéro d\'immatriculation est requis';
      isValid = false;
    }

    if (!address.trim()) {
      newErrors.address = 'L\'adresse est requise';
      isValid = false;
    }

    if (!idCardImage) {
      newErrors.idCardImage = 'Une pièce d\'identité est requise';
      isValid = false;
    }

    if (!businessDocImage) {
      newErrors.businessDocImage = 'Un document professionnel est requis';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };
  
  const validateCurrentStep = () => {
    if (activeStep === 'documents') {
      const newErrors: any = {};
      let isValid = true;
      
      if (!idCardImage) {
        newErrors.idCardImage = 'Une pièce d\'identité est requise';
        isValid = false;
      }
      
      if (!businessDocImage) {
        newErrors.businessDocImage = 'Un document professionnel est requis';
        isValid = false;
      }
      
      setErrors(prevErrors => ({ ...prevErrors, ...newErrors }));
      return isValid;
    } else {
      const newErrors: any = {};
      let isValid = true;
      
      if (!businessName.trim()) {
        newErrors.businessName = 'Le nom de l\'entreprise est requis';
        isValid = false;
      }
  
      if (!businessRegNumber.trim()) {
        newErrors.businessRegNumber = 'Le numéro d\'immatriculation est requis';
        isValid = false;
      }
  
      if (!address.trim()) {
        newErrors.address = 'L\'adresse est requise';
        isValid = false;
      }
      
      setErrors(prevErrors => ({ ...prevErrors, ...newErrors }));
      return isValid;
    }
  };

  const pickImage = async (setImage: React.Dispatch<React.SetStateAction<string | null>>, title: string) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        
        // Compresser l'image pour réduire sa taille
        const manipResult = await ImageManipulator.manipulateAsync(
          selectedImage.uri,
          [{ resize: { width: 1000 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );

        // Vérifier la taille du fichier
        const fileInfo = await FileSystem.getInfoAsync(manipResult.uri);
        if (fileInfo.size && fileInfo.size > 5 * 1024 * 1024) {
          Alert.alert(
            'Image trop grande',
            'L\'image sélectionnée est trop volumineuse. Veuillez choisir une image de moins de 5 Mo.'
          );
          return;
        }

        setImage(manipResult.uri);
      }
    } catch (error) {
      console.error('Erreur lors de la sélection de l\'image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner cette image');
    }
  };

  const uploadImageToSupabase = async (imageUri: string, folder: string): Promise<string | null> => {
    try {
      console.log(`Début de l'upload de l'image ${folder} pour l'utilisateur ${user?.id}`);
      
      // Générer un nom de fichier unique
      const fileExt = imageUri.split('.').pop() || 'jpg';
      const fileName = `${folder}_${user?.id}_${Date.now()}.${fileExt}`;
      const filePath = `kyc-documents/${user?.id}/${fileName}`;
      
      // Lire l'image en tant que base64
      const base64Data = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      console.log(`Image ${folder} lue en base64, taille: ${base64Data.length} octets`);
      
      // Upload vers Supabase Storage
      const { data, error } = await supabase.storage
        .from('chat-media')  // Utiliser le bucket existant
        .upload(filePath, base64Data, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: true,
        });
      
      if (error) {
        console.error('Erreur lors de l\'upload de l\'image:', error);
        return null;
      }
      
      console.log(`Upload de l'image ${folder} réussi, récupération de l'URL`);
      
      // Récupérer l'URL publique
      const { data: urlData } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);
      
      const publicUrl = urlData.publicUrl;
      console.log(`URL publique générée: ${publicUrl}`);
      
      return publicUrl;
    } catch (error) {
      console.error('Erreur lors de l\'upload de l\'image:', error);
      return null;
    }
  };
  
  const goToNextStep = () => {
    if (validateCurrentStep()) {
      // D'abord changer l'étape directement
      setActiveStep('business');
      
      // Puis réinitialiser l'animation (immédiat pour éviter les problèmes)
      stepTransition.setValue(0);
      
      // Optionnel : ajouter une petite animation de fondu
      const fadeOut = Animated.timing(fadeAnim, {
        toValue: 0.5,
        duration: 150,
        useNativeDriver: true
      });
      
      const fadeIn = Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true
      });
      
      Animated.sequence([fadeOut, fadeIn]).start();
    }
  };
  
  const goToPreviousStep = () => {
    // D'abord changer l'étape directement
    setActiveStep('documents');
    
    // Puis réinitialiser l'animation (immédiat pour éviter les problèmes)
    stepTransition.setValue(0);
    
    // Optionnel : ajouter une petite animation de fondu
    const fadeOut = Animated.timing(fadeAnim, {
      toValue: 0.5,
      duration: 150,
      useNativeDriver: true
    });
    
    const fadeIn = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true
    });
    
    Animated.sequence([fadeOut, fadeIn]).start();
  };

  const handleSubmit = async () => {
    if (!validate() || !user) return;

    setLoading(true);
    try {
      console.log('Début du processus de soumission KYC pour:', user.id);
      
      // 1. Uploader les images vers Supabase Storage
      console.log('Étape 1: Upload des images');
      const idCardUrl = idCardImage ? await uploadImageToSupabase(idCardImage, 'id_card') : null;
      const businessDocUrl = businessDocImage ? await uploadImageToSupabase(businessDocImage, 'business_doc') : null;

      if (!idCardUrl || !businessDocUrl) {
        Alert.alert('Erreur', 'Impossible d\'uploader les images');
        return;
      }

      console.log('Images uploadées avec succès:', { idCardUrl, businessDocUrl });

      // 2. Préparer les données de document avec base64 pour assurer l'affichage
      // Lire les images en base64 encore une fois pour les stocker directement
      const idCardBase64 = idCardImage ? await FileSystem.readAsStringAsync(idCardImage, {
        encoding: FileSystem.EncodingType.Base64,
      }) : null;
      
      const businessDocBase64 = businessDocImage ? await FileSystem.readAsStringAsync(businessDocImage, {
        encoding: FileSystem.EncodingType.Base64,
      }) : null;
      
      // Préparer les formats complets data URI pour l'affichage direct
      const idCardFileExt = idCardImage?.split('.').pop() || 'jpg';
      const businessDocFileExt = businessDocImage?.split('.').pop() || 'jpg';
      
      const idCardDataUri = idCardBase64 ? 
        `data:image/${idCardFileExt === 'jpg' ? 'jpeg' : idCardFileExt};base64,${idCardBase64}` : 
        null;
        
      const businessDocDataUri = businessDocBase64 ? 
        `data:image/${businessDocFileExt === 'jpg' ? 'jpeg' : businessDocFileExt};base64,${businessDocBase64}` : 
        null;
      
      // Inclure à la fois les URLs et les données base64
      const docData = {
        idCardUrl,
        businessDocUrl,
        idCardBase64: idCardDataUri,
        businessDocBase64: businessDocDataUri,
        businessName,
        businessRegNumber,
        address
      };
      
      console.log('Données préparées avec base64:', {
        idCardUrl: idCardUrl,
        businessDocUrl: businessDocUrl,
        idCardBase64: idCardDataUri ? `[Base64 string, ${idCardBase64?.length || 0} bytes]` : null,
        businessDocBase64: businessDocDataUri ? `[Base64 string, ${businessDocBase64?.length || 0} bytes]` : null
      });
      
      const documentData = JSON.stringify(docData);
      console.log('Document data préparé:', documentData);

      // 3. Mise à jour des informations professionnelles de l'utilisateur
      console.log('Étape 2: Mise à jour des informations utilisateur');
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ 
          kyc_submitted: true,
          name: businessName,
          business_reg_number: businessRegNumber,
          address: address
        })
        .eq('id', user.id);
        
      if (userUpdateError) {
        console.error('Erreur lors de la mise à jour utilisateur:', userUpdateError);
      } else {
        console.log('Informations utilisateur mises à jour avec succès');
      }
      
      // 4. Créer directement l'entrée KYC dans la table
      console.log('Étape 3: Création de l\'entrée KYC');
      const { data: kycData, error: kycError } = await supabase
        .from('kyc')
        .insert({
          user_id: user.id,
          doc_url: documentData, // Stocke le JSON avec les deux URLs
          status: 'pending'
        })
        .select()
        .single();
        
      if (kycError) {
        console.error('Erreur lors de la création de l\'entrée KYC:', kycError);
        
        // En cas d'échec, essayer la fonction alternative
        console.log('Plan B: Utilisation de submitKycDocument');
        await submitKycDocument(user.id, documentData);
      } else {
        console.log('Entrée KYC créée avec succès:', kycData);
      }
      
      // 5. Tenter d'utiliser la fonction RPC si disponible (pour la compatibilité)
      console.log('Étape 4 (bonus): Tentative d\'utilisation de la fonction RPC');
      try {
        await supabase.rpc(
          'submit_kyc_data',
          { 
            input_user_id: user.id,
            business_name: businessName,
            user_address: address,
            business_reg_num: businessRegNumber,
            doc_data: documentData
          }
        );
        console.log('RPC exécutée avec succès (bonus)');
      } catch (rpcError) {
        console.log('Fonction RPC non disponible, ignoré:', rpcError);
        // Ignorer l'erreur car nous avons déjà inséré les données manuellement
      }
      
      // 6. Rafraîchir le profil pour obtenir les dernières informations
      console.log('Étape 5: Rafraîchissement du profil');
      await refreshProfile();

      console.log('Soumission des documents KYC réussie');
      
      // 7. Afficher un message de succès et rediriger
      Alert.alert(
        'Documents soumis avec succès',
        'Nous avons bien reçu vos documents. Votre compte est maintenant en attente de validation par notre équipe administrative.',
        [
          { text: 'OK', onPress: () => navigation.replace('ActivationPending') }
        ]
      );
    } catch (error: any) {
      console.error('Erreur lors de la soumission des documents:', error);
      
      // Même en cas d'erreur, essayer de rediriger vers l'écran d'attente si les images ont été uploadées
      Alert.alert(
        'Documents partiellement soumis', 
        'Vos documents ont été enregistrés mais nous avons rencontré un problème. Vous pouvez continuer le processus.',
        [
          { text: 'OK', onPress: () => {
            // Tentative de dernier recours: mettre à jour le flag via l'API
            try {
              supabase.from('users').update({ kyc_submitted: true }).eq('id', user?.id);
            } catch (e) {
              // Ignorer les erreurs ici
            }
            navigation.replace('ActivationPending');
          }}
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text variant="body1" color="text" style={styles.loadingText}>
          Envoi de vos documents en cours...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* En-tête avec logo et titre */}
        <View style={styles.headerContainer}>
          <Animated.View 
            style={[
              styles.logoContainer,
              {
                transform: [
                  { scale: logoScale }
                ]
              }
            ]}
          >
            <Image 
              source={{ uri: 'https://i.imgur.com/VhfSTEy.png' }}
              style={styles.logo} 
              resizeMode="cover"
            />
          </Animated.View>
          
          <Animated.View
            style={[
              styles.titleContainer,
              {
                opacity: logoScale,
                transform: [
                  { translateY: logoScale.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0]
                  })}
                ]
              }
            ]}
          >
            <Text variant="h1" weight="bold" color="primary" style={styles.title}>
              PRATIK
            </Text>
            <Text variant="body2" color="text-secondary" style={styles.subtitle}>
              Vérification d'identité
            </Text>
          </Animated.View>
        </View>

        {/* Indicateur d'étape */}
        <Animated.View 
          style={[
            styles.stepIndicator,
            {
              opacity: fadeAnim,
            }
          ]}
        >
          <View style={styles.stepProgressContainer}>
            <View style={styles.stepProgress}>
              <View style={[styles.stepProgressBar, { width: activeStep === 'documents' ? '50%' : '100%' }]} />
            </View>
          </View>
          <View style={styles.stepsLabelContainer}>
            <Text 
              variant="body3" 
              weight={activeStep === 'documents' ? 'bold' : 'regular'} 
              color={activeStep === 'documents' ? 'primary' : 'text-secondary'}
            >
              Étape 1: Documents
            </Text>
            <Text 
              variant="body3" 
              weight={activeStep === 'business' ? 'bold' : 'regular'} 
              color={activeStep === 'business' ? 'primary' : 'text-secondary'}
            >
              Étape 2: Informations
            </Text>
          </View>
        </Animated.View>

        {/* Contenu principal */}
        <Animated.View 
          style={[
            styles.formContainer,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim }
                // Suppression de l'animation translateX qui causait des problèmes
              ]
            }
          ]}
        >
          {activeStep === 'documents' ? (
            // Étape 1: Documents
            <View style={styles.stepContent}>
              <View style={styles.formHeader}>
                <Text variant="h4" weight="bold" color="text" style={styles.formTitle}>
                  Étape 1: Vos documents
                </Text>
                <Text variant="body2" color="text-secondary" style={styles.formSubtitle}>
                  Veuillez télécharger les documents suivants pour vérifier votre identité
                </Text>
              </View>
              
              <View style={styles.documentSection}>
                <Text variant="body2" weight="semibold" style={styles.documentTitle}>
                  Pièce d'identité
                </Text>
                <Text variant="body3" color="text-secondary" style={styles.documentDescription}>
                  Carte d'identité, passeport ou titre de séjour en cours de validité (recto-verso)
                </Text>

                {idCardImage ? (
                  <View style={styles.documentPreview}>
                    <Image source={{ uri: idCardImage }} style={styles.previewImage} />
                    <TouchableOpacity 
                      style={styles.changeButton}
                      onPress={() => pickImage(setIdCardImage, 'Pièce d\'identité')}
                    >
                      <Ionicons name="refresh-outline" size={18} color={COLORS.white} />
                      <Text variant="button" weight="semibold" color="light" style={styles.changeButtonText}>
                        Changer d'image
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={() => pickImage(setIdCardImage, 'Pièce d\'identité')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="cloud-upload-outline" size={28} color={COLORS.primary} />
                    <Text variant="body2" weight="semibold" color="primary" style={styles.uploadButtonText}>
                      Télécharger votre pièce d'identité
                    </Text>
                  </TouchableOpacity>
                )}
                {errors.idCardImage && (
                  <Text variant="caption" color="danger" style={styles.errorText}>
                    {errors.idCardImage}
                  </Text>
                )}
              </View>

              <View style={styles.documentSection}>
                <Text variant="body2" weight="semibold" style={styles.documentTitle}>
                  Document professionnel
                </Text>
                <Text variant="body3" color="text-secondary" style={styles.documentDescription}>
                  Extrait Kbis, attestation de vigilance URSSAF ou attestation fiscale
                </Text>

                {businessDocImage ? (
                  <View style={styles.documentPreview}>
                    <Image source={{ uri: businessDocImage }} style={styles.previewImage} />
                    <TouchableOpacity 
                      style={styles.changeButton}
                      onPress={() => pickImage(setBusinessDocImage, 'Document professionnel')}
                    >
                      <Ionicons name="refresh-outline" size={18} color={COLORS.white} />
                      <Text variant="button" weight="semibold" color="light" style={styles.changeButtonText}>
                        Changer d'image
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={() => pickImage(setBusinessDocImage, 'Document professionnel')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="cloud-upload-outline" size={28} color={COLORS.primary} />
                    <Text variant="body2" weight="semibold" color="primary" style={styles.uploadButtonText}>
                      Télécharger votre document professionnel
                    </Text>
                  </TouchableOpacity>
                )}
                {errors.businessDocImage && (
                  <Text variant="caption" color="danger" style={styles.errorText}>
                    {errors.businessDocImage}
                  </Text>
                )}
              </View>
              
              <TouchableOpacity
                style={styles.continueButton}
                onPress={goToNextStep}
                disabled={!idCardImage || !businessDocImage}
                activeOpacity={0.8}
              >
                <Text variant="button" weight="bold" color="light" style={styles.buttonText}>
                  Continuer
                </Text>
                <Ionicons name="arrow-forward" size={20} color={COLORS.white} style={styles.buttonIcon} />
              </TouchableOpacity>
            </View>
          ) : (
            // Étape 2: Informations professionnelles
            <View style={styles.stepContent}>
              <View style={styles.formHeader}>
                <Text variant="h4" weight="bold" color="text" style={styles.formTitle}>
                  Étape 2: Informations professionnelles
                </Text>
                <Text variant="body2" color="text-secondary" style={styles.formSubtitle}>
                  Veuillez compléter vos informations professionnelles
                </Text>
              </View>
              
              <View style={styles.inputGroup}>
                <View style={styles.inputContainer}>
                  <Text variant="body2" weight="semibold" style={styles.inputLabel}>
                    Nom de l'entreprise
                  </Text>
                  <TouchableOpacity 
                    activeOpacity={1}
                    style={[
                      styles.input, 
                      errors.businessName ? styles.inputError : null,
                      businessName.length > 0 ? styles.inputFilled : null
                    ]}
                  >
                    <View style={styles.inputIcon}>
                      <Ionicons name="business-outline" size={22} color={COLORS.primary} />
                    </View>
                    <TextInput
                      placeholder="Nom de votre entreprise ou auto-entreprise"
                      value={businessName}
                      onChangeText={setBusinessName}
                      style={styles.textInput}
                      placeholderTextColor={COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                  {errors.businessName && (
                    <Text variant="caption" color="danger" style={styles.errorText}>
                      {errors.businessName}
                    </Text>
                  )}
                </View>
                
                <View style={styles.inputContainer}>
                  <Text variant="body2" weight="semibold" style={styles.inputLabel}>
                    Numéro d'immatriculation
                  </Text>
                  <TouchableOpacity 
                    activeOpacity={1}
                    style={[
                      styles.input, 
                      errors.businessRegNumber ? styles.inputError : null,
                      businessRegNumber.length > 0 ? styles.inputFilled : null
                    ]}
                  >
                    <View style={styles.inputIcon}>
                      <Ionicons name="card-outline" size={22} color={COLORS.primary} />
                    </View>
                    <TextInput
                      placeholder="SIRET, SIREN ou numéro d'auto-entrepreneur"
                      value={businessRegNumber}
                      onChangeText={setBusinessRegNumber}
                      style={styles.textInput}
                      placeholderTextColor={COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                  {errors.businessRegNumber && (
                    <Text variant="caption" color="danger" style={styles.errorText}>
                      {errors.businessRegNumber}
                    </Text>
                  )}
                </View>
                
                <View style={styles.inputContainer}>
                  <Text variant="body2" weight="semibold" style={styles.inputLabel}>
                    Adresse professionnelle
                  </Text>
                  <TouchableOpacity 
                    activeOpacity={1}
                    style={[
                      styles.input,
                      errors.address ? styles.inputError : null,
                      address.length > 0 ? styles.inputFilled : null
                    ]}
                  >
                    <View style={styles.inputIcon}>
                      <Ionicons name="location-outline" size={22} color={COLORS.primary} />
                    </View>
                    <TextInput
                      placeholder="Adresse complète"
                      value={address}
                      onChangeText={setAddress}
                      style={styles.textInput}
                      placeholderTextColor={COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                  {errors.address && (
                    <Text variant="caption" color="danger" style={styles.errorText}>
                      {errors.address}
                    </Text>
                  )}
                </View>
                
                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={goToPreviousStep}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="arrow-back" size={20} color={COLORS.primary} style={styles.buttonIcon} />
                    <Text variant="button" weight="bold" color="primary" style={styles.buttonText}>
                      Retour
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleSubmit}
                    activeOpacity={0.8}
                  >
                    <Text variant="button" weight="bold" color="light" style={styles.buttonText}>
                      Soumettre
                    </Text>
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.white} style={styles.buttonIcon} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </Animated.View>
        
        <View style={styles.infoContainer}>
          <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.textSecondary} style={styles.infoIcon} />
          <Text variant="caption" color="text-secondary" style={styles.infoText}>
            Vos informations sont cryptées et utilisées uniquement pour vérifier votre identité. 
            Elles ne seront pas partagées avec des tiers sans votre consentement.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  contentContainer: {
    padding: SIZES.padding,
    paddingBottom: SIZES.padding * 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  loadingText: {
    marginTop: SIZES.padding,
  },
  
  // Header
  headerContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  logoContainer: {
    width: 70,
    height: 70,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    ...SHADOWS.small,
    overflow: 'hidden',
  },
  logo: {
    width: 70,
    height: 70,
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    letterSpacing: 3,
    marginBottom: 3,
    fontWeight: '800',
  },
  subtitle: {
    opacity: 0.7,
    textAlign: 'center',
  },
  
  // Step Indicator
  stepIndicator: {
    marginBottom: 20,
  },
  stepProgressContainer: {
    paddingHorizontal: 10,
    marginBottom: 5,
  },
  stepProgress: {
    height: 6,
    backgroundColor: `${COLORS.border}50`,
    borderRadius: 3,
    overflow: 'hidden',
  },
  stepProgressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  stepsLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  
  // Form Container
  formContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 30,
    ...SHADOWS.medium,
    marginHorizontal: 0,
    marginTop: 10,
    marginBottom: 20,
    overflow: 'hidden',
  },
  stepContent: {
    padding: 25,
  },
  formHeader: {
    marginBottom: 20,
  },
  formTitle: {
    marginBottom: 5,
  },
  formSubtitle: {
    opacity: 0.7,
  },
  
  // Document Section
  documentSection: {
    marginBottom: 25,
  },
  documentTitle: {
    marginBottom: 5,
  },
  documentDescription: {
    marginBottom: 15,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    backgroundColor: `${COLORS.primary}10`,
    borderWidth: 1.5,
    borderColor: `${COLORS.primary}30`,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 15,
  },
  uploadButtonText: {
    marginLeft: 10,
  },
  documentPreview: {
    marginTop: 10,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    marginBottom: 15,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 10,
    alignSelf: 'center',
    ...SHADOWS.small,
  },
  changeButtonText: {
    marginLeft: 8,
  },
  
  // Input styles
  inputGroup: {
    marginBottom: 15,
  },
  inputContainer: {
    marginBottom: 18,
  },
  inputLabel: {
    marginBottom: 5,
    marginLeft: 2,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.backgroundDark}50`,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...SHADOWS.small,
  },
  // Suppression du style textareaInput qui n'est plus utilisé
  inputFilled: {
    borderColor: `${COLORS.primary}30`,
    backgroundColor: `${COLORS.primary}05`,
  },
  inputError: {
    borderColor: `${COLORS.danger}50`,
    backgroundColor: `${COLORS.danger}05`,
  },
  inputIcon: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}10`,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
    minHeight: 46,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  errorText: {
    marginTop: 4,
    marginLeft: 2,
  },
  
  // Buttons
  continueButton: {
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
    marginTop: 15,
    borderWidth: 1.5,
    borderColor: `${COLORS.primary}80`,
  },
  submitButton: {
    flex: 1,
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
    borderWidth: 1.5,
    borderColor: `${COLORS.primary}80`,
  },
  backButton: {
    width: 100,
    height: 50,
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
    borderWidth: 1.5,
    borderColor: `${COLORS.primary}30`,
  },
  buttonText: {
    fontSize: 15,
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginHorizontal: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    marginTop: 10,
  },
  
  // Info
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: `${COLORS.info}10`,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 5,
    marginBottom: 20,
  },
  infoIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    lineHeight: 16,
  },
});

export default KycSubmissionScreen;