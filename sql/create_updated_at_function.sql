-- Ce script crée la fonction set_updated_at nécessaire pour les triggers
-- Exécutez ce script avant fix_prestataire_activations_rls.sql si vous rencontrez une erreur

-- Création de la fonction set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Vérifier que la fonction a été créée
SELECT 
    proname AS function_name,
    proargnames AS argument_names,
    pg_get_function_result(oid) AS result_data_type,
    pg_get_functiondef(oid) AS function_definition
FROM pg_proc 
WHERE proname = 'set_updated_at'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');