# Instructions pour mettre à jour la base de données Supabase

Pour que le suivi de mission fonctionne correctement, vous devez ajouter une colonne `prestataire_status` à la table `requests` dans votre base de données Supabase.

## Étapes à suivre:

1. Connectez-vous à votre console Supabase
2. Allez dans l'éditeur SQL (SQL Editor)
3. Créez une nouvelle requête
4. Copiez-collez le contenu du fichier `add_prestataire_status.sql` dans l'éditeur
5. Exécutez la requête

## Contenu du script SQL

Le script va:
1. Vérifier si la colonne `prestataire_status` existe déjà
2. Ajouter la colonne si elle n'existe pas, avec la valeur par défaut `not_started`
3. Configurer les permissions pour que tous les utilisateurs puissent accéder à cette colonne
4. Désactiver RLS pour la table `requests` afin de permettre la mise à jour du statut
5. Confirmer que la colonne a été créée

## Importance de cette mise à jour

Cette colonne est nécessaire pour que:
- Le prestataire puisse mettre à jour son statut pendant une mission (en route, arrivé, etc.)
- Le client puisse voir ces mises à jour en temps réel dans son interface
- L'application affiche correctement le statut des missions en cours

Si vous rencontrez des erreurs indiquant que la colonne n'existe pas, c'est que cette migration n'a pas encore été appliquée.