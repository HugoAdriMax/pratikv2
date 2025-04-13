import supabase from '../config/supabase';
import { ChatMessage } from '../types';
import { sendNotificationToUser, getUserNotificationPreferences } from './notification';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

// Helper pour gérer les erreurs
const handleError = (error: any, message: string): never => {
  console.error(`${message}:`, error);
  throw new Error(message);
};

export const sendMessage = async (
  jobId: string,
  senderId: string,
  receiverId: string,
  content: string,
  imageUri?: string
): Promise<ChatMessage & { base64_image?: string, temp_display_url?: string }> => {
  try {
    let imageUrl: string | undefined = undefined;
    let tempDisplayUrl: string | undefined = undefined;
    let base64Image: string | undefined = undefined;
    
    // Si une image est fournie, l'uploader d'abord
    if (imageUri) {
      const imageResult = await uploadChatImage(imageUri, jobId);
      imageUrl = imageResult.storageUrl; // URL stockée en base de données
      tempDisplayUrl = imageResult.displayUrl; // URL modifiée pour l'affichage
      base64Image = imageResult.base64Data; // Donnée base64 de l'image
      console.log('Image URL pour la BDD:', imageUrl);
      console.log('Image URL pour l\'affichage:', tempDisplayUrl);
      console.log('Taille des données base64:', base64Image?.length || 0);
    }
    
    // Créer un message dans la base de données avec JSON additionnel
    const messageData = {
      job_id: jobId,
      sender_id: senderId,
      receiver_id: receiverId,
      content: content,
      image_url: imageUrl, // URL Supabase dans la BDD
      is_read: false,
      // Ajouter métadonnées dans une colonne JSONB pour stocker la base64
      meta: imageUri ? { 
        has_image: true,
        image_base64: base64Image
      } : null
    };
    
    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();

    if (error) throw error;

    // Envoyer une notification au destinataire
    try {
      // Vérifier les préférences de notification du destinataire
      const preferences = await getUserNotificationPreferences(receiverId);
      if (!preferences || preferences.messages !== false) {
        await sendNotificationToUser(
          receiverId,
          'Nouveau message',
          content.length > 50 ? `${content.substring(0, 47)}...` : content,
          {
            type: 'message',
            jobId: jobId,
            senderId: senderId
          }
        );
      }
    } catch (notificationError) {
      console.error('Erreur lors de l\'envoi de la notification:', notificationError);
      // Ne pas bloquer l'envoi du message si la notification échoue
    }

    // Ajouter les données d'image supplémentaires au message
    const messageWithImages = {
      ...data as ChatMessage,
      temp_display_url: tempDisplayUrl,
      base64_image: base64Image
    };
    
    return messageWithImages;
  } catch (error) {
    return handleError(error, 'Erreur lors de l\'envoi du message');
  }
};

export const getMessagesByJobId = async (jobId: string): Promise<ChatMessage[]> => {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data as ChatMessage[];
  } catch (error) {
    return handleError(error, `Erreur lors de la récupération des messages pour le job ${jobId}`);
  }
};

export const markMessagesAsRead = async (
  jobId: string,
  userId: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('job_id', jobId)
      .eq('receiver_id', userId)
      .eq('is_read', false);

    if (error) throw error;
  } catch (error) {
    return handleError(error, 'Erreur lors du marquage des messages comme lus');
  }
};

export const getUnreadMessagesCount = async (userId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Erreur lors du comptage des messages non lus:', error);
    return 0; // En cas d'erreur, on renvoie 0 pour ne pas bloquer l'interface
  }
};

// Fonction pour sélectionner une image depuis la galerie
export const pickImage = async (): Promise<string | null> => {
  try {
    // Demander les permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      console.error('Permission refusée pour accéder à la galerie');
      return null;
    }
    
    // Lancer le sélecteur d'images
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      return result.assets[0].uri;
    }
    
    return null;
  } catch (error) {
    console.error('Erreur lors de la sélection de l\'image:', error);
    return null;
  }
};

// Fonction pour prendre une photo avec la caméra
export const takePhoto = async (): Promise<string | null> => {
  try {
    // Demander les permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      console.error('Permission refusée pour accéder à la caméra');
      return null;
    }
    
    // Lancer la caméra
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets && result.assets.length > 0) {
      return result.assets[0].uri;
    }
    
    return null;
  } catch (error) {
    console.error('Erreur lors de la prise de photo:', error);
    return null;
  }
};

// Fonction pour uploader une image vers Supabase Storage

export const uploadChatImage = async (uri: string, jobId: string): Promise<{ storageUrl: string, displayUrl: string, base64Data: string }> => {
  try {
    console.log('URI original:', uri);
    
    // Vérifier le format de l'image
    let fileExt = 'jpeg'; // Extension par défaut
    if (uri.includes('.')) {
      fileExt = uri.split('.').pop()?.toLowerCase() || 'jpeg';
    }
    
    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const fileName = `image_${timestamp}.${fileExt}`;
    const filePath = `chat-images/${jobId}/${fileName}`;
    console.log('Chemin du fichier:', filePath);
    
    // Lire le fichier en base64
    console.log('Lecture du fichier...');
    const fileData = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log('Fichier lu, taille:', fileData.length, 'octets');
    
    if (fileData.length === 0) {
      throw new Error('Fichier vide');
    }
    
    // Uploader vers Supabase
    console.log('Tentative d\'upload vers:', `chat-media/${filePath}`);
    
    let uploadSuccess = false;
    let publicUrl = '';
    
    try {
      const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(filePath, fileData, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: true,
        });
      
      if (error) {
        console.error('Erreur détaillée upload:', JSON.stringify(error));
        console.log("L'upload vers Storage a échoué, mais l'image sera quand même disponible en base64");
      } else {
        uploadSuccess = true;
        console.log('Upload réussi, données:', data);
      }
    } catch (uploadError) {
      console.error('Exception pendant l\'upload:', uploadError);
      console.log("Exception lors de l'upload, mais l'image sera quand même disponible en base64");
    }
    
    // Récupérer l'URL publique
    const { data: urlData } = supabase.storage
      .from('chat-media')
      .getPublicUrl(filePath);
    
    if (!urlData || !urlData.publicUrl) {
      throw new Error('URL publique non générée');
    }
    
    // Solution hybride:
    // 1. Stocker l'URL Supabase dans l'objet du message (pour persistance)
    // 2. Retourner une URL transformée qui sera plus compatible
    
    // Construire URL Supabase directe avec quelques modifications pour améliorer la compatibilité
    // On réutilise la variable publicUrl déjà déclarée ligne 236
    publicUrl = urlData.publicUrl;
    
    // Remplacer le domaine Supabase par une URL compatible avec les objets publics
    // Enlever query parameters potentiels
    if (publicUrl.includes('?')) {
      publicUrl = publicUrl.split('?')[0];
    }
    
    // Ajouter un timestamp pour éviter la mise en cache
    const finalUrl = `${publicUrl}?t=${Date.now()}`;
    
    console.log('URL Supabase modifiée:', finalUrl);
    
    // On va stocker et renvoyer la même URL dans la base de données et pour l'affichage
    // Nous allons coder en base64 l'image originale et l'ajouter comme fallback
    
    // Encoder l'image en base64 pour la stocker avec le message
    console.log('Encodage de l\'image en base64 comme fallback...');
    // Réutiliser la variable fileData déjà déclarée plutôt que d'en créer une nouvelle
    const base64Image = `data:image/jpeg;base64,${fileData}`;
    
    return {
      storageUrl: publicUrl, // URL Supabase à stocker
      displayUrl: finalUrl,  // URL Supabase modifiée pour affichage
      base64Data: base64Image // Données base64 comme fallback
    };
  } catch (error) {
    console.error('Erreur lors de l\'upload de l\'image:', error);
    throw new Error('Impossible d\'uploader l\'image');
  }
};

export const listenToNewMessages = (
  jobId: string,
  callback: (message: ChatMessage) => void
) => {
  const channel = supabase
    .channel(`job-${jobId}-messages`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `job_id=eq.${jobId}`
      },
      (payload) => {
        callback(payload.new as ChatMessage);
      }
    )
    .subscribe();

  // Retourner une fonction pour se désabonner plus tard
  return () => {
    supabase.removeChannel(channel);
  };
};