# Système de vérification KYC

Ce document détaille le système de vérification KYC (Know Your Customer) pour les prestataires de la plateforme.

## Vue d'ensemble

Le système KYC permet de vérifier l'identité et les informations professionnelles des prestataires avant qu'ils ne puissent proposer des services sur la plateforme. Ce processus comprend:

1. Soumission de documents par le prestataire
2. Stockage sécurisé dans Supabase Storage
3. Vérification par un administrateur
4. Activation du compte prestataire

## Architecture technique

### Tables de base de données

- **users** - Contient les informations de base des utilisateurs
- **kyc** - Stocke les références aux documents soumis par les prestataires
- **prestataire_activations** - Gère les demandes d'activation et leur statut

### Stockage

Les documents KYC sont stockés dans le bucket `chat-media` dans le dossier `kyc-documents/{user_id}/`.

### Format des données

Les références aux documents sont stockées dans la colonne `doc_url` de la table `kyc` au format JSON:

```json
{
  "idCardUrl": "https://[supabase-url]/storage/v1/object/public/chat-media/kyc-documents/[user_id]/id_card_[user_id]_[timestamp].jpg",
  "businessDocUrl": "https://[supabase-url]/storage/v1/object/public/chat-media/kyc-documents/[user_id]/business_doc_[user_id]_[timestamp].jpg"
}
```

## Résolution des problèmes d'affichage des documents

### Problème

Les documents KYC ne s'affichaient pas correctement dans l'interface d'administration en raison de:

1. Problèmes de permissions de stockage Supabase
2. Configuration CORS incorrecte
3. Caractères d'échappement (\\) dans les URLs stockées

### Solution

La solution comprend:

#### 1. Correction des permissions de stockage

```sql
-- Rendre le bucket public pour un accès anonyme aux images
UPDATE storage.buckets
SET public = true
WHERE id = 'chat-media';

-- Créer une politique d'accès en lecture pour tous
CREATE POLICY "Public Access to chat-media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-media');
```

#### 2. Configuration CORS

```sql
-- Permettre les requêtes Cross-Origin
UPDATE storage.buckets
SET cors_origins = array['*'],
    cors_methods = array['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    cors_allowed_headers = array['*']
WHERE id = 'chat-media';
```

#### 3. Nettoyage des caractères d'échappement

Dans le code React Native:

```javascript
// Nettoyer l'URL des caractères d'échappement
const cleanUrl = typeof url === 'string' ? url.replace(/\\/g, '') : url;
```

Dans SQL pour les données existantes:

```sql
-- Nettoyer les caractères d'échappement dans les données existantes
UPDATE public.kyc
SET doc_url = REPLACE(CAST(doc_url AS text), '\', '')
WHERE doc_url::text LIKE '%\\%';
```

## Composants React Native

### KycDocumentImage

Un composant spécialisé pour afficher les images KYC avec plusieurs méthodes de fallback:

1. Affichage direct de l'URL
2. Conversion en base64 pour les fichiers locaux
3. Nettoyage des caractères d'échappement
4. Gestion des différents formats de stockage (URL directe ou objet JSON)

### Utilisation du composant

```jsx
<KycDocumentImage
  uri={documents.idCardUrl || ''}
  userId={item.user_id}
  style={styles.docImage}
  defaultSource={require('../../../assets/icon.png')}
/>
```

## Script de correction complet

Un script SQL complet `fix_kyc_display.sql` a été créé pour résoudre tous les problèmes de permission, CORS et format de données en une seule opération.

### Exécution du script

1. Accédez à la console SQL de votre projet Supabase
2. Copiez-collez le contenu du fichier `fix_kyc_display.sql`
3. Exécutez le script
4. Redémarrez votre application avec un cache propre: `npx expo start -c`

## Bonnes pratiques pour le futur

1. Toujours utiliser le composant `KycDocumentImage` pour afficher des documents KYC
2. S'assurer que le bucket `chat-media` reste configuré comme public
3. Nettoyer les caractères d'échappement des URLs avant de les stocker ou de les afficher
4. Vérifier régulièrement les permissions de stockage et CORS dans Supabase