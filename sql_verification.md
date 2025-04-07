# Vérification de la base de données Supabase

Pour vérifier si votre demande existe bien dans la base de données, suivez ces étapes:

## 1. Ouvrez l'interface Supabase

Allez sur https://app.supabase.com et connectez-vous à votre projet.

## 2. Ouvrez l'éditeur SQL 

Cliquez sur "SQL Editor" dans le menu de gauche.

## 3. Exécutez les requêtes suivantes pour vérifier les données

### Vérifier toutes les demandes (requests)
```sql
SELECT id, client_id, service_id, status, created_at
FROM requests
ORDER BY created_at DESC;
```

### Vérifier si la demande créée par le chatbot existe
```sql
SELECT *
FROM requests
WHERE created_at > (NOW() - INTERVAL '1 day')
ORDER BY created_at DESC;
```

### Vérifier les politiques RLS pour la table requests
```sql
SELECT * 
FROM pg_policies 
WHERE tablename = 'requests';
```

### Vérifier l'utilisateur connecté au compte prestataire
```sql
-- Dans le SQL Editor, cliquez sur "New Query" et créez une fonction RPC:
CREATE OR REPLACE FUNCTION get_current_user()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'id', auth.uid(),
    'email', current_setting('request.jwt.claims', true)::jsonb->>'email',
    'role', current_setting('request.jwt.claims', true)::jsonb->>'role'
  );
$$;

-- Puis exécutez-la:
SELECT get_current_user();
```

### Comparez l'ID du prestataire avec les politiques

Vérifiez que l'ID du prestataire connecté correspond à celui autorisé dans les politiques RLS.

## 4. Vérifiez les politiques de sécurité

Si votre demande existe bien mais n'est pas visible par le prestataire, le problème vient probablement des politiques RLS (Row Level Security). Exécutez cette requête pour vérifier:

```sql
-- Désactiver temporairement RLS pour vérifier l'accès aux données
-- ATTENTION: N'utilisez ceci que pour le débogage, réactivez-le ensuite\!
ALTER TABLE requests DISABLE ROW LEVEL SECURITY;

-- Vérifiez à nouveau si les demandes sont visibles
SELECT id, client_id, service_id, status, created_at 
FROM requests 
ORDER BY created_at DESC;

-- N'oubliez pas de réactiver RLS après les tests
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
```

## 5. Modifiez les politiques RLS pour permettre aux prestataires de voir toutes les demandes

```sql
-- Créer une politique qui permet aux prestataires de voir toutes les demandes
CREATE POLICY "Les prestataires peuvent voir toutes les demandes" ON requests
  FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'prestataire'
  );

-- Si vous avez déjà une politique similaire, supprimez-la d'abord
DROP POLICY "Les prestataires peuvent voir toutes les demandes" ON requests;
```

