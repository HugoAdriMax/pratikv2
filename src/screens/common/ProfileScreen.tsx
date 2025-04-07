import React, { useState } from 'react';
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

const ProfileScreen = ({ navigation }: any) => {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(true);
  const insets = useSafeAreaInsets();

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
        leftIcon={<Ionicons name={icon} size={14} color={COLORS[variant]} />}
        border
      />
    );
  };

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

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text variant="h3" weight="semibold">Profil</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Card style={styles.profileCard} elevation="sm">
          <View style={styles.profileHeader}>
            <Avatar 
              size="xl"
              initials={userInitials}
              backgroundColor={COLORS.primary}
            />
            <View style={styles.profileInfo}>
              <Text variant="h4" weight="semibold">{displayName}</Text>
              <View style={styles.marginTopXs}>
                {renderUserRole()}
              </View>
            </View>
          </View>

          <View style={styles.separator} />

          <View>
            <TouchableOpacity style={styles.profileAction} activeOpacity={0.7}>
              <Ionicons name="create-outline" size={22} color={COLORS.primary} />
              <Text variant="body2" weight="medium" style={styles.marginLeft}>
                Modifier mon profil
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.profileAction} activeOpacity={0.7}>
              <Ionicons name="key-outline" size={22} color={COLORS.primary} />
              <Text variant="body2" weight="medium" style={styles.marginLeft}>
                Changer mon mot de passe
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

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

        <Card style={styles.sectionCard} elevation="sm">
          <View style={styles.sectionHeader}>
            <Ionicons name="settings-outline" size={22} color={COLORS.primary} />
            <Text variant="h5" weight="semibold" style={styles.marginLeft}>
              Paramètres
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <Ionicons name="notifications-outline" size={20} color={COLORS.textSecondary} />
              <Text variant="body2" style={styles.marginLeft}>Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: COLORS.backgroundDark, true: `${COLORS.primary}80` }}
              thumbColor={notificationsEnabled ? COLORS.primary : COLORS.border}
              ios_backgroundColor={COLORS.backgroundDark}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <Ionicons name="location-outline" size={20} color={COLORS.textSecondary} />
              <Text variant="body2" style={styles.marginLeft}>Suivi de position</Text>
            </View>
            <Switch
              value={locationTrackingEnabled}
              onValueChange={setLocationTrackingEnabled}
              trackColor={{ false: COLORS.backgroundDark, true: `${COLORS.primary}80` }}
              thumbColor={locationTrackingEnabled ? COLORS.primary : COLORS.border}
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

        {user.role === UserRole.PRESTAIRE && (
          <Card style={styles.sectionCard} elevation="sm">
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={22} color={COLORS.primary} />
              <Text variant="h5" weight="semibold" style={styles.marginLeft}>
                Documents
              </Text>
            </View>

            <View style={styles.separator} />

            <TouchableOpacity style={styles.documentItem} activeOpacity={0.7}>
              <View style={styles.documentIconContainer}>
                <Ionicons name="card-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.documentInfo}>
                <Text variant="body2" weight="medium">Pièce d'identité</Text>
                <Text variant="caption" color="text-secondary">Ajouter ou mettre à jour</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.documentItem} activeOpacity={0.7}>
              <View style={styles.documentIconContainer}>
                <Ionicons name="home-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.documentInfo}>
                <Text variant="body2" weight="medium">Justificatif de domicile</Text>
                <Text variant="caption" color="text-secondary">Ajouter ou mettre à jour</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.documentItem} activeOpacity={0.7}>
              <View style={styles.documentIconContainer}>
                <Ionicons name="briefcase-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.documentInfo}>
                <Text variant="body2" weight="medium">Attestation professionnelle</Text>
                <Text variant="caption" color="text-secondary">Ajouter ou mettre à jour</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </Card>
        )}

        <Card style={[styles.sectionCard, styles.marginBottom]} elevation="sm">
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