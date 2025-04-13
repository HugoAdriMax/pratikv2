import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  Modal,
  ScrollView,
  Image,
  Animated,
  Easing
} from 'react-native';
import supabase from '../../config/supabase';
import { KYCStatus } from '../../types';
import { COLORS, FONTS, SIZES, SHADOWS, SPACING } from '../../utils/theme';
import { Text } from '../../components/ui';
import { fetchKycDataAsBase64, getImageSourceFromBase64 } from '../../services/kyc-base64';
import { Ionicons } from '@expo/vector-icons';

interface KycItem {
  id: string;
  user_id: string;
  doc_url: string;
  status: KYCStatus;
  created_at: string;
  user?: {
    email: string;
    phone?: string;
    name?: string;
    address?: string;
    business_reg_number?: string;
  };
  base64Data?: {
    idCardBase64?: string;
    businessDocBase64?: string;
  };
  services?: any[]; // Pour stocker les services du prestataire
}

const KycVerificationScreen = ({ navigation }: any) => {
  const [kycItems, setKycItems] = useState<KycItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KycItem | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageType, setSelectedImageType] = useState<'idCard' | 'businessDoc' | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [directImageUrl, setDirectImageUrl] = useState<string | null>(null);
  const [showServicesModal, setShowServicesModal] = useState(false);
  
  // Animation pour le loader
  const spinAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Animation de rotation pour le loader
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 4000, // Rotation plus lente pour un effet plus élégant
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();
  }, []);

  const fetchPendingKyc = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('kyc')
        .select('*, user:user_id(email, phone, name, address, business_reg_number)')
        .eq('status', KYCStatus.PENDING)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      
      console.log("Documents KYC récupérés:", data?.length || 0);
      
      // Pour chaque élément KYC, récupérer les images en base64 et analyser le JSON
      const enhancedData = await Promise.all((data || []).map(async (item) => {
        try {
          console.log(`Récupération des données base64 pour l'utilisateur ${item.user_id}`);
          
          // Analyser le doc_url pour voir si les données base64 sont déjà incluses
          let existingBase64 = null;
          if (item.doc_url && typeof item.doc_url === 'string') {
            try {
              const cleanedJson = item.doc_url.replace(/\\"/g, '"').replace(/\\/g, '');
              const docData = JSON.parse(cleanedJson);
              console.log("Structure des données KYC:", Object.keys(docData));
              
              // Vérifier si les données base64 sont présentes
              if (docData.idCardBase64 || docData.businessDocBase64) {
                console.log("Données base64 trouvées directement dans doc_url!");
                existingBase64 = {
                  idCardBase64: docData.idCardBase64,
                  businessDocBase64: docData.businessDocBase64
                };
              }
            } catch(jsonError) {
              console.error("Erreur parsing JSON:", jsonError);
            }
          }
          
          // Si le base64 est déjà présent, l'utiliser
          if (existingBase64) {
            return {
              ...item,
              base64Data: existingBase64
            };
          }
          
          // Sinon, utiliser la méthode habituelle
          const base64Data = await fetchKycDataAsBase64(item.user_id);
          return {
            ...item,
            base64Data: base64Data || undefined
          };
        } catch (e) {
          console.error(`Erreur lors de la récupération des données base64 pour ${item.user_id}:`, e);
          return item;
        }
      }));
      
      setKycItems(enhancedData as KycItem[]);
    } catch (error) {
      console.error('Error fetching pending KYC:', error);
      Alert.alert('Erreur', 'Impossible de récupérer les vérifications KYC en attente');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPendingKyc();
    setRefreshing(false);
  };

  const handleApprove = async (item: KycItem) => {
    try {
      // Get admin user id
      let admin_id = null;
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          admin_id = authData.user.id;
        }
      } catch (authError) {
        console.error("Erreur lors de la récupération de l'utilisateur authentifié:", authError);
      }
      
      // Mettre à jour le statut du KYC
      const { error: kycError } = await supabase
        .from('kyc')
        .update({ status: KYCStatus.VERIFIED })
        .eq('id', item.id);
        
      if (kycError) throw kycError;
      
      // Mettre à jour le statut de vérification de l'utilisateur
      const { error: userError } = await supabase
        .from('users')
        .update({ is_verified: true })
        .eq('id', item.user_id);
        
      if (userError) throw userError;
      
      // Activer également le prestataire avec la fonction RPC
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'manage_prestataire_status',
        {
          prestataire_id: item.user_id,
          new_status: 'approved',
          admin_id: admin_id,
          notes_param: 'Approuvé par un administrateur via vérification KYC'
        }
      );
      
      if (rpcError) {
        console.error('Erreur lors de l\'activation du prestataire:', rpcError);
        // On continue malgré l'erreur pour ne pas bloquer le processus
      } else {
        console.log('Prestataire activé avec succès:', rpcResult);
      }
      
      // Mettre à jour la liste locale
      setKycItems(prev => prev.filter(kyc => kyc.id !== item.id));
      
      Alert.alert('Succès', 'Le prestataire a été approuvé et activé avec succès');
    } catch (error) {
      console.error('Error approving KYC:', error);
      Alert.alert('Erreur', 'Impossible d\'approuver le prestataire');
    }
  };

  const handleReject = async (item: KycItem) => {
    try {
      // Mettre à jour le statut du KYC
      const { error: kycError } = await supabase
        .from('kyc')
        .update({ status: KYCStatus.REJECTED })
        .eq('id', item.id);
        
      if (kycError) throw kycError;
      
      // Mettre à jour la liste locale
      setKycItems(prev => prev.filter(kyc => kyc.id !== item.id));
      
      Alert.alert('Succès', 'La demande a été rejetée');
    } catch (error) {
      console.error('Error rejecting KYC:', error);
      Alert.alert('Erreur', 'Impossible de rejeter la demande');
    }
  };

  useEffect(() => {
    fetchPendingKyc();
    
    // Rafraîchir lors du focus sur l'écran
    const unsubscribe = navigation.addListener('focus', () => {
      fetchPendingKyc();
    });

    return unsubscribe;
  }, [navigation]);

  // Utilitaire pour parser les documents KYC
  const parseKycDocuments = (docUrl: any) => {
    let documents = { idCardUrl: '', businessDocUrl: '' };
    
    try {
      console.log("Parsing docUrl type:", typeof docUrl);
      
      if (typeof docUrl === 'string') {
        try {
          // Tenter de parser comme JSON
          // Nettoyer d'abord les caractères d'échappement potentiels
          const cleanedJson = docUrl.replace(/\\"/g, '"').replace(/\\/g, '');
          documents = JSON.parse(cleanedJson);
          console.log("Document JSON parsé avec succès:", documents);
        } catch (e) {
          // Si ce n'est pas du JSON valide, considérer comme URL simple
          console.error("Erreur de parsing JSON:", e);
          documents.idCardUrl = docUrl;
          console.log("Considéré comme URL simple:", documents);
        }
      } else if (docUrl && typeof docUrl === 'object') {
        // Si c'est déjà un objet (parfois Supabase retourne déjà l'objet JSON parsé)
        documents = docUrl;
        console.log("Document déjà au format objet:", documents);
      }
      
      // Nettoyer les URLs des caractères d'échappement
      if (documents.idCardUrl && typeof documents.idCardUrl === 'string') {
        documents.idCardUrl = documents.idCardUrl.replace(/\\/g, '');
        console.log("ID Card URL originale:", documents.idCardUrl);
        
        // Supprimer les paramètres d'URL existants
        documents.idCardUrl = documents.idCardUrl.split('?')[0];
        
        // Vérifier si l'URL vient de Supabase Storage
        if (documents.idCardUrl.includes('supabase.co/storage/v1/object/public')) {
          // Ajouter le paramètre ?download=true pour essayer de forcer l'affichage
          documents.idCardUrl = `${documents.idCardUrl}?download=true&t=${Date.now()}`;
        }
      } else {
        console.warn("ID Card URL manquante");
      }
      
      if (documents.businessDocUrl && typeof documents.businessDocUrl === 'string') {
        documents.businessDocUrl = documents.businessDocUrl.replace(/\\/g, '');
        console.log("Business Doc URL originale:", documents.businessDocUrl);
        
        // Supprimer les paramètres d'URL existants
        documents.businessDocUrl = documents.businessDocUrl.split('?')[0];
        
        // Vérifier si l'URL vient de Supabase Storage
        if (documents.businessDocUrl.includes('supabase.co/storage/v1/object/public')) {
          // Ajouter le paramètre ?download=true pour essayer de forcer l'affichage
          documents.businessDocUrl = `${documents.businessDocUrl}?download=true&t=${Date.now()}`;
        }
      } else {
        console.log("Business Doc URL manquante (peut être normal)");
      }
      
      console.log("URLs finales préparées:", {
        idCardUrl: documents.idCardUrl,
        businessDocUrl: documents.businessDocUrl
      });
    } catch (e) {
      console.error("Erreur lors du parsing des documents:", e);
      if (typeof docUrl === 'string') {
        documents.idCardUrl = docUrl;
      }
    }
    
    return documents;
  };

  // Fonction pour télécharger et convertir l'image directement
  const getImageAsBase64 = async (userId: string, filename: string): Promise<string | null> => {
    try {
      console.log(`Tentative de récupération directe en base64 pour ${userId}/${filename}`);
      
      // Essayer de récupérer tous les fichiers dans le dossier utilisateur
      const { data: files, error } = await supabase
        .storage
        .from('chat-media')
        .list(`kyc-documents/${userId}`);
        
      if (error || !files || files.length === 0) {
        console.log(`Aucun fichier trouvé dans le dossier de l'utilisateur ${userId}`);
        return null;
      }
      
      console.log(`${files.length} fichiers trouvés:`, files.map(f => f.name).join(', '));
      
      // Chercher un fichier qui correspond au type recherché
      let targetFile = null;
      if (filename === 'id_card') {
        targetFile = files.find(f => 
          f.name.toLowerCase().includes('id') || 
          f.name.toLowerCase().includes('card') || 
          f.name.toLowerCase().includes('identity') ||
          f.name.toLowerCase().includes('id_card')
        );
      } else if (filename === 'business_doc') {
        targetFile = files.find(f => 
          f.name.toLowerCase().includes('business') || 
          f.name.toLowerCase().includes('doc') || 
          f.name.toLowerCase().includes('siret') ||
          f.name.toLowerCase().includes('business_doc')
        );
      }
      
      if (!targetFile) {
        console.log(`Aucun fichier correspondant à ${filename} trouvé`);
        
        // Si on ne trouve pas de fichier qui correspond exactement, prendre le premier fichier
        if (files.length > 0) {
          targetFile = files[0];
          console.log(`Utilisation du premier fichier par défaut: ${targetFile.name}`);
        } else {
          return null;
        }
      }
      
      console.log(`Fichier trouvé: ${targetFile.name}`);
      
      // Télécharger directement le fichier
      const filePath = `kyc-documents/${userId}/${targetFile.name}`;
      const { data, error: downloadError } = await supabase.storage
        .from('chat-media')
        .download(filePath);
        
      if (downloadError || !data) {
        console.error(`Erreur téléchargement du fichier:`, downloadError);
        return null;
      }
      
      console.log(`Fichier téléchargé, conversion en base64...`);
      
      // Convertir le blob en base64
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          console.log(`Conversion en base64 réussie, taille: ${base64.length} caractères`);
          resolve(base64);
        };
        reader.readAsDataURL(data);
      });
    } catch (e) {
      console.error(`Erreur lors de la récupération directe de l'image: ${e}`);
      return null;
    }
  };

  const renderItem = ({ item }: { item: KycItem }) => {
    // Formatez la date
    const date = new Date(item.created_at);
    const formattedDate = date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Analyser les documents
    const documents = parseKycDocuments(item.doc_url);
    
    // Date relative (il y a X jours)
    const getDaysAgo = () => {
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return "Aujourd'hui";
      if (diffDays === 1) return "Hier";
      return `Il y a ${diffDays} jours`;
    };
    
    return (
      <View style={styles.kycCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.userIconContainer}>
              <Ionicons name="person" size={24} color={COLORS.primary} />
            </View>
            <View>
              <Text variant="h6" weight="semibold" color="text">{item.user?.email}</Text>
              <Text variant="caption" color="text-secondary" style={styles.dateRelative}>{getDaysAgo()}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.statusBadge}>
          <Text variant="caption" weight="bold" color="danger" style={styles.statusText}>EN ATTENTE</Text>
        </View>
        
        <View style={styles.cardDivider} />
        
        <View style={styles.businessInfoContainer}>
          {item.user?.name && (
            <View style={styles.infoRow}>
              <Ionicons name="business-outline" size={20} color={COLORS.primary} style={styles.infoIcon} />
              <Text variant="body2" weight="semibold" color="text">{item.user.name}</Text>
            </View>
          )}
          
          {item.user?.business_reg_number && (
            <View style={styles.infoRow}>
              <Ionicons name="card-outline" size={20} color={COLORS.textSecondary} style={styles.infoIcon} />
              <Text variant="body3" color="text-secondary">SIRET: {item.user.business_reg_number}</Text>
            </View>
          )}
          
          {item.user?.phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} style={styles.infoIcon} />
              <Text variant="body3" color="text-secondary">{item.user.phone}</Text>
            </View>
          )}
          
          {item.user?.address && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color={COLORS.textSecondary} style={styles.infoIcon} />
              <Text variant="body3" color="text-secondary">{item.user.address}</Text>
            </View>
          )}

          {/* Bouton pour voir les services */}
          <TouchableOpacity 
            style={[styles.infoRow, styles.servicesButton]}
            onPress={async () => {
              try {
                // Récupérer les services du prestataire
                const { data, error } = await supabase.rpc(
                  'get_prestataire_services',
                  { p_prestataire_id: item.user_id }
                );
                
                if (error) throw error;
                
                // Traiter les données des services
                let processedServices = [];
                
                if (Array.isArray(data)) {
                  processedServices = data.map((item: any) => {
                    // Si l'item est un objet JSON
                    if (item && typeof item === 'object') {
                      // Si les données sont sous la forme { service: { ... } }
                      const serviceData = item.service || item;
                      
                      return {
                        id: serviceData.id || '',
                        name: serviceData.name || 'Service sans nom',
                        category: serviceData.category || 'Autre',
                        description: serviceData.description || '',
                        is_selected: true
                      };
                    }
                    return null;
                  }).filter(Boolean);
                }
                
                // Ouvrir la popup des services
                setSelectedItem({
                  ...item,
                  services: processedServices
                });
                setShowServicesModal(true);
              } catch (error) {
                console.error('Erreur lors de la récupération des services:', error);
                Alert.alert('Erreur', 'Impossible de récupérer les services sélectionnés');
              }
            }}
          >
            <Ionicons name="list" size={20} color={COLORS.primary} style={styles.infoIcon} />
            <Text variant="body3" color="primary" style={{fontWeight: 'bold'}}>Voir les services sélectionnés</Text>
          </TouchableOpacity>
        </View>
        
        <Text variant="body2" weight="semibold" color="text" style={styles.documentsTitle}>
          Documents à vérifier
        </Text>
        
        <View style={styles.documentsContainer}>
          <TouchableOpacity 
            style={styles.documentCard}
            activeOpacity={0.9}
            onPress={() => {
              // Initialiser l'état
              setLoading(true);
              setImageLoadError(false);
              setDirectImageUrl(null);
              setSelectedImageType('idCard');
              
              // Si on a déjà des données base64 dans l'item, les utiliser directement
              if (item.base64Data?.idCardBase64) {
                console.log("Utilisation du base64 stocké");
                
                // Ici le problème potentiel: vérifier le format
                const base64 = item.base64Data.idCardBase64;
                console.log("Format du base64:", typeof base64, 
                  base64 ? `Début: ${base64.substring(0, 30)}...` : 'null');
                
                // Si c'est déjà une data URI complète (commence par data:image)
                if (base64 && typeof base64 === 'string' && base64.startsWith('data:image')) {
                  console.log("Le base64 est déjà au format data:image");
                  setSelectedImage(base64);
                } else if (base64 && typeof base64 === 'string') {
                  // Si c'est juste une chaîne base64, la convertir en data URI
                  console.log("Conversion du base64 en data:image");
                  setSelectedImage(getImageSourceFromBase64(base64));
                } else {
                  console.log("Format de base64 non reconnu:", typeof base64);
                  // Utiliser URL comme fallback
                  if (documents.idCardUrl) {
                    setSelectedImage(documents.idCardUrl);
                  }
                }
                
                setDirectImageUrl(null);
                setLoading(false);
              } 
              // Sinon, essayer de télécharger directement
              else {
                // Essayons directement la méthode de téléchargement en base64
                getImageAsBase64(item.user_id, 'id_card').then(base64 => {
                  if (base64) {
                    console.log("Image récupérée directement en base64");
                    setSelectedImage(base64);
                    setDirectImageUrl(null);
                  } else if (documents.idCardUrl) {
                    // Dernier recours: URL standard
                    console.log("Utilisation de l'URL standard");
                    setSelectedImage(documents.idCardUrl);
                  } else {
                    // Pas d'image du tout
                    console.log("Aucune image disponible");
                    setSelectedItem(item);
                  }
                  setLoading(false);
                }).catch(err => {
                  console.error("Erreur lors de la récupération de l'image:", err);
                  setLoading(false);
                  
                  // Fallbacks en cas d'erreur
                  if (documents.idCardUrl) {
                    setSelectedImage(documents.idCardUrl);
                  } else {
                    setSelectedItem(item);
                  }
                });
              }
            }}
          >
            <View style={styles.docImage}>
              <Image 
                source={item.base64Data?.idCardBase64 
                  ? { uri: getImageSourceFromBase64(item.base64Data.idCardBase64) }
                  : documents.idCardUrl 
                    ? { uri: documents.idCardUrl }
                    : require('../../../assets/icon.png')
                }
                style={styles.docImageContent}
                resizeMode="cover"
              />
              {/* Console log pour debug */}
              {console.log('Rendu image ID:', {
                base64Disponible: !!item.base64Data?.idCardBase64,
                urlDocuments: documents.idCardUrl ? documents.idCardUrl.substring(0, 50) + '...' : 'aucune',
                userId: item.user_id
              })}
              <View style={styles.docOverlay}>
                <Ionicons name="eye" size={22} color={COLORS.white} />
              </View>
            </View>
            <Text variant="body3" weight="semibold" color="text" style={styles.docLabel}>
              Pièce d'identité
            </Text>
          </TouchableOpacity>
          
          {documents.businessDocUrl && (
            <TouchableOpacity 
              style={styles.documentCard}
              activeOpacity={0.9}
              onPress={() => {
                // Initialiser l'état
                setLoading(true);
                setImageLoadError(false);
                setDirectImageUrl(null);
                setSelectedImageType('businessDoc');
                
                // Si on a déjà des données base64 dans l'item, les utiliser directement
                if (item.base64Data?.businessDocBase64) {
                  console.log("Utilisation du base64 du document professionnel stocké");
                  
                  // Ici le problème potentiel: vérifier le format
                  const base64 = item.base64Data.businessDocBase64;
                  console.log("Format du base64 du document professionnel:", typeof base64, 
                    base64 ? `Début: ${base64.substring(0, 30)}...` : 'null');
                  
                  // Si c'est déjà une data URI complète (commence par data:image)
                  if (base64 && typeof base64 === 'string' && base64.startsWith('data:image')) {
                    console.log("Le base64 du document professionnel est déjà au format data:image");
                    setSelectedImage(base64);
                  } else if (base64 && typeof base64 === 'string') {
                    // Si c'est juste une chaîne base64, la convertir en data URI
                    console.log("Conversion du base64 du document professionnel en data:image");
                    setSelectedImage(getImageSourceFromBase64(base64));
                  } else {
                    console.log("Format de base64 du document professionnel non reconnu:", typeof base64);
                    // Utiliser URL comme fallback
                    if (documents.businessDocUrl) {
                      setSelectedImage(documents.businessDocUrl);
                    }
                  }
                  
                  setLoading(false);
                } 
                // Sinon, essayer de télécharger directement
                else {
                  // Essayons directement la méthode de téléchargement en base64
                  getImageAsBase64(item.user_id, 'business_doc').then(base64 => {
                    if (base64) {
                      console.log("Document professionnel récupéré directement en base64");
                      setSelectedImage(base64);
                    } else if (documents.businessDocUrl) {
                      // Dernier recours: URL standard
                      console.log("Utilisation de l'URL standard du document professionnel");
                      setSelectedImage(documents.businessDocUrl);
                    } else {
                      // Pas d'image du tout
                      console.log("Aucun document professionnel disponible");
                      setSelectedItem(item);
                    }
                    
                    setLoading(false);
                }).catch(err => {
                  console.error("Erreur lors de la récupération du document professionnel:", err);
                  
                  // Fallbacks en cas d'erreur
                  if (item.base64Data?.businessDocBase64) {
                    setSelectedImage(getImageSourceFromBase64(item.base64Data.businessDocBase64));
                  } else if (documents.businessDocUrl) {
                    setSelectedImage(documents.businessDocUrl);
                  } else {
                    setSelectedItem(item);
                  }
                  
                  setLoading(false);
                });
              }
            }}
            >
              <View style={styles.docImage}>
                <Image 
                  source={item.base64Data?.businessDocBase64 
                    ? { uri: getImageSourceFromBase64(item.base64Data.businessDocBase64) }
                    : documents.businessDocUrl 
                      ? { uri: documents.businessDocUrl }
                      : require('../../../assets/icon.png')
                  }
                  style={styles.docImageContent}
                  resizeMode="cover"
                />
                <View style={styles.docOverlay}>
                  <Ionicons name="eye" size={22} color={COLORS.white} />
                </View>
              </View>
              <Text variant="body3" weight="semibold" color="text" style={styles.docLabel}>
                Document professionnel
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => {
              Alert.alert(
                'Rejeter la demande',
                'Êtes-vous sûr de vouloir rejeter cette demande de vérification ?',
                [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Rejeter', style: 'destructive', onPress: () => handleReject(item) }
                ]
              );
            }}
          >
            <Ionicons name="close-circle" size={20} color={COLORS.danger} style={{marginRight: 8}} />
            <Text style={styles.rejectButtonText}>Rejeter</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => {
              Alert.alert(
                'Approuver le prestataire',
                'Êtes-vous sûr de vouloir approuver ce prestataire ?',
                [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Approuver', onPress: () => handleApprove(item) }
                ]
              );
            }}
          >
            <Ionicons name="checkmark-circle" size={20} color={COLORS.white} style={{marginRight: 8}} />
            <Text style={styles.approveButtonText}>Approuver</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    // Interpolation pour la rotation
    const spin = spinAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg']
    });

    return (
      <View style={styles.loaderContainer}>
        <Animated.View 
          style={[
            styles.loaderImageContainer,
            { transform: [{ rotate: spin }] }
          ]}
        >
          <Image 
            source={require('../../../assets/icon.png')} 
            style={styles.loaderImage}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="shield-checkmark" size={24} color={COLORS.primary} style={styles.headerIcon} />
          <Text variant="h3" weight="semibold" color="text">Vérifications KYC</Text>
        </View>
        <Text variant="body2" color="text-secondary" style={styles.headerSubtitle}>
          Analysez et approuvez les documents d'identité des prestataires
        </Text>
      </View>
      
      {kycItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="checkmark-circle" size={60} color={COLORS.success} />
          </View>
          <Text variant="h5" weight="semibold" color="success" style={styles.emptyTitle}>
            Tout est à jour
          </Text>
          <Text variant="body2" color="text-secondary" style={styles.emptyText}>
            Aucune vérification KYC en attente actuellement
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
              <View style={styles.summaryIconContainer}>
                <Ionicons name="document-text" size={24} color={COLORS.white} />
              </View>
              <View style={styles.summaryContent}>
                <Text variant="h4" weight="bold" color="text">{kycItems.length}</Text>
                <Text variant="body3" color="text-secondary">
                  {kycItems.length === 1 ? 'Document à vérifier' : 'Documents à vérifier'}
                </Text>
              </View>
            </View>
          </View>
          
          <FlatList
            data={kycItems}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          />
        </>
      )}
      
      {/* Modal pour afficher une seule image en plein écran */}
      {selectedImage && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={!!selectedImage}
          onRequestClose={() => {
            setSelectedImage(null);
            setSelectedImageType(null);
            setImageLoadError(false);
          }}
        >
          <View style={styles.imageModalOverlay}>
            <TouchableOpacity 
              style={styles.imageContainer} 
              activeOpacity={1}
            >
              {/* Image en plein écran - utiliser la même approche que pour les miniatures */}
              <Image 
                source={selectedImage.startsWith('data:') 
                  ? { uri: selectedImage } 
                  : { uri: `${selectedImage}&t=${Date.now()}` }
                }
                style={styles.fullScreenImage}
                resizeMode="contain"
                onError={(e) => {
                  console.log('Erreur de chargement d\'image:', e.nativeEvent.error);
                  console.log('URI de l\'image:', selectedImage ? selectedImage.substring(0, 100) + '...' : 'null');
                  setImageLoadError(true);
                }}
                onLoad={() => {
                  console.log('Image chargée avec succès en plein écran');
                  setImageLoadError(false);
                }}
              />
              
              {/* Debugging image détails */}
              <View style={{ position: 'absolute', top: 5, left: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 5, borderRadius: 5 }}>
                <Text style={{ color: 'white', fontSize: 10 }}>
                  {`Type: ${selectedImageType === 'idCard' ? 'Pièce d\'identité' : 'Document professionnel'}`}
                </Text>
                <Text style={{ color: 'white', fontSize: 10 }}>
                  {`Format: ${selectedImage.startsWith('data:') ? 'base64' : 'URL'}`}
                </Text>
                <Text style={{ color: 'white', fontSize: 10 }}>
                  {`Taille: ${selectedImage ? selectedImage.length : 0} caractères`}
                </Text>
              </View>
              
              {/* Utiliser une image de secours en cas d'erreur et si pas d'URL de secours */}
              {imageLoadError && !directImageUrl && (
                <View style={styles.errorContainer}>
                  <Image 
                    source={require('../../../assets/icon.png')}
                    style={styles.backupImage}
                  />
                  <Text style={styles.errorText}>
                    Erreur de chargement de l'image
                  </Text>
                </View>
              )}
              
              {/* Debug de l'image */}
              {console.log('Affichage image plein écran:', {
                uri: selectedImage ? selectedImage.substring(0, 50) + '...' : 'null',
                type: selectedImageType,
                format: selectedImage?.startsWith('data:') ? 'base64' : 'URL',
                length: selectedImage?.length || 0
              })}
            </TouchableOpacity>
            
            <View style={styles.controlsContainer}>
              {/* Bouton pour fermer le modal */}
              <TouchableOpacity 
                style={styles.closeFullScreenButton}
                onPress={() => {
                  setSelectedImage(null);
                  setSelectedImageType(null);
                  setImageLoadError(false);
                }}
              >
                <Ionicons name="close-circle" size={36} color={COLORS.white} />
                <Text style={styles.closeModalText}>Fermer</Text>
              </TouchableOpacity>
              
              {/* Informations sur le type d'image */}
              <Text style={styles.imageTypeText}>
                {selectedImageType === 'idCard' ? 'Pièce d\'identité' : 'Document professionnel'}
              </Text>
            </View>
            
            {/* Bouton pour fermer en touchant n'importe où */}
            <TouchableOpacity 
              style={styles.fullScreenTouchArea} 
              activeOpacity={1}
              onPress={() => {
                setSelectedImage(null);
                setSelectedImageType(null);
                setImageLoadError(false);
              }}
            />
          </View>
        </Modal>
      )}
      
      {/* Modal de sauvegarde pour afficher les documents en cas d'erreur */}
      {selectedItem && !selectedImage && !showServicesModal && (
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedItem(null)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Documents du prestataire</Text>
            
            {(() => {
              // Utiliser la même fonction de parsing
              const documents = parseKycDocuments(selectedItem.doc_url);
              
              return (
                <>
                  <Text style={styles.modalSubtitle}>Pièce d'identité</Text>
                  <View style={styles.fullImage}>
                    <Image 
                      source={selectedItem?.base64Data?.idCardBase64 
                        ? { uri: getImageSourceFromBase64(selectedItem.base64Data.idCardBase64) }
                        : documents.idCardUrl 
                          ? { uri: `${documents.idCardUrl}${documents.idCardUrl.includes('?') ? '&' : '?'}t=${Date.now()}` }
                          : require('../../../assets/icon.png')
                      }
                      style={styles.docImageLarge}
                      resizeMode="contain"
                    />
                  </View>
                  
                  {documents.businessDocUrl && (
                    <>
                      <Text style={styles.modalSubtitle}>Document professionnel</Text>
                      <View style={styles.fullImage}>
                        <Image 
                          source={selectedItem?.base64Data?.businessDocBase64 
                            ? { uri: getImageSourceFromBase64(selectedItem.base64Data.businessDocBase64) }
                            : documents.businessDocUrl 
                              ? { uri: `${documents.businessDocUrl}${documents.businessDocUrl.includes('?') ? '&' : '?'}t=${Date.now()}` }
                              : require('../../../assets/icon.png')
                          }
                          style={styles.docImageLarge}
                          resizeMode="contain"
                        />
                      </View>
                    </>
                  )}
                </>
              );
            })()}
            
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setSelectedItem(null)}
            >
              <Text style={styles.closeButtonText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
      
      {/* Modal pour afficher les services */}
      {showServicesModal && selectedItem && (
        <View style={styles.modalOverlay}>
          <View style={styles.servicesModalContainer}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 15,
              width: '100%'
            }}>
              <View style={{flex: 1}}>
                <Text style={{fontSize: 22, fontWeight: 'bold', color: COLORS.primary}}>Services proposés</Text>
                <Text style={{fontSize: 14, color: '#666666', marginTop: 4}}>
                  {selectedItem.user?.email || 'Prestataire'}
                </Text>
              </View>
              <TouchableOpacity 
                style={{
                  width: 36, 
                  height: 36, 
                  borderRadius: 18,
                  backgroundColor: `${COLORS.light}80`,
                  justifyContent: 'center', 
                  alignItems: 'center',
                }}
                onPress={() => {
                  setShowServicesModal(false);
                  setSelectedItem(null);
                }}
              >
                <Ionicons name="close" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            
            <View style={{
              height: 3,
              backgroundColor: `${COLORS.primary}20`,
              marginBottom: 15,
              borderRadius: 10
            }} />
            
            {!selectedItem.services || selectedItem.services.length === 0 ? (
              <View style={{
                flex: 1, 
                justifyContent: 'center', 
                alignItems: 'center',
                padding: 20,
                backgroundColor: '#f8fafc'
              }}>
                <View style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: '#f1f5f9',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 20
                }}>
                  <Ionicons name="list-outline" size={40} color={COLORS.textSecondary} />
                </View>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: '600', 
                  color: '#334155',
                  marginBottom: 12
                }}>
                  Aucun service sélectionné
                </Text>
                <Text style={{ 
                  fontSize: 14, 
                  color: '#64748b', 
                  textAlign: 'center',
                  maxWidth: '80%',
                  lineHeight: 20
                }}>
                  Ce prestataire n'a pas encore sélectionné de services à proposer.
                </Text>
              </View>
            ) : (
              <ScrollView 
                style={styles.servicesScrollView}
                contentContainerStyle={{paddingBottom: 20}}
                showsVerticalScrollIndicator={true}
              >
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: `${COLORS.primary}10`,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  marginBottom: 16,
                  marginHorizontal: 8
                }}>
                  <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} style={{marginRight: 8}} />
                  <Text style={{
                    fontSize: 14,
                    color: COLORS.primary, 
                    fontWeight: '500'
                  }}>
                    {selectedItem.services.length} service{selectedItem.services.length > 1 ? 's' : ''} sélectionné{selectedItem.services.length > 1 ? 's' : ''}
                  </Text>
                </View>
                
                {(() => {
                  // Grouper les services par catégorie
                  const groupedByCategory: Record<string, any[]> = {};
                  
                  selectedItem.services.forEach(service => {
                    const category = service.category || 'Autre';
                    if (!groupedByCategory[category]) {
                      groupedByCategory[category] = [];
                    }
                    groupedByCategory[category].push(service);
                  });
                  
                  // Rendu des catégories et services
                  return Object.entries(groupedByCategory).map(([category, services]) => (
                    <View key={category} style={{ marginBottom: 20 }}>
                      <View style={{
                        backgroundColor: COLORS.primary,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        marginBottom: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginHorizontal: 8
                      }}>
                        <Ionicons name="grid-outline" size={18} color="#fff" style={{marginRight: 8}} />
                        <Text style={{ 
                          fontSize: 16, 
                          fontWeight: 'bold', 
                          color: '#fff' 
                        }}>{category}</Text>
                      </View>
                      
                      {services.map(service => (
                        <View key={service.id} style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: '#fff',
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 8,
                          marginHorizontal: 8,
                          borderWidth: 1,
                          borderColor: '#e2e8f0',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.1,
                          shadowRadius: 2,
                          elevation: 2
                        }}>
                          <View style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: `${COLORS.success}15`,
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 12
                          }}>
                            <Ionicons name="checkmark" size={22} color={COLORS.success} />
                          </View>
                          <View style={{flex: 1}}>
                            <Text style={{ 
                              fontSize: 15, 
                              color: '#334155', 
                              fontWeight: '600',
                              marginBottom: 2,
                              flexWrap: 'wrap'
                            }}>{service.name}</Text>
                            {service.description && (
                              <Text style={{ 
                                fontSize: 13, 
                                color: '#64748b',
                                lineHeight: 18,
                                flexWrap: 'wrap'
                              }}>
                                {service.description}
                              </Text>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  ));
                })()}
              </ScrollView>
            )}
            
            <TouchableOpacity
              style={{
                height: 50,
                backgroundColor: COLORS.primary,
                borderRadius: 12,
                justifyContent: 'center',
                alignItems: 'center',
                marginTop: 16,
                flexDirection: 'row'
              }}
              activeOpacity={0.7}
              onPress={() => {
                setShowServicesModal(false);
                setSelectedItem(null);
              }}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{marginRight: 6}} />
              <Text style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: '600'
              }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  servicesModalContainer: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    minHeight: 600,
    maxHeight: '90%',
    padding: 24,
    ...SHADOWS.medium,
  },
  servicesScrollView: {
    flex: 1,
    backgroundColor: '#ffffff',
    minHeight: 400,
    maxHeight: 600,
  },
  servicesButton: {
    marginTop: 8,
    backgroundColor: `${COLORS.primary}10`,
    padding: 8,
    borderRadius: 8,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loaderImageContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    borderRadius: 100, // Cercle parfait
    overflow: 'hidden',
    backgroundColor: 'rgba(18, 73, 182, 0.1)', // Bleu très léger
  },
  loaderImage: {
    width: 180,
    height: 180,
    backgroundColor: '#1249b6', // Même couleur que le logo
    borderRadius: 0, // Pas de bord arrondi pour l'image
  },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 18,
    ...SHADOWS.small,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerIcon: {
    marginRight: 12,
  },
  headerSubtitle: {
    opacity: 0.7,
    marginTop: 5,
  },
  summaryContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    ...SHADOWS.small,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  summaryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  summaryContent: {
    flex: 1,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${COLORS.success}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    marginBottom: 10,
  },
  emptyText: {
    textAlign: 'center',
    maxWidth: '80%',
  },
  listContainer: {
    padding: 16,
  },
  kycCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: `${COLORS.primary}10`,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dateRelative: {
    marginTop: 3,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: `${COLORS.danger}15`,
    borderWidth: 1,
    borderColor: `${COLORS.danger}30`,
    alignSelf: 'flex-start',
    marginTop: 2,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  cardDivider: {
    height: 1,
    backgroundColor: `${COLORS.border}50`,
    marginVertical: 15,
  },
  businessInfoContainer: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoIcon: {
    width: 24,
    marginRight: 10,
  },
  documentsTitle: {
    marginBottom: 12,
  },
  documentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  documentCard: {
    width: '48%',
  },
  docImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: COLORS.light,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    position: 'relative',
  },
  docOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.7,
  },
  docImageContent: {
    width: '100%',
    height: '100%',
    opacity: 1,
  },
  docImageLarge: {
    width: '100%',
    height: '100%',
    opacity: 1,
    borderRadius: 8,
  },
  docLabel: {
    fontSize: 14,
    color: '#555',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
    height: 48,
    ...SHADOWS.small,
  },
  rejectButton: {
    backgroundColor: `${COLORS.danger}10`,
    borderWidth: 1.5,
    borderColor: COLORS.danger,
  },
  rejectButtonText: {
    color: COLORS.danger,
    fontWeight: 'bold',
    fontSize: 15,
  },
  approveButton: {
    backgroundColor: COLORS.success,
    borderWidth: 1.5,
    borderColor: `${COLORS.success}80`,
  },
  approveButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '90%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#000',
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    alignSelf: 'flex-start',
    color: '#444',
  },
  fullImage: {
    width: '100%',
    height: 400,
    marginBottom: 20,
    borderRadius: 8,
    backgroundColor: COLORS.light,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  closeButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  imageModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 20,
  },
  imageContainer: {
    width: '100%',
    height: '70%',
    backgroundColor: '#222',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#444',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 10,
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#111', // Add background to make image more visible
    borderRadius: 8,         // Rounded corners for better appearance
  },
  backupImage: {
    width: 100,
    height: 100,
    opacity: 0.3,
  },
  controlsContainer: {
    width: '100%',
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeFullScreenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 10,
    borderRadius: 8,
  },
  closeModalText: {
    color: COLORS.white,
    marginLeft: 8,
    fontWeight: 'bold',
  },
  imageTypeText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    backgroundColor: COLORS.primary + '80',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    color: COLORS.white,
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  fullScreenTouchArea: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1, // Sous les autres éléments pour ne pas interférer
  },
});

export default KycVerificationScreen;