-- Vérifier la structure de la table prestataire_services
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'prestataire_services'
ORDER BY ordinal_position;
