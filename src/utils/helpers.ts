import { Platform } from 'react-native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Formate une date en chaîne lisible
 * @param dateString Date ISO à formater
 * @param formatStr Format personnalisé (optionnel)
 * @returns Chaîne de date formatée
 */
export const formatDate = (dateString: string, formatStr: string = 'dd/MM/yyyy à HH:mm'): string => {
  try {
    const date = new Date(dateString);
    return format(date, formatStr, { locale: fr });
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString || '';
  }
};

/**
 * Tronque un texte à une longueur donnée et ajoute des points de suspension
 * @param text Le texte à tronquer
 * @param maxLength Longueur maximale
 * @returns Texte tronqué
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Formater un numéro de téléphone français
 * @param phone Numéro de téléphone
 * @returns Numéro formaté
 */
export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  
  // Supprimer tous les caractères non numériques
  const cleaned = phone.replace(/\D/g, '');
  
  // Format français: XX XX XX XX XX
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
  }
  
  return phone;
};

/**
 * Retarde l'exécution d'une fonction
 * @param ms Millisecondes à attendre
 * @returns Promise
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Vérifie si l'appareil est iOS
 * @returns boolean
 */
export const isIOS = (): boolean => {
  return Platform.OS === 'ios';
};

/**
 * Vérifie si l'appareil est Android
 * @returns boolean
 */
export const isAndroid = (): boolean => {
  return Platform.OS === 'android';
};

/**
 * Vérifie si l'appareil est un web
 * @returns boolean
 */
export const isWeb = (): boolean => {
  return Platform.OS === 'web';
};

/**
 * Arrondit un nombre à un certain nombre de décimales
 * @param num Nombre à arrondir
 * @param decimals Nombre de décimales (défaut: 2)
 * @returns Nombre arrondi
 */
export const roundNumber = (num: number, decimals: number = 2): number => {
  return Number(Math.round(Number(num + 'e' + decimals)) + 'e-' + decimals);
};

/**
 * Formate un prix en euros
 * @param price Prix à formater
 * @returns Prix formaté
 */
export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2
  }).format(price);
};

/**
 * Génère un identifiant unique (uuid v4 simplifié)
 * @returns Identifiant unique
 */
export const generateId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Récupère l'extension d'un fichier à partir de son nom
 * @param filename Nom du fichier
 * @returns Extension du fichier
 */
export const getFileExtension = (filename: string): string => {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
};

/**
 * Détermine le type MIME d'un fichier à partir de son extension
 * @param extension Extension du fichier
 * @returns Type MIME
 */
export const getMimeType = (extension: string): string => {
  const mimeTypes: Record<string, string> = {
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    xml: 'application/xml',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    webm: 'video/webm',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif'
  };
  
  const ext = extension.toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
};

/**
 * Renvoie un pluriel conditionnel
 * @param count Nombre d'éléments
 * @param singular Forme singulière
 * @param plural Forme plurielle
 * @returns Forme singulière ou plurielle selon le nombre
 */
export const pluralize = (count: number, singular: string, plural: string): string => {
  return count <= 1 ? singular : plural;
};