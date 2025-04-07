# Plateforme de mise en relation Client / Prestataire

Une application mobile complète pour mettre en relation des clients avec des prestataires de services, avec chatbot intégré, suivi en temps réel, et paiement sécurisé.

## 🚀 Technologies utilisées

- **Frontend Mobile**: React Native avec Expo
- **Base de données**: Supabase (PostgreSQL)
- **Authentification**: Supabase Auth
- **Stockage**: Supabase Storage
- **Paiement**: Stripe Connect
- **Chatbot**: OpenAI GPT
- **Géolocalisation**: React Native Maps

## ⚙️ Installation

1. Clonez ce dépôt
   ```
   git clone https://github.com/votre-utilisateur/client-prestations.git
   cd client-prestations
   ```

2. Installez les dépendances
   ```
   yarn install
   ```

3. Configuration des variables d'environnement
   
   Créez un fichier `.env` à la racine du projet et remplissez les informations suivantes :
   ```
   SUPABASE_URL=votre_url_supabase
   SUPABASE_ANON_KEY=votre_cle_anon_supabase
   OPENAI_API_KEY=votre_cle_api_openai
   STRIPE_PUBLISHABLE_KEY=votre_cle_stripe
   ```

4. Démarrez l'application
   ```
   yarn start
   ```

## 🏗️ Structure du projet

```
client-prestations/
├── src/
│   ├── screens/           # Écrans de l'application
│   │   ├── auth/          # Écrans d'authentification
│   │   ├── client/        # Écrans pour les clients
│   │   ├── prestataire/   # Écrans pour les prestataires
│   │   ├── admin/         # Écrans pour les administrateurs
│   │   └── common/        # Écrans communs
│   ├── components/        # Composants réutilisables
│   ├── navigation/        # Configuration de la navigation
│   ├── services/          # Services d'API et intégrations
│   ├── context/           # Contextes React (dont Auth)
│   ├── hooks/             # Hooks personnalisés
│   ├── utils/             # Fonctions utilitaires
│   ├── types/             # Définitions de types TypeScript
│   ├── assets/            # Images et ressources
│   └── config/            # Fichiers de configuration
└── App.tsx                # Point d'entrée de l'application
```

## 📱 Fonctionnalités principales

### Client
- Chatbot intégré pour comprendre les besoins et créer une demande
- Liste des demandes avec statut
- Réception des offres de prestataires
- Suivi en temps réel du prestataire
- Paiement via Stripe
- Évaluation du prestataire

### Prestataire
- Inscription avec vérification KYC
- Liste des demandes à proximité
- Propositions d'offres
- Suivi en temps réel et mise à jour du statut
- Gestion des missions acceptées

### Administrateur
- Tableau de bord avec statistiques
- Vérification des documents KYC
- Gestion des utilisateurs et services
- Suivi des transactions

## 🔐 Base de données

La structure de la base de données comprend les tables suivantes :
- Users
- KYC
- Services
- Requests
- Offers
- Jobs
- Transactions
- Reviews

## 📝 À compléter

Cette application est un point de départ et nécessite :
- Compléter la configuration avec vos clés API réelles
- Configuration du projet Supabase avec les bonnes tables et relations
- Configuration du projet Stripe pour les paiements
- Configuration de l'API OpenAI pour le chatbot
- Ajustements UI/UX selon vos préférences

## 📄 Licence

Ce projet est sous licence MIT.

## 👥 Contact

Pour toute question ou suggestion, n'hésitez pas à nous contacter.