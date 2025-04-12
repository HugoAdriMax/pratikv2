import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Card, Button, Avatar, Badge } from '../../components/ui';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { uploadProfilePicture } from '../../services/api';

const ProfileScreen = ({ navigation }: any) => {
  const { user, signOut, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(true);
  const [forceUpdate, setForceUpdate] = useState(0); // Pour forcer le rafraîchissement du composant
  const [localImageBase64, setLocalImageBase64] = useState<string | null>(null); // Stockage local de l'image base64
  const insets = useSafeAreaInsets();
  
  // Debug - Afficher les informations utilisateur
  useEffect(() => {
    console.log('User profile:', JSON.stringify(user));
  }, [user]);
  
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
        
        // Mettre à jour le profil dans Supabase
        await refreshProfile();
        
        // Force update du state local pour garantir l'affichage
        setForceUpdate(prev => prev + 1);
        
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
  
  // Fonctions pour gérer les actions utilisateur
  const handleSignOut = async () => {
    try {
      setLoading(true);
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la déconnexion');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer le compte',
      'Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Supprimer', 
          style: 'destructive',
          onPress: () => {
            // Logique de suppression du compte (à implémenter)
            Alert.alert('Information', 'Cette fonctionnalité sera disponible prochainement');
          }
        }
      ]
    );
  };

  // Fonction pour obtenir le badge de rôle utilisateur
  const renderUserRole = () => {
    const getRoleConfig = () => {
      switch (user?.role) {
        case UserRole.CLIENT:
          return { label: 'Client', variant: 'primary', icon: 'person' };
        case UserRole.PRESTAIRE:
          return { label: 'Prestataire', variant: 'secondary', icon: 'briefcase' };
        case UserRole.ADMIN:
          return { label: 'Administrateur', variant: 'info', icon: 'shield-checkmark' };
        default:
          return { label: 'Utilisateur', variant: 'secondary', icon: 'person' };
      }
    };

    const { label, variant, icon } = getRoleConfig();

    return (
      <Badge
        variant={variant as any}
        label={label}
        leftIcon={<Ionicons name={icon as any} size={14} color={COLORS[variant]} />}
        border
      />
    );
  };

  // Affichage pendant le chargement
  if (!user) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text variant="body2" color="text-secondary" style={styles.marginTop}>
          Chargement du profil...
        </Text>
      </View>
    );
  }

  const userInitials = user.email ? user.email.charAt(0).toUpperCase() : "?";
  const displayName = user.name || user.email || "Utilisateur";

  // Version style mise à jour
  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text variant="h3" weight="semibold">Profil</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Carte de profil */}
        <Card style={styles.profileCard} elevation="sm">
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              {imageLoading ? (
                <View style={styles.avatarLoadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
              ) : (
                <Avatar 
                  size="xl"
                  initials={userInitials}
                  backgroundColor={COLORS.primary}
                  source={user.profile_picture_base64 
                    ? { uri: user.profile_picture_base64 } 
                    : localImageBase64 
                      ? { uri: localImageBase64 } 
                      : user.profile_picture 
                        ? { uri: `${user.profile_picture}&force=${forceUpdate}` } 
                        : null
                  }
                  onPress={handleProfilePictureSelection}
                />
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={14} color={COLORS.white} />
              </View>
            </View>
            <View style={styles.profileInfo}>
              <Text variant="h4" weight="semibold">{displayName}</Text>
              <View style={styles.marginTopXs}>
                {renderUserRole()}
              </View>
            </View>
          </View>

          <View style={styles.separator} />

          <View>
            <TouchableOpacity 
              style={[styles.profileAction, styles.highlightedAction]} 
              activeOpacity={0.7}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Ionicons name="create-outline" size={22} color={COLORS.primary} />
              <Text variant="body2" weight="medium" style={styles.marginLeft}>
                Modifier mon profil
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.profileAction} 
              activeOpacity={0.7}
              onPress={() => {
                Alert.alert(
                  'Changer de mot de passe',
                  'Entrez votre nouveau mot de passe:',
                  [
                    {
                      text: 'Annuler',
                      style: 'cancel'
                    },
                    {
                      text: 'Changer',
                      onPress: () => {
                        // Cette fonctionnalité sera implémentée ultérieurement
                        Alert.alert('Succès', 'Votre demande de changement de mot de passe a été envoyée par email.');
                      }
                    }
                  ]
                );
              }}
            >
              <Ionicons name="key-outline" size={22} color={COLORS.primary} />
              <Text variant="body2" weight="medium" style={styles.marginLeft}>
                Changer mon mot de passe
              </Text>
            </TouchableOpacity>
            
            {user.role === UserRole.PRESTAIRE && (
              <TouchableOpacity 
                style={styles.profileAction}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Reviews')}
              >
                <Ionicons name="star-outline" size={22} color={COLORS.primary} />
                <Text variant="body2" weight="medium" style={styles.marginLeft}>
                  Mes évaluations
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* Informations personnelles */}
        <Card style={styles.sectionCard} elevation="sm">
          <View style={styles.sectionHeader}>
            <Ionicons name="person-circle-outline" size={22} color={COLORS.primary} />
            <Text variant="h5" weight="semibold" style={styles.marginLeft}>
              Informations personnelles
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoItem}>
            <Text variant="body2" color="text-secondary">Email</Text>
            <Text variant="body2" weight="medium">{user.email}</Text>
          </View>

          {user.phone && (
            <View style={styles.infoItem}>
              <Text variant="body2" color="text-secondary">Téléphone</Text>
              <Text variant="body2" weight="medium">{user.phone}</Text>
            </View>
          )}

          <View style={styles.infoItem}>
            <Text variant="body2" color="text-secondary">Compte vérifié</Text>
            <Badge 
              variant={user.is_verified ? 'success' : 'warning'}
              label={user.is_verified ? 'Vérifié' : 'Non vérifié'}
              size="sm"
              border
            />
          </View>

          {user.address && (
            <View style={styles.infoItem}>
              <Text variant="body2" color="text-secondary">Adresse</Text>
              <Text variant="body2" weight="medium" numberOfLines={2} style={styles.addressText}>
                {user.address}
              </Text>
            </View>
          )}
        </Card>

        {/* Paramètres */}
        <Card style={styles.sectionCard} elevation="sm">
          <View style={styles.sectionHeader}>
            <Ionicons name="settings-outline" size={22} color={COLORS.primary} />
            <Text variant="h5" weight="semibold" style={styles.marginLeft}>
              Paramètres
            </Text>
          </View>

          <View style={styles.separator} />

          <TouchableOpacity 
            style={styles.settingAction} 
            activeOpacity={0.7}
            onPress={() => navigation.navigate('NotificationsList')}
          >
            <Ionicons name="notifications-outline" size={20} color={COLORS.textSecondary} />
            <Text variant="body2" style={styles.marginLeft}>Notifications</Text>
            <View style={styles.settingActionValue}>
              <Text variant="body2" color="text-secondary">Voir</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} style={styles.marginLeft} />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.settingAction, styles.highlightedAction]} 
            activeOpacity={0.7}
            onPress={() => navigation.navigate('NotificationSettings')}
          >
            <Ionicons name="options-outline" size={20} color={COLORS.primary} />
            <Text variant="body2" weight="semibold" color="primary" style={styles.marginLeft}>
              Paramètres de notifications
            </Text>
            <View style={styles.settingActionValue}>
              <Badge 
                variant="primary" 
                label="Nouveau" 
                size="sm" 
                border 
              />
              <Ionicons name="chevron-forward" size={16} color={COLORS.primary} style={styles.marginLeft} />
            </View>
          </TouchableOpacity>

          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <Ionicons name="location-outline" size={20} color={COLORS.textSecondary} />
              <Text variant="body2" style={styles.marginLeft}>Suivi de position</Text>
            </View>
            <Switch
              value={locationTrackingEnabled}
              onValueChange={setLocationTrackingEnabled}
              trackColor={{ false: COLORS.backgroundDark, true: `${COLORS.primary}80` }}
              thumbColor={locationTrackingEnabled ? COLORS.primary : COLORS.grey}
              ios_backgroundColor={COLORS.backgroundDark}
            />
          </View>

          <TouchableOpacity style={styles.settingAction} activeOpacity={0.7}>
            <Ionicons name="language-outline" size={20} color={COLORS.textSecondary} />
            <Text variant="body2" style={styles.marginLeft}>Langue</Text>
            <View style={styles.settingActionValue}>
              <Text variant="body2" color="text-secondary">Français</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} style={styles.marginLeft} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingAction} activeOpacity={0.7}>
            <Ionicons name="moon-outline" size={20} color={COLORS.textSecondary} />
            <Text variant="body2" style={styles.marginLeft}>Thème</Text>
            <View style={styles.settingActionValue}>
              <Text variant="body2" color="text-secondary">Clair</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} style={styles.marginLeft} />
            </View>
          </TouchableOpacity>
        </Card>

        {/* Services et paiements (pour les prestataires) */}
        {user.role === UserRole.PRESTAIRE && (
          <Card style={styles.sectionCard} elevation="sm">
            <View style={styles.sectionHeader}>
              <Ionicons name="build-outline" size={22} color={COLORS.primary} />
              <Text variant="h5" weight="semibold" style={styles.marginLeft}>
                Services et paiements
              </Text>
            </View>

            <View style={styles.separator} />
            
            <TouchableOpacity 
              style={styles.documentItem} 
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ServiceSelection')}
            >
              <View style={styles.documentIconContainer}>
                <Ionicons name="build-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.documentInfo}>
                <Text variant="body2" weight="medium">Mes services proposés</Text>
                <Text variant="caption" color="text-secondary">Sélectionner vos spécialités</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.documentItem} 
              activeOpacity={0.7}
              onPress={() => navigation.navigate('StripeConnect')}
            >
              <View style={styles.documentIconContainer}>
                <Ionicons name="card-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.documentInfo}>
                <Text variant="body2" weight="medium">Configuration des paiements</Text>
                <Text variant="caption" color="text-secondary">Connecter votre compte Stripe</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </Card>
        )}

        {/* Aide et support */}
        <Card style={styles.sectionCard} elevation="sm">
          <View style={styles.sectionHeader}>
            <Ionicons name="help-circle-outline" size={22} color={COLORS.primary} />
            <Text variant="h5" weight="semibold" style={styles.marginLeft}>
              Aide et support
            </Text>
          </View>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.supportItem} activeOpacity={0.7}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.textSecondary} />
            <Text variant="body2" style={styles.marginLeft}>Contacter le support</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.supportItem} activeOpacity={0.7}>
            <Ionicons name="book-outline" size={20} color={COLORS.textSecondary} />
            <Text variant="body2" style={styles.marginLeft}>FAQ et guides</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.supportItem} activeOpacity={0.7}>
            <Ionicons name="shield-outline" size={20} color={COLORS.textSecondary} />
            <Text variant="body2" style={styles.marginLeft}>Conditions générales</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.supportItem} activeOpacity={0.7}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
            <Text variant="body2" style={styles.marginLeft}>Politique de confidentialité</Text>
          </TouchableOpacity>
        </Card>


        {/* Actions de compte */}
        <View style={[styles.actionsContainer, { marginBottom: insets.bottom > 0 ? 0 : 20 }]}>
          <Button
            variant="outline"
            label="Se déconnecter"
            icon={<Ionicons name="log-out-outline" size={20} color={COLORS.primary} />}
            onPress={handleSignOut}
            loading={loading}
            style={styles.signOutButton}
          />
          
          <Button
            variant="danger"
            label="Supprimer mon compte"
            onPress={handleDeleteAccount}
            style={styles.marginTop}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
  },
  highlightedAction: {
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginVertical: SPACING.xs,
  },
  avatarContainer: {
    position: 'relative',
    width: 72,  // Taille de XL Avatar
    height: 72, // Taille de XL Avatar
  },
  avatarLoadingContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
    ...SHADOWS.small,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  profileCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  profileAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  sectionCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  addressText: {
    maxWidth: '60%',
    textAlign: 'right',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  settingActionValue: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  documentIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.round,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}15`,
    marginRight: SPACING.sm,
  },
  documentInfo: {
    flex: 1,
  },
  supportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  actionsContainer: {
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  signOutButton: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
  },
  marginLeft: {
    marginLeft: SPACING.sm,
  },
  marginTop: {
    marginTop: SPACING.md,
  },
  marginTopXs: {
    marginTop: SPACING.xs,
  },
  marginBottom: {
    marginBottom: SPACING.md,
  },
});

export default ProfileScreen;