import supabase from '../config/supabase';
import * as FileSystem from 'expo-file-system';

// Cette fonction récupère et prépare l'affichage des documents KYC
// Inspirée du mécanisme de chat qui fonctionne correctement
export const getKycDocumentWithFallback = async (
  userId: string,
  docUrl: string | any
): Promise<{ displayUrl: string, base64Data?: string }> => {
  try {
    console.log('getKycDocumentWithFallback - docUrl brut:', typeof docUrl === 'string' ? docUrl.substring(0, 100) + '...' : JSON.stringify(docUrl));
    
    // Étape 1: Extraire l'URL correcte selon le format
    let imageUrl = '';
    
    // Si c'est une chaîne JSON
    if (typeof docUrl === 'string' && (docUrl.startsWith('{') || docUrl.includes('idCardUrl'))) {
      try {
        // Nettoyer d'abord les caractères d'échappement
        const cleanedJson = docUrl.replace(/\\"/g, '"').replace(/\\/g, '');
        const parsed = JSON.parse(cleanedJson);
        
        // Extraire les URLs
        if (parsed.idCardUrl) {
          imageUrl = parsed.idCardUrl;
        } else if (parsed.businessDocUrl) {
          imageUrl = parsed.businessDocUrl;
        }
        
        console.log('URL extraite du JSON:', imageUrl);
      } catch (jsonError) {
        console.error('Erreur parsing JSON:', jsonError);
        imageUrl = docUrl; // Utiliser la chaîne brute en cas d'échec
      }
    } 
    // Si c'est déjà un objet
    else if (typeof docUrl === 'object' && docUrl !== null) {
      if (docUrl.idCardUrl) {
        imageUrl = docUrl.idCardUrl;
      } else if (docUrl.businessDocUrl) {
        imageUrl = docUrl.businessDocUrl;
      }
      console.log('URL extraite de l\'objet:', imageUrl);
    }
    // Sinon, utiliser directement la chaîne
    else if (typeof docUrl === 'string') {
      imageUrl = docUrl;
    }
    
    // Si aucune URL n'a été extraite, abandonner
    if (!imageUrl) {
      console.log('Aucune URL valide trouvée dans les données');
      return { displayUrl: '' };
    }
    
    // Étape 2: Nettoyer l'URL de tous caractères problématiques
    const cleanedUrl = imageUrl.replace(/\\"/g, '"').replace(/\\/g, '');
    console.log('URL nettoyée:', cleanedUrl);
    
    // Étape 3: Ajouter un paramètre de timestamp
    const finalUrl = `${cleanedUrl}${cleanedUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
    console.log('URL finale:', finalUrl);
    
    // Étape 4: Essayer de convertir l'image en base64 comme fallback
    // C'est l'approche utilisée dans le chat qui fonctionne
    try {
      console.log('Tentative de conversion en base64 via downloadAsync...');
      
      // Télécharger l'image
      const tempFileUri = FileSystem.cacheDirectory + `temp_kyc_${Date.now()}.jpg`;
      const downloadResult = await FileSystem.downloadAsync(finalUrl, tempFileUri);
      
      if (downloadResult.status === 200) {
        // Lire le fichier téléchargé en base64
        const base64 = await FileSystem.readAsStringAsync(tempFileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        console.log('Image téléchargée et convertie en base64, taille:', base64.length);
        
        // Nettoyer le fichier temporaire
        await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
        
        // Retourner l'URL et les données base64
        return {
          displayUrl: finalUrl,
          base64Data: `data:image/jpeg;base64,${base64}`
        };
      } else {
        console.log('Échec du téléchargement:', downloadResult.status);
      }
    } catch (base64Error) {
      console.error('Erreur lors de la conversion en base64:', base64Error);
    }
    
    // Retourner l'URL sans base64 si la conversion a échoué
    return { displayUrl: finalUrl };
  } catch (error) {
    console.error('Erreur dans getKycDocumentWithFallback:', error);
    return { displayUrl: '' };
  }
};

// Fonction pour afficher les documents KYC dans l'interface admin
export const fetchAndPrepareKycDocuments = async (userId: string, docData: any) => {
  try {
    // Traiter les URLs spécifiques selon le type de document
    const result: any = {
      idCard: null,
      businessDoc: null
    };
    
    // Traiter la carte d'identité
    if (docData && (docData.idCardUrl || (typeof docData === 'object' && docData.idCardUrl))) {
      const idCardUrl = typeof docData === 'object' ? docData.idCardUrl : docData;
      const idCardResult = await getKycDocumentWithFallback(userId, idCardUrl);
      result.idCard = idCardResult;
    }
    
    // Traiter le document professionnel
    if (docData && (docData.businessDocUrl || (typeof docData === 'object' && docData.businessDocUrl))) {
      const businessDocUrl = typeof docData === 'object' ? docData.businessDocUrl : docData;
      const businessDocResult = await getKycDocumentWithFallback(userId, businessDocUrl);
      result.businessDoc = businessDocResult;
    }
    
    return result;
  } catch (error) {
    console.error('Erreur dans fetchAndPrepareKycDocuments:', error);
    return { idCard: null, businessDoc: null };
  }
};