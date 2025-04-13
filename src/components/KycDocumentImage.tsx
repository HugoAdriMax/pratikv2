import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Text } from 'react-native';
import { COLORS, BORDER_RADIUS, SHADOWS, SPACING } from '../utils/theme';
import supabase from '../config/supabase';
import * as FileSystem from 'expo-file-system';

interface KycDocumentImageProps {
  uri: string;
  userId: string;
  onPress?: () => void;
  style?: any;
  defaultSource?: any; // Source à utiliser en cas d'erreur
}

// Composant optimisé pour afficher les images KYC avec fallback en base64
const KycDocumentImage: React.FC<KycDocumentImageProps> = ({ 
  uri, 
  userId,
  onPress, 
  style,
  defaultSource = require('../../assets/icon.png')
}) => {
  const [imageUrl, setImageUrl] = useState<string>(uri);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [base64Data, setBase64Data] = useState<string | null>(null);

  // Récupérer l'URL publique à partir d'un chemin de fichier
  const getPublicUrl = (filePath: string) => {
    try {
      if (!filePath) return null;
      
      // Préparer le chemin du fichier
      let path = filePath;
      
      // Traiter différents formats de chemin
      if (path.startsWith('http')) {
        // C'est déjà une URL complète, la retourner telle quelle
        return path;
      } else if (path.includes('kyc-documents')) {
        // Le chemin contient déjà kyc-documents, utiliser tel quel
      } else if (path.startsWith('/')) {
        // Chemin absolu, enlever le premier slash
        path = path.substring(1);
      } else {
        // Chemin relatif, ajouter le préfixe
        path = `kyc-documents/${userId}/${path}`;
      }
      
      console.log("Getting public URL for path:", path);
      const { data } = supabase.storage.from('chat-media').getPublicUrl(path);
      console.log("Public URL generated:", data.publicUrl);
      return data.publicUrl;
    } catch (error) {
      console.error("Erreur lors de la récupération de l'URL publique:", error);
      return null;
    }
  };

  // Lire directement le fichier local en base64 (méthode qui fonctionne dans le chat)
  const readFileAsBase64 = async (fileUri: string): Promise<string | null> => {
    try {
      if (!fileUri) return null;
      
      // Seulement pour les fichiers locaux, pas pour les URLs
      if (fileUri.startsWith('http')) {
        console.log("readFileAsBase64: les URLs ne sont pas supportées");
        return null;
      }
      
      console.log("Lecture du fichier en base64:", fileUri);
      
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      if (!base64 || base64.length === 0) {
        console.log("Fichier vide ou non lisible");
        return null;
      }
      
      console.log("Fichier lu avec succès en base64, taille:", base64.length);
      return base64;
    } catch (error) {
      console.error("Erreur lors de la lecture du fichier:", error);
      return null;
    }
  };
  
  // Récupérer une URL publique pour un chemin Supabase
  const getStorageUrl = (filePath: string): string | null => {
    try {
      if (!filePath) return null;
      
      // Déjà une URL
      if (filePath.startsWith('http')) {
        // Ajouter un timestamp pour éviter la mise en cache des URLs
        return `${filePath}${filePath.includes('?') ? '&' : '?'}t=${Date.now()}`;
      }
      
      // IMPORTANT: Les documents KYC sont stockés dans le bucket 'chat-media' sous le dossier 'kyc-documents'
      // Préparer le chemin du fichier
      let path = filePath;
      
      // Traiter différents formats de chemin
      if (path.includes('kyc-documents')) {
        // Le chemin contient déjà kyc-documents, utiliser tel quel
        console.log("Chemin contient déjà kyc-documents:", path);
      } else if (path.startsWith('/')) {
        // Chemin absolu, enlever le premier slash
        path = path.substring(1);
      } else if (userId) {
        // Chemin relatif, ajouter le préfixe pour le KYC si userId disponible
        path = `kyc-documents/${userId}/${path}`;
      } else {
        // Si pas d'userId fourni et pas de chemin complet, essayer le chemin directement
        console.log("Pas d'ID utilisateur fourni, utilisation du chemin direct:", path);
      }
      
      console.log("Génération d'URL publique pour:", path);
      
      // Utiliser getPublicUrl de Supabase (méthode synchrone)
      const { data } = supabase.storage.from('chat-media').getPublicUrl(path);
      
      if (!data || !data.publicUrl) {
        console.log("Impossible de générer l'URL publique");
        return null;
      }
      
      const publicUrl = data.publicUrl;
      console.log("URL publique générée:", publicUrl);
      
      // Ajouter un timestamp pour éviter la mise en cache
      const finalUrl = `${publicUrl}?t=${Date.now()}`;
      return finalUrl;
    } catch (error) {
      console.error("Erreur lors de la génération de l'URL:", error);
      return null;
    }
  };

  // Vérifier et préparer l'image selon la méthode du chat
  useEffect(() => {
    let isMounted = true;
    
    const prepareImage = async () => {
      if (!isMounted) return;
      setLoading(true);
      setError(false);
      
      try {
        if (!uri || uri.trim() === '') {
          console.log("URI vide");
          if (isMounted) setError(true);
          return;
        }
        
        console.log("Préparation de l'image pour URI:", uri);
        
        // VÉRIFICATION JSON: spécial pour les documents KYC
        if (typeof uri === 'string' && uri.startsWith('{')) {
          try {
            console.log("Tentative de parse JSON de l'URI");
            
            // Essayons de nettoyer avant le parsing
            const cleanedJsonStr = uri.replace(/\\"/g, '"').replace(/\\/g, '');
            console.log("URI JSON nettoyé avant parsing:", cleanedJsonStr);
            
            const parsed = JSON.parse(cleanedJsonStr);
            console.log("URI JSON parsé avec succès:", JSON.stringify(parsed, null, 2));
            
            // Extraire l'URL si c'est un objet avec idCardUrl ou businessDocUrl
            if (parsed.idCardUrl || parsed.businessDocUrl) {
              const targetUrl = parsed.idCardUrl || parsed.businessDocUrl;
              console.log("URL extraite du JSON KYC:", targetUrl);
              if (targetUrl && isMounted) {
                // Nettoyer tout caractère d'échappement restant
                const cleanUrl = typeof targetUrl === 'string' ? 
                  targetUrl.replace(/\\"/g, '"').replace(/\\/g, '') : targetUrl;
                console.log("URL finale nettoyée:", cleanUrl);
                setImageUrl(cleanUrl);
                setLoading(false);
                return;
              }
            }
          } catch (jsonError) {
            console.log("Erreur parse JSON:", jsonError);
            // Continuer avec d'autres méthodes si le parsing échoue
          }
        }
        
        // APPROCHE 1: URI est un fichier local (comme dans le chat après prise de photo)
        if (!uri.startsWith('http') && uri.startsWith('file://')) {
          console.log("URI est un fichier local");
          
          // 1. Utiliser directement le fichier local comme URI
          if (isMounted) setImageUrl(uri);
          
          // 2. Essayer aussi de lire en base64 comme fallback
          try {
            const base64 = await readFileAsBase64(uri);
            if (base64 && isMounted) {
              const dataUrl = `data:image/jpeg;base64,${base64}`;
              setBase64Data(dataUrl);
              console.log("Fichier local lu en base64");
            }
          } catch (e) {
            console.log("Erreur lecture fichier local en base64:", e);
          }
          
          return;
        }
        
        // APPROCHE 2: URI est une URL complète 
        if (uri.startsWith('http')) {
          console.log("URI est une URL complète");
          
          // Utiliser directement l'URL
          if (isMounted) setImageUrl(uri);
          return;
        }
        
        // APPROCHE 3: URI est un chemin Supabase Storage
        console.log("URI est un chemin Supabase");
        
        // Tenter de générer une URL publique
        const storageUrl = getStorageUrl(uri);
        if (storageUrl) {
          console.log("URL publique générée:", storageUrl);
          if (isMounted) setImageUrl(storageUrl);
          return;
        }
        
        // Si tout échoue, marquer comme erreur
        console.log("Impossible de charger l'image");
        if (isMounted) setError(true);
      } catch (e) {
        console.error("Erreur préparation image:", e);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    if (uri) {
      prepareImage();
    } else {
      setError(true);
      setLoading(false);
    }
    
    return () => {
      isMounted = false;
    };
  }, [uri, userId]);

  // Gérer l'erreur d'image en utilisant base64 comme fallback (comme dans le chat)
  const handleImageError = () => {
    console.log("Erreur de chargement d'image pour URL:", imageUrl);
    
    // Tenter d'utiliser l'image base64 si disponible
    if (base64Data) {
      console.log("Utilisation du fallback base64");
      // Vérifier que l'URL actuelle n'est pas déjà le base64
      if (imageUrl !== base64Data) {
        setImageUrl(base64Data);
        return;
      }
    }
    
    // Si base64 non disponible ou déjà essayé, marquer comme erreur
    console.log("Fallback échoué, affichage de l'état d'erreur");
    setError(true);
  };

  // Fonction pour déterminer si une chaîne base64 est valide
  const isValidBase64 = (str: string): boolean => {
    try {
      // Vérifier si la chaîne commence par le préfixe data:image
      if (!str || !str.startsWith('data:image')) return false;
      
      // Vérifier la longueur minimale (une image valide doit avoir une certaine taille)
      const base64Part = str.split(',')[1];
      return base64Part && base64Part.length > 100;
    } catch (e) {
      return false;
    }
  };

  // Debugger l'état actuel
  console.log("Rendu KycDocumentImage:", {
    uri: uri.substring(0, 50) + "...",
    loading,
    error,
    imageUrl: imageUrl ? imageUrl.substring(0, 50) + "..." : "none",
    hasBase64: !!base64Data
  });

  // Si l'URL actuelle commence par https://mkexcgwxenvzhbbopnko.supabase.co/
  // Essayons d'y ajouter un paramètre d'authentification ou utiliser une approche différente
  let finalImageUrl = imageUrl;
  if (imageUrl && imageUrl.includes('mkexcgwxenvzhbbopnko.supabase.co')) {
    // IMPORTANT: Nettoyer l'URL - supprimer tout caractère d'échappement ET les guillemets
    let cleanedUrl = imageUrl.replace(/\\|"/g, '');
    console.log("URL originale:", imageUrl);
    console.log("URL nettoyée:", cleanedUrl);
    
    // Essayer de contourner le problème CORS en ajoutant un paramètre aléatoire
    finalImageUrl = `${cleanedUrl}${cleanedUrl.includes('?') ? '&' : '?'}bypass=${Date.now()}`;
    console.log("URL finale utilisée:", finalImageUrl);
  }

  // Supprimons la logique de test externe qui cause des problèmes de connectivité

  // Si une erreur s'est produite, nous pouvons soit:
  // 1. Afficher un message d'erreur plutôt que l'icône par défaut
  // 2. Ne pas afficher d'image du tout pour éviter la confusion
  if (error) {
    return (
      <TouchableOpacity 
        style={[styles.container, style]} 
        onPress={onPress}
        disabled={!onPress}
      >
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Document non disponible</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      style={[styles.container, style]} 
      onPress={onPress}
      disabled={loading || !onPress}
    >
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} />
      ) : (
        <View style={styles.imageWrapper}>
          {/* Version simplifiée avec gestion d'erreur directe */}
          <Image
            source={{ uri: finalImageUrl }}
            style={styles.image}
            resizeMode="cover"
            onError={(e) => {
              console.log(`ERREUR IMAGE: ${e.nativeEvent.error}`);
              setError(true); // Marquer comme erreur directement
            }}
            defaultSource={Platform.OS === 'android' ? defaultSource : undefined}
          />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 120,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.light + '80',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    width: '50%',
    height: '50%',
    opacity: 0.7,
  },
  errorContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.light,
  },
  errorImage: {
    width: 40,
    height: 40,
    opacity: 0.5,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.secondary,
    textAlign: 'center',
    paddingHorizontal: 10
  }
});

export default KycDocumentImage;