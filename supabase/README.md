# Fonctions Edge Supabase pour Stripe

Ce dossier contient les fonctions Edge Supabase nécessaires pour le traitement des paiements Stripe.

## Prérequis

1. Un compte Supabase
2. Un compte Stripe
3. Supabase CLI installé localement

## Structure

- `functions/stripe-api/`: API pour les opérations Stripe (création de paiement, gestion des comptes)
- `functions/stripe-webhook/`: Gestion des webhooks Stripe

## Configuration des variables d'environnement

Dans votre projet Supabase, définissez les variables suivantes:

```
STRIPE_SECRET_KEY=sk_test_votre_clé_secrète
STRIPE_WEBHOOK_SECRET=whsec_votre_webhook_secret
FRONTEND_URL=exp://xnalrly-maxlevy-8081.exp.direct
```

## Déploiement

Utilisez les commandes npm suivantes:

```bash
# Se connecter à Supabase
npm run supabase:login

# Déployer les fonctions individuellement
npm run supabase:deploy:stripe-api
npm run supabase:deploy:stripe-webhook

# Ou déployer toutes les fonctions
npm run supabase:deploy:all
```

## Test local avec Stripe CLI

1. Installez Stripe CLI
2. Connectez-vous à Stripe: `stripe login`
3. Écoutez les webhooks: `stripe listen --forward-to https://votre-projet.supabase.co/functions/v1/stripe-webhook`
4. Notez le webhook secret affiché et mettez-le à jour dans les variables d'environnement Supabase

## Endpoints de l'API

- `POST /stripe-api/create-payment-intent`: Créer une intention de paiement
- `POST /stripe-api/create-account`: Créer un compte Connect pour un prestataire
- `POST /stripe-api/onboarding-link`: Générer un lien d'onboarding
- `POST /stripe-api/confirm-transfer`: Confirmer un transfert après paiement

## Webhooks supportés

- `account.updated`: Mise à jour du statut du compte d'un prestataire
- `payment_intent.succeeded`: Paiement réussi