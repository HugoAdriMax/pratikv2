-- Créez une fonction RPC pour gérer complètement l'activation/désactivation
-- Cette fonction va tout gérer au niveau serveur, évitant les problèmes de synchronisation

CREATE OR REPLACE FUNCTION manage_prestataire_status(
  prestataire_id UUID,
  new_status TEXT, -- 'approved', 'rejected', 'pending'
  admin_id UUID,
  notes TEXT DEFAULT NULL
)
RETURNS JSONB AS 188629
DECLARE
  current_activation_id UUID;
  result JSONB;
BEGIN
  -- 1. Vérifier s'il existe déjà une activation pour ce prestataire
  SELECT id INTO current_activation_id 
  FROM prestataire_activations 
  WHERE user_id = prestataire_id 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  -- 2. Si une activation existe, la mettre à jour
  IF current_activation_id IS NOT NULL THEN
    -- Mettre à jour l'entrée existante
    UPDATE prestataire_activations 
    SET 
      status = new_status,
      admin_id = manage_prestataire_status.admin_id,
      notes = COALESCE(manage_prestataire_status.notes, notes),
      updated_at = now()
    WHERE id = current_activation_id;
    
    result = jsonb_build_object(
      'action', 'updated',
      'activation_id', current_activation_id
    );
  ELSE
    -- 3. Sinon, créer une nouvelle activation
    INSERT INTO prestataire_activations (
      user_id, 
      status, 
      admin_id, 
      notes
    ) 
    VALUES (
      prestataire_id, 
      new_status, 
      manage_prestataire_status.admin_id, 
      COALESCE(manage_prestataire_status.notes, '')
    )
    RETURNING id INTO current_activation_id;
    
    result = jsonb_build_object(
      'action', 'created',
      'activation_id', current_activation_id
    );
  END IF;
  
  -- 4. Mettre à jour le statut utilisateur en fonction du nouveau statut d'activation
  UPDATE users 
  SET 
    is_active = CASE 
      WHEN new_status = 'approved' THEN TRUE 
      ELSE FALSE 
    END,
    is_verified = CASE 
      WHEN new_status = 'approved' THEN TRUE 
      ELSE is_verified -- ne changez pas is_verified si le statut est rejeté
    END
  WHERE id = prestataire_id;
  
  -- 5. Renvoyer le résultat avec toutes les infos
  RETURN result || jsonb_build_object(
    'user_id', prestataire_id,
    'status', new_status
  );
END;
188629 LANGUAGE plpgsql SECURITY DEFINER;
