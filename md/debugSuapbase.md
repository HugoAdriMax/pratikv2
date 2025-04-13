# Déboguer les problèmes avec Supabase

Si vous ne voyez pas les nouvelles demandes dans l'écran prestataire, plusieurs problèmes peuvent se produire :

1. **Problèmes de RLS (Row Level Security) :**
   
   Vérifiez vos politiques RLS pour la table `requests` dans Supabase. Vous pouvez temporairement désactiver RLS pour tester :
   ```sql
   ALTER TABLE requests DISABLE ROW LEVEL SECURITY;
   ```
   (N'oubliez pas de la réactiver après les tests)

2. **Vérifier l'utilisateur actuel :**
   
   Assurez-vous que l'utilisateur prestataire est correctement authentifié. Exécutez cette requête RPC :
   ```sql
   CREATE OR REPLACE FUNCTION get_logged_in_user()
   RETURNS jsonb
   LANGUAGE sql SECURITY DEFINER
   AS $$
     SELECT json_build_object(
       'id', auth.uid(),
       'email', (SELECT email FROM auth.users WHERE id = auth.uid()),
       'role', auth.role()
     )::jsonb;
   $$;
   ```
   
   Puis appelez-la depuis votre application ou le client SQL.

3. **Vérifier les données de la table requests :**
   
   Exécutez cette requête pour voir toutes les demandes :
   ```sql
   SELECT id, client_id, service_id, status, created_at
   FROM requests
   ORDER BY created_at DESC;
   ```

4. **Créer une demande de test directement via SQL :**
   
   ```sql
   INSERT INTO requests (
     client_id, 
     service_id, 
     location, 
     urgency, 
     notes, 
     status
   ) VALUES (
     '00000000-0000-0000-0000-000000000000', -- Remplacez par un ID client valide
     (SELECT id FROM services WHERE name = 'Plomberie' LIMIT 1),
     '{"latitude": 48.8566, "longitude": 2.3522, "address": "123 Rue de Test, Paris"}',
     3,
     'Demande de test créée via SQL',
     'pending'
   );
   ```

5. **Vérifier le déclencheur de notifications en temps réel :**
   
   Assurez-vous que vous êtes abonné au bon canal et au bon schéma.
