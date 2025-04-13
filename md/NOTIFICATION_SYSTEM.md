# Système de Notifications

Ce document décrit la mise en place du système de notifications au sein de l'application Client-Prestation, comprenant les notifications locales, les préférences utilisateur et l'historique des notifications.

## Architecture

Le système de notifications se compose de plusieurs éléments clés :

1. **Base de données**
   - Tables pour les tokens d'appareils
   - Préférences de notifications par utilisateur
   - Historique des notifications

2. **Services**
   - Enregistrement des appareils (token Expo)
   - Envoi de notifications locales
   - Gestion des préférences

3. **Interfaces utilisateur**
   - Écran de liste des notifications
   - Écran de paramètres des notifications

## Tables de base de données

Les tables suivantes ont été créées pour prendre en charge le système de notifications :

### `user_notification_tokens`

Stocke les tokens des appareils pour l'envoi de notifications push.

```sql
CREATE TABLE user_notification_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_type TEXT NOT NULL, -- 'ios', 'android', 'web'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, token)
);
```

### `user_notification_preferences`

Stocke les préférences de notification pour chaque utilisateur.

```sql
CREATE TABLE user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  new_offers BOOLEAN DEFAULT TRUE,
  status_updates BOOLEAN DEFAULT TRUE,
  messages BOOLEAN DEFAULT TRUE,
  account_updates BOOLEAN DEFAULT TRUE,
  marketing BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);
```

### `notifications`

Stocke l'historique des notifications envoyées.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Politiques de sécurité RLS

Des politiques RLS (Row Level Security) ont été mises en place pour sécuriser les données :

```sql
-- Policies for user_notification_tokens
CREATE POLICY "Users can view their own notification tokens" 
  ON user_notification_tokens FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notification tokens" 
  ON user_notification_tokens FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Similar policies for other tables...
```

## Intégration avec Expo Notifications

L'application utilise Expo Notifications pour gérer les notifications locales et la préparation des notifications push.

### Enregistrement d'un appareil

```typescript
export async function registerForPushNotificationsAsync() {
  let token;
  
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Permission non accordée pour les notifications!');
      return null;
    }
    
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    })).data;
  }

  // Configuration Android spécifique
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}
```

### Envoi d'une notification locale

```typescript
export async function sendLocalNotification(title: string, body: string, data?: any) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
      },
      trigger: null, // notification immédiate
    });
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification locale:', error);
    return false;
  }
}
```

## Fonctionnalités implémentées

1. **Écouteurs de notifications**
   - Gestion des notifications en premier plan
   - Gestion des interactions utilisateur avec les notifications

2. **Préférences de notifications**
   - Activation/désactivation par types de notifications
   - Interface utilisateur pour gérer les préférences

3. **Historique des notifications**
   - Liste des notifications reçues
   - Marquage des notifications comme lues
   - Navigation contextuelle basée sur le type de notification

## Points d'intégration

### Dans l'API

Les fonctions d'API intègrent les notifications :

```typescript
// Exemple : Acceptation d'une offre avec notification
export const acceptOffer = async (offerId: string): Promise<Offer> => {
  try {
    // Logique d'acceptation...
    
    // Notification au prestataire
    const preferences = await getUserNotificationPreferences(prestataireId);
    if (!preferences || preferences.new_offers !== false) {
      await sendNotificationToUser(
        prestataireId,
        'Votre offre a été acceptée',
        `Votre offre pour le service de ${serviceName} a été acceptée par le client.`,
        {
          offerId,
          requestId: existingOffer.request_id,
          type: 'new_offer'
        }
      );
    }
    
    return updatedOffer as Offer;
  } catch (error) {
    return handleError(error, `Erreur lors de l'acceptation de l'offre ${offerId}`);
  }
};
```

### Dans le contexte d'authentification

```typescript
// Initialisation des notifications dans AuthContext
useEffect(() => {
  if (user) {
    const setupNotifications = async () => {
      try {
        // Enregistrer le token de l'appareil
        const token = await registerForPushNotificationsAsync();
        
        if (token) {
          // Sauvegarder le token dans Supabase
          const saved = await saveUserNotificationToken(user.id, token);
        }
      } catch (error) {
        console.error('Erreur:', error);
      }
    };
    
    setupNotifications();
    
    // Écouter les notifications...
  }
}, [user]);
```

## Évolutions futures

1. **Notifications push**
   - Intégration avec un service comme Expo Push API
   - Configuration d'un Edge Function Supabase

2. **Personnalisation avancée**
   - Personnalisation des sons
   - Périodes de silence (Ne pas déranger)

3. **Regroupement de notifications**
   - Regrouper les notifications similaires
   - Notifications résumées

4. **Analyse des notifications**
   - Taux d'ouverture
   - Efficacité des notifications

## Maintenance

Pour maintenir le système de notifications :

1. Surveiller la table `user_notification_tokens` pour les tokens expirés
2. Nettoyer périodiquement l'historique des notifications anciennes
3. S'assurer que les politiques RLS restent à jour avec l'évolution de l'application

## Ressources

- [Documentation Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Supabase Edge Functions](https://supabase.io/docs/guides/functions)