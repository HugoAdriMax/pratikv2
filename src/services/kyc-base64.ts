import supabase from '../config/supabase';

// Cette fonction récupère les données KYC d'un prestataire et les encode en base64
export const fetchKycDataAsBase64 = async (userId: string) => {
  try {
    console.log(`Récupération des données KYC pour l'utilisateur ${userId}`);
    
    // 1. Récupérer les entrées KYC pour cet utilisateur
    const { data: kycData, error } = await supabase
      .from('kyc')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (error) {
      console.error('Erreur lors de la récupération des données KYC:', error);
      return null;
    }
    
    if (!kycData || !kycData.doc_url) {
      console.log('Aucune donnée KYC trouvée ou doc_url manquant');
      return null;
    }
    
    console.log('Données KYC trouvées, doc_url type:', typeof kycData.doc_url);
    console.log('Contenu doc_url:', typeof kycData.doc_url === 'string' 
      ? kycData.doc_url.substring(0, 100) 
      : JSON.stringify(kycData.doc_url).substring(0, 100));
    
    // 2. Extraire les URLs des documents
    let idCardPath = '';
    let businessDocPath = '';
    let idCardUrl = '';
    let businessDocUrl = '';
    
    try {
      // Si c'est une chaîne JSON
      if (typeof kycData.doc_url === 'string') {
        let docObj;
        // Essayer plusieurs formats possibles
        if (kycData.doc_url.startsWith('{') || kycData.doc_url.includes('idCardUrl')) {
          const cleanedJson = kycData.doc_url.replace(/\\"/g, '"').replace(/\\/g, '');
          docObj = JSON.parse(cleanedJson);
        } else {
          // Essayer directement comme URL
          idCardUrl = kycData.doc_url;
          idCardPath = extractStoragePath(idCardUrl);
        }
        
        if (docObj) {
          if (docObj.idCardUrl) {
            idCardUrl = docObj.idCardUrl;
            idCardPath = extractStoragePath(docObj.idCardUrl);
            console.log('Chemin de la carte d\'identité extrait:', idCardPath);
          }
          
          if (docObj.businessDocUrl) {
            businessDocUrl = docObj.businessDocUrl;
            businessDocPath = extractStoragePath(docObj.businessDocUrl);
            console.log('Chemin du document professionnel extrait:', businessDocPath);
          }
        }
      } 
      // Si c'est déjà un objet
      else if (typeof kycData.doc_url === 'object' && kycData.doc_url !== null) {
        if (kycData.doc_url.idCardUrl) {
          idCardUrl = kycData.doc_url.idCardUrl;
          idCardPath = extractStoragePath(kycData.doc_url.idCardUrl);
        }
        
        if (kycData.doc_url.businessDocUrl) {
          businessDocUrl = kycData.doc_url.businessDocUrl;
          businessDocPath = extractStoragePath(kycData.doc_url.businessDocUrl);
        }
      }
    } catch (parseError) {
      console.error('Erreur lors du parsing des données KYC:', parseError);
      console.error('Contenu doc_url brut:', kycData.doc_url);
      return {
        idCardUrl,
        businessDocUrl
      };
    }
    
    // 3. Télécharger les fichiers directement depuis Supabase Storage
    const result: any = {
      idCardBase64: null,
      businessDocBase64: null,
      idCardUrl,
      businessDocUrl
    };
    
    // Méthode alternative pour les chemins basés sur les noms de fichier
    if (!idCardPath && userId) {
      // Tenter de chercher dans le dossier utilisateur directement
      try {
        // Lister les fichiers dans le dossier utilisateur
        const { data: files, error: listError } = await supabase.storage
          .from('chat-media')
          .list(`kyc-documents/${userId}`);
          
        if (!listError && files && files.length > 0) {
          console.log(`Trouvé ${files.length} fichiers dans le dossier utilisateur`);
          // Chercher un fichier qui pourrait être une carte d'identité
          const idCardFile = files.find(f => 
            f.name.toLowerCase().includes('id') || 
            f.name.toLowerCase().includes('card') || 
            f.name.toLowerCase().includes('identity'));
            
          if (idCardFile) {
            idCardPath = `kyc-documents/${userId}/${idCardFile.name}`;
            console.log('Chemin de carte d\'identité trouvé via liste:', idCardPath);
          }
          
          // Chercher un fichier qui pourrait être un document professionnel
          const businessDocFile = files.find(f => 
            f.name.toLowerCase().includes('business') || 
            f.name.toLowerCase().includes('pro') || 
            f.name.toLowerCase().includes('company') ||
            f.name.toLowerCase().includes('doc'));
            
          if (businessDocFile && businessDocFile !== idCardFile) {
            businessDocPath = `kyc-documents/${userId}/${businessDocFile.name}`;
            console.log('Chemin de document professionnel trouvé via liste:', businessDocPath);
          } else if (files.length > 1 && files[0] !== idCardFile) {
            // Prendre le premier fichier qui n'est pas la carte d'identité
            businessDocPath = `kyc-documents/${userId}/${files[0].name}`;
            console.log('Chemin de document professionnel (par défaut):', businessDocPath);
          } else if (files.length > 1 && files[1] !== idCardFile) {
            // Prendre le deuxième fichier
            businessDocPath = `kyc-documents/${userId}/${files[1].name}`;
            console.log('Chemin de document professionnel (par défaut 2):', businessDocPath);
          }
        }
      } catch (listError) {
        console.error('Erreur lors de la liste des fichiers:', listError);
      }
    }
    
    // Télécharger la carte d'identité
    if (idCardPath) {
      try {
        console.log('Tentative de téléchargement de la carte d\'identité:', idCardPath);
        const { data: idCardData, error: idCardError } = await supabase.storage
          .from('chat-media')
          .download(idCardPath);
          
        if (idCardError) {
          console.error('Erreur lors du téléchargement de la carte d\'identité:', idCardError);
        } else if (idCardData) {
          // Convertir le Blob en base64
          const base64 = await blobToBase64(idCardData);
          result.idCardBase64 = base64;
          console.log('Carte d\'identité convertie en base64, taille:', base64.length);
        }
      } catch (downloadError) {
        console.error('Exception lors du téléchargement de la carte d\'identité:', downloadError);
      }
    }
    
    // Télécharger le document professionnel
    if (businessDocPath) {
      try {
        console.log('Tentative de téléchargement du document professionnel:', businessDocPath);
        const { data: businessDocData, error: businessDocError } = await supabase.storage
          .from('chat-media')
          .download(businessDocPath);
          
        if (businessDocError) {
          console.error('Erreur lors du téléchargement du document professionnel:', businessDocError);
        } else if (businessDocData) {
          // Convertir le Blob en base64
          const base64 = await blobToBase64(businessDocData);
          result.businessDocBase64 = base64;
          console.log('Document professionnel converti en base64, taille:', base64.length);
        }
      } catch (downloadError) {
        console.error('Exception lors du téléchargement du document professionnel:', downloadError);
      }
    }
    
    // Si nous avons des URLs mais pas de base64, ajouter les URLs publiques
    if (!result.idCardBase64 && idCardPath) {
      try {
        const { data } = supabase.storage
          .from('chat-media')
          .getPublicUrl(idCardPath);
        if (data) {
          result.idCardUrl = data.publicUrl;
          console.log('URL publique pour carte d\'identité:', result.idCardUrl);
        }
      } catch (e) {
        console.error('Erreur lors de la génération de l\'URL publique:', e);
      }
    }
    
    if (!result.businessDocBase64 && businessDocPath) {
      try {
        const { data } = supabase.storage
          .from('chat-media')
          .getPublicUrl(businessDocPath);
        if (data) {
          result.businessDocUrl = data.publicUrl;
          console.log('URL publique pour document professionnel:', result.businessDocUrl);
        }
      } catch (e) {
        console.error('Erreur lors de la génération de l\'URL publique:', e);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Erreur globale dans fetchKycDataAsBase64:', error);
    return null;
  }
};

// Fonction utilitaire pour extraire le chemin du fichier à partir d'une URL
function extractStoragePath(url: string): string {
  try {
    if (!url) return '';
    
    // Nettoyer l'URL
    url = url.replace(/\\"/g, '"').replace(/\\/g, '');
    
    // Si c'est déjà un chemin sans URL, le retourner directement
    if (!url.startsWith('http')) {
      return url;
    }
    
    // Exemple d'URL: https://mkexcgwxenvzhbbopnko.supabase.co/storage/v1/object/public/chat-media/kyc-documents/USER_ID/id_card_XXX.jpg
    // Nous voulons extraire: kyc-documents/USER_ID/id_card_XXX.jpg
    
    // Trouver la position de 'chat-media/' dans l'URL
    const chatMediaIndex = url.indexOf('chat-media/');
    if (chatMediaIndex !== -1) {
      // Extraire tout ce qui suit 'chat-media/'
      return url.substring(chatMediaIndex + 11);
    }
    
    // Fallback: rechercher 'kyc-documents/' directement
    const kycDocumentsIndex = url.indexOf('kyc-documents/');
    if (kycDocumentsIndex !== -1) {
      return 'kyc-documents/' + url.substring(kycDocumentsIndex + 14);
    }
    
    console.log('Impossible d\'extraire le chemin du fichier à partir de l\'URL:', url);
    return '';
  } catch (error) {
    console.error('Erreur lors de l\'extraction du chemin:', error);
    return '';
  }
}

// Fonction pour convertir un Blob en base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Extraire uniquement la partie base64 (après data:image/jpeg;base64,)
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Fonction pour générer une source d'image à partir de base64
export const getImageSourceFromBase64 = (base64: string, mimeType = 'image/jpeg'): string => {
  if (!base64) return '';
  
  // Si le base64 inclut déjà le préfixe data:image, le retourner tel quel
  if (base64.startsWith('data:')) {
    return base64;
  }
  
  return `data:${mimeType};base64,${base64}`;
};

// Images statiques de référence à utiliser comme fallback absolu
export const STATIC_PLACEHOLDER_IMAGE = 'data:image/png;base64,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';