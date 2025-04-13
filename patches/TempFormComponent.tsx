import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Button as RNButton
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Text, Card, Button } from '../../components/ui';
import { COLORS, SHADOWS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import supabase from '../../config/supabase';

const TempFormComponent = ({ navigation, route }: any) => {
  const { user, refreshProfile } = useAuth();
  const [saveLoading, setSaveLoading] = useState(false);
  
  // Les valeurs initiales proviennent des params de navigation ou de l'utilisateur
  const [formValues, setFormValues] = useState({
    name: route.params?.name || user?.name || '',
    phone: route.params?.phone || user?.phone || '',
    address: route.params?.address || user?.address || '',
    business_reg_number: route.params?.business_reg_number || user?.business_reg_number || ''
  });

  // Fonction pour sauvegarder les données du formulaire
  const handleSave = async () => {
    if (!user) return;
    
    try {
      setSaveLoading(true);
      
      // Validation minimale
      if (!formValues.name.trim()) {
        Alert.alert('Erreur', 'Le nom est requis');
        setSaveLoading(false);
        return;
      }
      
      // Créer l'objet de données à mettre à jour
      const updatedData = {
        name: formValues.name.trim(),
        phone: formValues.phone.trim(),
        address: formValues.address.trim(),
        business_reg_number: formValues.business_reg_number.trim(),
        updated_at: new Date().toISOString()
      };
      
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

  // Méthode pour ouvrir un éditeur de champ temporaire
  const openFieldEditor = (fieldName: string, currentValue: string, label: string) => {
    // Naviguer vers l'écran d'édition de champ avec les valeurs actuelles
    navigation.navigate('FieldEditor', {
      fieldName,
      currentValue,
      label,
      onSave: (newValue: string) => {
        setFormValues(prev => ({
          ...prev,
          [fieldName]: newValue
        }));
      }
    });
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text variant="body1">Chargement...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text variant="h3" weight="semibold">Modifier mon profil</Text>
        </View>
      </View>
      
      <ScrollView style={styles.scrollView}>
        <Card style={styles.card} elevation="sm">
          <Text variant="h5" weight="semibold" style={styles.cardTitle}>
            Informations personnelles
          </Text>
          
          <View style={styles.field}>
            <Text variant="body2" weight="medium" style={styles.fieldLabel}>Nom</Text>
            <TouchableOpacity 
              style={styles.fieldValue}
              onPress={() => openFieldEditor('name', formValues.name, 'Nom')}
            >
              <Text variant="body1">{formValues.name || 'Non spécifié'}</Text>
              <Ionicons name="create-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.field}>
            <Text variant="body2" weight="medium" style={styles.fieldLabel}>Téléphone</Text>
            <TouchableOpacity 
              style={styles.fieldValue}
              onPress={() => openFieldEditor('phone', formValues.phone, 'Téléphone')}
            >
              <Text variant="body1">{formValues.phone || 'Non spécifié'}</Text>
              <Ionicons name="create-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.field}>
            <Text variant="body2" weight="medium" style={styles.fieldLabel}>Adresse</Text>
            <TouchableOpacity 
              style={styles.fieldValue}
              onPress={() => openFieldEditor('address', formValues.address, 'Adresse')}
            >
              <Text variant="body1" numberOfLines={2}>{formValues.address || 'Non spécifiée'}</Text>
              <Ionicons name="create-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          
          {user.role === 'prestataire' && (
            <View style={styles.field}>
              <Text variant="body2" weight="medium" style={styles.fieldLabel}>Numéro SIRET/SIREN</Text>
              <TouchableOpacity 
                style={styles.fieldValue}
                onPress={() => openFieldEditor('business_reg_number', formValues.business_reg_number, 'Numéro SIRET/SIREN')}
              >
                <Text variant="body1">{formValues.business_reg_number || 'Non spécifié'}</Text>
                <Ionicons name="create-outline" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
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
            onPress={handleSave}
            loading={saveLoading}
            style={styles.saveButton}
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
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: SPACING.sm,
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  card: {
    margin: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
  },
  cardTitle: {
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  field: {
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    marginBottom: SPACING.xs,
    color: COLORS.textSecondary,
  },
  fieldValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    margin: SPACING.md,
    marginTop: SPACING.xs,
  },
  saveButton: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  cancelButton: {
    flex: 1,
    marginRight: SPACING.sm,
  },
});

export default TempFormComponent;