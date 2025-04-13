-- Script pour supprimer proprement un utilisateur et toutes ses données associées
BEGIN;

-- Définir l'ID de l'utilisateur à supprimer
DO $$
DECLARE
  target_user_id UUID := '654cfa4d-405e-4beb-ae4e-95748beec522'; -- Remplacer par l'ID réel
BEGIN
  -- 1. Identifier et supprimer d'abord les références dans les autres tables
  -- Supprimer les demandes d'activation de prestataire 
  DELETE FROM prestataire_activations WHERE user_id = target_user_id;

  -- Supprimer les documents KYC
  DELETE FROM kyc WHERE user_id = target_user_id;

  -- Supprimer les notifications
  DELETE FROM notifications WHERE user_id = target_user_id;

  -- Supprimer les jobs
  DELETE FROM jobs WHERE prestataire_id = target_user_id;

  -- Supprimer les demandes
  DELETE FROM requests WHERE client_id = target_user_id OR prestataire_id = target_user_id;

  -- Supprimer les messages de chat
  DELETE FROM chat_messages WHERE sender_id = target_user_id OR receiver_id = target_user_id;

  -- Supprimer les évaluations/reviews
  DELETE FROM reviews WHERE reviewer_id = target_user_id OR reviewed_id = target_user_id;

  -- 2. Vérifier s'il existe des auto-références
  UPDATE users SET reviewed_user_id = NULL WHERE reviewed_user_id = target_user_id;

  -- 3. Finalement, supprimer l'utilisateur lui-même
  DELETE FROM users WHERE id = target_user_id;

  -- 4. Supprimer le compte auth
  PERFORM auth.delete_user(target_user_id);
END $$;

COMMIT;
