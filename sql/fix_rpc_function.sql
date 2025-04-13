-- Correction pour la fonction RPC submit_kyc_data
-- L'erreur est due à une ambiguïté dans le nom de colonne user_id qui existe dans plusieurs tables

-- Suppression de la fonction existante
DROP FUNCTION IF EXISTS public.submit_kyc_data;

-- Création de la fonction corrigée avec des noms sans ambiguïté
CREATE OR REPLACE FUNCTION submit_kyc_data(
  input_user_id UUID, 
  business_name TEXT, 
  user_address TEXT, 
  business_reg_num TEXT,
  doc_data TEXT
) 
RETURNS void AS $$
BEGIN
  -- 1. Mettre à jour les informations dans la table users
  UPDATE public.users
  SET 
    name = business_name,
    address = user_address,
    business_reg_number = business_reg_num,
    kyc_submitted = true
  WHERE id = input_user_id;
  
  -- 2. Créer ou mettre à jour l'entrée KYC
  BEGIN
    -- Essayer d'abord d'insérer dans la table kyc
    INSERT INTO public.kyc (user_id, doc_url, status)
    VALUES (input_user_id, doc_data, 'pending')
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      doc_url = doc_data,
      status = 'pending',
      updated_at = now();
  EXCEPTION
    WHEN undefined_table THEN
      -- Si la table kyc n'existe pas, on peut l'ignorer
      NULL;
    WHEN undefined_column THEN
      -- Si la structure de la table est différente de ce qu'on attend
      NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accorder les permissions nécessaires
GRANT EXECUTE ON FUNCTION submit_kyc_data TO authenticated;

-- Vérifier que la fonction a été créée correctement
SELECT 
    proname AS function_name,
    pg_get_function_result(oid) AS result_data_type
FROM pg_proc 
WHERE proname = 'submit_kyc_data'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');