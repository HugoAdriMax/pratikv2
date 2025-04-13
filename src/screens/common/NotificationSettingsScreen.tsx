import React, { useState, useEffect } from 'react';
import { 
  Switch, 
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  View,
  StyleSheet,
  TouchableOpacity
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import supabase from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { Text, Card, Button } from '../../components/ui';
import { COLORS, SPACING, SHADOWS, BORDER_RADIUS } from '../../utils/theme';

interface NotificationPreferences {
  new_offers: boolean;
  status_updates: boolean;
  messages: boolean;
  account_updates: boolean;
  marketing: boolean;
}

const NotificationSettingsScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    new_offers: true,
    status_updates: true,
    messages: true,
    account_updates: true,
    marketing: false,
  });
  
  useEffect(() => {
    fetchPreferences();
  }, [user]);
  
  const fetchPreferences = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (error) throw error;
      
      if (data) {
        console.log('Préférences récupérées:', data);
        
        // Vérifier quelles propriétés existent réellement dans les données
        setPreferences({
          new_offers: data.new_offers !== null ? data.new_offers : true,
          status_updates: data.status_updates !== null ? data.status_updates : true,
          messages: data.messages !== null ? data.messages : true,
          account_updates: data.account_updates !== null ? data.account_updates : true,
          marketing: data.marketing !== null ? data.marketing : false,
        });
      } else {
        console.log('Aucune préférence trouvée, utilisation des valeurs par défaut');
      }
      
    } catch (error: any) {
      console.error('Error fetching notification preferences:', error);
      Alert.alert('Erreur', 'Impossible de récupérer vos préférences de notification');
    } finally {
      setLoading(false);
    }
  };
  
  const savePreferences = async () => {
    if (!user) return;
    
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('user_notification_preferences')
        .upsert({
          user_id: user.id,
          ...preferences,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });
        
      if (error) throw error;
      
      Alert.alert('Succès', 'Vos préférences de notification ont été mises à jour');
      
    } catch (error: any) {
      console.error('Error saving notification preferences:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder vos préférences de notification');
    } finally {
      setSaving(false);
    }
  };
  
  const toggleSwitch = (key: keyof NotificationPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }
  
  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text variant="h5" weight="semibold">Paramètres de notifications</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView style={styles.scrollView}>
        
        <Card style={styles.card}>
          
          <View style={styles.settingsList}>
            {/* Nouvelles offres */}
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text variant="body1" weight="medium">Nouvelles offres</Text>
                <Text variant="caption" color="text-secondary">
                  Recevez des notifications lorsque des nouvelles offres sont disponibles
                </Text>
              </View>
              <Switch
                value={preferences.new_offers}
                onValueChange={() => toggleSwitch('new_offers')}
                trackColor={{ false: COLORS.light, true: `${COLORS.primary}50` }}
                thumbColor={preferences.new_offers ? COLORS.primary : COLORS.textSecondary}
              />
            </View>
            
            <View style={styles.separator} />
            
            {/* Mises à jour de statut */}
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text variant="body1" weight="medium">Mises à jour de statut</Text>
                <Text variant="caption" color="text-secondary">
                  Recevez des notifications lorsque le statut d'une mission change
                </Text>
              </View>
              <Switch
                value={preferences.status_updates}
                onValueChange={() => toggleSwitch('status_updates')}
                trackColor={{ false: COLORS.light, true: `${COLORS.primary}50` }}
                thumbColor={preferences.status_updates ? COLORS.primary : COLORS.textSecondary}
              />
            </View>
            
            <View style={styles.separator} />
            
            {/* Messages */}
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text variant="body1" weight="medium">Messages</Text>
                <Text variant="caption" color="text-secondary">
                  Recevez des notifications pour les nouveaux messages
                </Text>
              </View>
              <Switch
                value={preferences.messages}
                onValueChange={() => toggleSwitch('messages')}
                trackColor={{ false: COLORS.light, true: `${COLORS.primary}50` }}
                thumbColor={preferences.messages ? COLORS.primary : COLORS.textSecondary}
              />
            </View>
            
            <View style={styles.separator} />
            
            {/* Mises à jour du compte */}
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text variant="body1" weight="medium">Mises à jour du compte</Text>
                <Text variant="caption" color="text-secondary">
                  Informations importantes concernant votre compte
                </Text>
              </View>
              <Switch
                value={preferences.account_updates}
                onValueChange={() => toggleSwitch('account_updates')}
                trackColor={{ false: COLORS.light, true: `${COLORS.primary}50` }}
                thumbColor={preferences.account_updates ? COLORS.primary : COLORS.textSecondary}
              />
            </View>
            
            <View style={styles.separator} />
            
            {/* Marketing */}
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text variant="body1" weight="medium">Offres et promotions</Text>
                <Text variant="caption" color="text-secondary">
                  Recevez des notifications marketing et des offres spéciales
                </Text>
              </View>
              <Switch
                value={preferences.marketing}
                onValueChange={() => toggleSwitch('marketing')}
                trackColor={{ false: COLORS.light, true: `${COLORS.primary}50` }}
                thumbColor={preferences.marketing ? COLORS.primary : COLORS.textSecondary}
              />
            </View>
          </View>
        </Card>
        
        <Card style={styles.card}>
          
          <View style={styles.infoList}>
            <View style={styles.infoItem}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <Text variant="body2" style={styles.infoText}>
                Vous recevrez des notifications par email et dans l'application
              </Text>
            </View>
            
            <View style={styles.infoItem}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <Text variant="body2" style={styles.infoText}>
                Vous pouvez modifier vos préférences à tout moment
              </Text>
            </View>
            
            <View style={styles.infoItem}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <Text variant="body2" style={styles.infoText}>
                Certaines notifications critiques concernant votre compte ne peuvent pas être désactivées
              </Text>
            </View>
          </View>
        </Card>
        
        <Button
          variant="primary"
          size="sm"
          label="Enregistrer les modifications"
          onPress={savePreferences}
          loading={saving}
          style={styles.saveButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  card: {
    margin: SPACING.md,
    marginBottom: SPACING.sm,
  },
  settingsList: {
    marginTop: SPACING.sm,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  settingInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  infoList: {
    marginTop: SPACING.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  infoText: {
    marginLeft: SPACING.sm,
    flex: 1,
  },
  saveButton: {
    margin: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
});

export default NotificationSettingsScreen;