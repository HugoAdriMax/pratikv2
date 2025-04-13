-- Script pour supprimer proprement un utilisateur et toutes ses données associées
BEGIN;

-- Définir l'ID de l'utilisateur à supprimer (remplacer par l'ID réel)
\set user_id '654cfa4d-405e-4beb-ae4e-95748beec522'

-- 1. Identifier et supprimer d'abord les références dans les autres tables
-- Supprimer les demandes d'activation de prestataire 
DELETE FROM prestataire_activations WHERE user_id = :'user_id';

-- Supprimer les documents KYC
DELETE FROM kyc WHERE user_id = :'user_id';

-- Supprimer les notifications
DELETE FROM notifications WHERE user_id = :'user_id';

-- Supprimer les jobs
DELETE FROM jobs WHERE prestataire_id = :'user_id';

-- Supprimer les demandes
DELETE FROM requests WHERE client_id = :'user_id' OR prestataire_id = :'user_id';

-- Supprimer les messages de chat
DELETE FROM chat_messages WHERE sender_id = :'user_id' OR receiver_id = :'user_id';

-- Supprimer les évaluations/reviews
DELETE FROM reviews WHERE reviewer_id = :'user_id' OR reviewed_id = :'user_id';

-- 2. Vérifier s'il existe des auto-références (par exemple, si un utilisateur est référencé par un autre utilisateur)
-- (Supprimer d'abord les auto-références, comme reviewed_user_id si cela existe)
UPDATE users SET reviewed_user_id = NULL WHERE reviewed_user_id = :'user_id';

-- 3. Suppression des données de stockage si nécessaire
-- a. Récupérer le bucket et le chemin pour les images de profil ou documents
-- b. Supprimer les fichiers associés à cet utilisateur dans le bucket

-- 4. Finalement, supprimer l'utilisateur lui-même
DELETE FROM users WHERE id = :'user_id';

-- 5. Supprimer le compte auth
-- Utilisez la fonction auth.delete_user pour supprimer complètement l'utilisateur
-- y compris ses sessions, facteurs d'authentification, etc.
SELECT auth.delete_user(:'user_id');

COMMIT;
