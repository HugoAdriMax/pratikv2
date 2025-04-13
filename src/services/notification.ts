import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import supabase from '../config/supabase';

// Configure comment les notifications sont affichées quand l'app est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Enregistre le token de l'appareil pour les notifications
export async function registerForPushNotificationsAsync() {
  // Configuration spécifique à Android
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // Dans un environnement de développement, utiliser un token fictif
  // En production, vous utiliseriez Expo.getExpoPushTokenAsync()
  const mockToken = `ExponentPushToken[${Device.deviceName || 'dev'}-${Math.random().toString(36).substring(2, 10)}]`;
  console.log('Utilisation d\'un token de notification fictif en développement:', mockToken);
  
  return mockToken;
}

// Sauvegarder le token de notification d'un utilisateur
export async function saveUserNotificationToken(userId: string, token: string) {
  try {
    const { error } = await supabase
      .from('user_notification_tokens')
      .upsert({
        user_id: userId,
        token: token,
        device_type: Platform.OS,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
        is_active: true
      }, {
        onConflict: 'user_id, token'
      });

    if (error) {
      console.error('Erreur lors de l\'enregistrement du token:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception lors de l\'enregistrement du token:', error);
    return false;
  }
}

// Envoyer une notification locale
export async function sendLocalNotification(title: string, body: string, data?: any) {
  try {
    console.log(`Envoi d'une notification locale: ${title}`);
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
      },
      trigger: null, // notification immédiate
    });
    
    console.log('Notification envoyée avec succès, ID:', notificationId);
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification locale:', error);
    
    // En cas d'erreur, on affiche quand même un message dans la console
    console.log(`[NOTIFICATION SIMULÉE] ${title}: ${body}`);
    return false;
  }
}

// Envoyer une notification à un utilisateur spécifique
export async function sendNotificationToUser(userId: string, title: string, body: string, data: any = {}) {
  try {
    // 1. Enregistrer la notification dans la base de données
    console.log('Enregistrement de notification pour', userId, ':', title);
    
    try {
      // Construire le message pour le champ 'message' (requis dans la structure actuelle)
      const notificationMessage = data.prestataire_name && data.status 
        ? `${data.prestataire_name} : ${body}` 
        : body || title || "Notification du système";
      
      // Préparer les données d'insertion avec vérification des champs obligatoires
      const insertObject: any = {
        user_id: userId,
        read: false,
        message: notificationMessage, // Utiliser un message formaté pour le champ obligatoire
        data,
      };
      
      // Ajouter les champs optionnels s'ils sont fournis
      if (title) insertObject.title = title;
      if (body) insertObject.body = body;
      
      // Ajouter un job_id si disponible
      if (data.jobId) insertObject.job_id = data.jobId;
      if (data.status) insertObject.type = data.status;
      if (data.prestataire_id) insertObject.sender_id = data.prestataire_id;

      const { data: insertData, error: dbError } = await supabase
        .from('notifications')
        .insert(insertObject)
        .select();
        
      if (dbError) {
        console.error('Erreur lors de l\'enregistrement de la notification:', dbError);
        
        // Vérifier si la table existe
        const { count, error: checkError } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true });
          
        if (checkError) {
          console.error('La table notifications semble ne pas exister:', checkError);
        } else {
          console.log('La table notifications existe, contient', count, 'enregistrements');
          
          // Vérifier les contraintes de la table
          const { data: tableInfo, error: tableError } = await supabase.rpc('get_table_structure', { 
            table_name: 'notifications' 
          });
          
          if (tableError) {
            console.error('Impossible de vérifier la structure de la table:', tableError);
          } else if (tableInfo) {
            console.log('Structure de la table notifications:', tableInfo);
          }
        }
      } else {
        console.log('Notification enregistrée avec succès:', insertData);
      }
    } catch (error) {
      console.error('Exception lors de l\'enregistrement de la notification:', error);
    }
    
    // 2. Envoyer une notification locale si l'utilisateur est sur le même appareil
    // (En production, vous utiliseriez Expo Push API ou Firebase Cloud Messaging)
    const currentUser = await supabase.auth.getUser();
    if (currentUser?.data?.user?.id === userId) {
      await sendLocalNotification(title, body, data);
    }
    
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification à l\'utilisateur:', error);
    return false;
  }
}

// Récupérer les notifications d'un utilisateur
export async function getUserNotifications(userId: string, limit = 20, offset = 0) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
      
    if (error) {
      console.error('Erreur lors de la récupération des notifications:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Exception lors de la récupération des notifications:', error);
    return null;
  }
}

// Marquer une notification comme lue
export async function markNotificationAsRead(notificationId: string) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
      
    if (error) {
      console.error('Erreur lors du marquage de la notification comme lue:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception lors du marquage de la notification comme lue:', error);
    return false;
  }
}

// Fonction pour gérer les notifications entrantes
export function handleNotification(notification: Notifications.Notification) {
  // Traitement de la notification reçue
  const data = notification.request.content.data;
  
  console.log('Notification reçue avec données:', data);
  
  // Logique basée sur le type de notification
  if (data && data.type) {
    switch (data.type) {
      case 'new_offer':
        console.log('Notification de nouvelle offre');
        return {
          type: 'navigate',
          screen: 'RequestDetail',
          params: { requestId: data.requestId }
        };
        
      case 'status_update':
        console.log('Notification de mise à jour de statut');
        return {
          type: 'navigate',
          screen: 'JobTracking',
          params: { jobId: data.jobId }
        };
        
      // Pour le prestataire, assurer que les notifications lead au bon écran
      case 'job_update':
        console.log('Notification de mise à jour de job');
        return {
          type: 'navigate',
          screen: 'PrestataireTabs',
          params: { 
            screen: 'MyJobs',
            params: {
              screen: 'JobTracking',
              params: { jobId: data.jobId }
            }
          }
        };
        
      case 'message':
        console.log('Notification de nouveau message');
        return {
          type: 'navigate',
          screen: 'Chat',
          params: { chatId: data.chatId }
        };
        
      case 'payment_received':
        console.log('Notification de paiement reçu');
        return {
          type: 'navigate',
          screen: 'PrestataireTabs',
          params: {
            screen: 'Statistics'
          }
        };
        
      case 'payment_received_group':
        console.log('Notification de paiements groupés reçus');
        return {
          type: 'navigate',
          screen: 'PrestataireTabs',
          params: {
            screen: 'Statistics',
            params: {
              showPaymentDetails: true,
              paymentData: {
                totalAmount: data.totalAmount,
                count: data.paymentCount,
                payments: data.recentPayments
              }
            }
          }
        };
        
      default:
        console.log('Type de notification non reconnu:', data.type);
        return { type: 'display' };
    }
  }
  
  return { type: 'display' };
}

// Récupérer et mettre à jour les préférences de notification d'un utilisateur
export async function getUserNotificationPreferences(userId: string) {
  try {
    const { data, error } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
      
    if (error) {
      console.error('Erreur lors de la récupération des préférences de notification:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Exception lors de la récupération des préférences de notification:', error);
    return null;
  }
}

// Vérifier s'il existe une notification de paiement récente non lue
async function checkRecentPaymentNotifications(prestataireId: string, timeWindowMinutes = 60) {
  try {
    // Obtenir l'heure limite (x minutes dans le passé)
    const timeWindow = new Date();
    timeWindow.setMinutes(timeWindow.getMinutes() - timeWindowMinutes);
    
    // Récupérer les notifications récentes
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', prestataireId)
      .eq('read', false)
      .gt('created_at', timeWindow.toISOString())
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Erreur lors de la vérification des notifications récentes:', error);
      return null;
    }
    
    // Filtrer les notifications de paiement
    if (data && data.length > 0) {
      const paymentNotifications = data.filter(notif => 
        notif.data && notif.data.type === 'payment_received'
      );
      
      if (paymentNotifications.length > 0) {
        return paymentNotifications;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Exception lors de la vérification des notifications récentes:', error);
    return null;
  }
}

// Envoyer une notification de paiement reçu au prestataire
export async function sendPaymentReceivedNotification(
  prestataireId: string, 
  amount: number, 
  jobId: string, 
  serviceName: string,
  clientName: string
) {
  try {
    // Formater le montant en euros
    const formattedAmount = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);

    // Vérifier les préférences de notification de l'utilisateur
    const preferences = await getUserNotificationPreferences(prestataireId);
    
    // Si l'utilisateur n'a pas désactivé les notifications de statut
    if (!preferences || preferences.status_updates !== false) {
      // Vérifier s'il existe des notifications de paiement récentes
      const recentPaymentNotifications = await checkRecentPaymentNotifications(prestataireId);
      
      let title, body, data;
      
      if (recentPaymentNotifications && recentPaymentNotifications.length > 0) {
        // Notification groupée
        const totalCount = recentPaymentNotifications.length + 1;
        const totalAmount = recentPaymentNotifications.reduce((sum, notif) => 
          sum + (notif.data.amount || 0), amount);
          
        // Formater le montant total
        const formattedTotalAmount = new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR'
        }).format(totalAmount);
        
        title = `💰 ${totalCount} paiements reçus`;
        body = `Vous avez reçu ${formattedTotalAmount} au total pour vos services récents.`;
        
        // Données pour la notification groupée
        data = {
          type: 'payment_received_group',
          jobIds: [...recentPaymentNotifications.map(n => n.data.jobId), jobId],
          totalAmount,
          paymentCount: totalCount,
          recentPayments: [...recentPaymentNotifications.map(n => ({
            amount: n.data.amount,
            serviceName: n.data.serviceName,
            clientName: n.data.clientName
          })), {
            amount,
            serviceName,
            clientName
          }],
          screen: 'Statistics' // Pour naviguer vers l'écran des statistiques
        };
        
        // Marquer les notifications précédentes comme lues
        for (const notif of recentPaymentNotifications) {
          await markNotificationAsRead(notif.id);
        }
      } else {
        // Notification individuelle
        title = '💰 Paiement reçu';
        body = `Vous avez reçu ${formattedAmount} pour votre service "${serviceName}" de la part de ${clientName}.`;
        
        // Données supplémentaires pour la navigation
        data = {
          type: 'payment_received',
          jobId,
          amount,
          serviceName,
          clientName,
          screen: 'Statistics' // Pour naviguer vers l'écran des statistiques
        };
      }
      
      // Envoyer la notification
      await sendNotificationToUser(prestataireId, title, body, data);
      
      console.log(`Notification de paiement envoyée au prestataire ${prestataireId} pour ${formattedAmount}`);
      return true;
    } else {
      console.log(`Notifications désactivées pour l'utilisateur ${prestataireId}`);
      return false;
    }
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification de paiement:', error);
    return false;
  }
}

// Mettre à jour les préférences de notification d'un utilisateur
export async function updateNotificationPreferences(userId: string, preferences: any) {
  try {
    const { error } = await supabase
      .from('user_notification_preferences')
      .update({
        ...preferences,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
      
    if (error) {
      console.error('Erreur lors de la mise à jour des préférences de notification:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception lors de la mise à jour des préférences de notification:', error);
    return false;
  }
}