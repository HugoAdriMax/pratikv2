# Guide de résolution des problèmes liés au système de validation des prestataires

Ce document explique les problèmes rencontrés et les solutions implémentées pour le système de validation des prestataires.

## Problèmes constatés et solutions

### 1. Erreur "Could not find the 'updated_at' column of 'users' in the schema cache"

**Problème** : Lors de la mise à jour du statut d'un prestataire, une erreur concernant la colonne `updated_at` s'affichait.

**Solution** :
1. Ajout de la colonne `updated_at` dans la table `users` (voir `add_updated_at_column.sql`)
2. Mise en place d'un trigger pour mettre à jour automatiquement cette colonne
3. Modification du code pour supprimer les références directes à `updated_at`
4. Création d'une fonction RPC pour mettre à jour le statut des utilisateurs en toute sécurité

### 2. Permissions d'accès aux documents KYC dans le bucket de stockage

**Problème** : Difficultés potentielles pour accéder aux documents KYC stockés.

**Solution** :
1. Création de politiques de sécurité spécifiques pour le bucket `kyc-documents`
2. Mise en place de règles permettant :
   - Aux prestataires de télécharger leurs propres documents
   - Aux prestataires de consulter leurs propres documents
   - Aux administrateurs de consulter tous les documents

## Fichiers créés

### 1. `add_updated_at_column.sql`
```sql
-- Add updated_at column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on users table
DROP TRIGGER IF EXISTS set_users_updated_at ON public.users;
CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Refresh schema cache for users table
NOTIFY pgrst, 'reload schema';
```

### 2. `create_user_status_rpc.sql`
```sql
-- Create RPC function to update user status safely (avoiding schema cache issues)
CREATE OR REPLACE FUNCTION update_user_status(
  user_id UUID,
  is_user_active BOOLEAN,
  is_user_verified BOOLEAN DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Check if is_user_verified is provided
  IF is_user_verified IS NULL THEN
    UPDATE public.users 
    SET is_active = is_user_active
    WHERE id = user_id;
  ELSE
    UPDATE public.users 
    SET 
      is_active = is_user_active,
      is_verified = is_user_verified
    WHERE id = user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

### 3. `fix_kyc_storage_permissions.sql`
```sql
-- Verify and fix storage bucket permissions for KYC documents
BEGIN;

-- Check if the policy already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Prestataires can upload KYC documents'
  ) THEN
    -- Create policy for prestataires to upload their own KYC documents
    CREATE POLICY "Prestataires can upload KYC documents"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'kyc-documents' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
    
    RAISE NOTICE 'Created upload policy for KYC documents';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Users can view their own KYC documents'
  ) THEN
    -- Create policy for prestataires to view their own KYC documents
    CREATE POLICY "Users can view their own KYC documents"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'kyc-documents' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
    
    RAISE NOTICE 'Created view policy for own KYC documents';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Admins can view all KYC documents'
  ) THEN
    -- Create policy for admins to view all KYC documents
    CREATE POLICY "Admins can view all KYC documents"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'kyc-documents' AND
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
      )
    );
    
    RAISE NOTICE 'Created admin view policy for KYC documents';
  END IF;
END $$;

-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name)
VALUES ('kyc-documents', 'KYC Documents')
ON CONFLICT (id) DO NOTHING;

COMMIT;
```

## Modifications du code

Dans `PrestatairesScreen.tsx`, les mises à jour ont été modifiées pour:

1. Utiliser la fonction RPC `update_user_status` au lieu de mettre à jour directement la table
2. Supprimer les références à `updated_at` qui causaient des erreurs

Exemple:
```typescript
// Avant
const { error: userError } = await supabase
  .from('users')
  .update({ 
    is_active: true, 
    is_verified: true,
    updated_at: new Date().toISOString()
  })
  .eq('id', item.id);

// Après
const { error: userError } = await supabase.rpc(
  'update_user_status',
  {
    user_id: item.id,
    is_user_active: true,
    is_user_verified: true
  }
);
```

## Comment appliquer ces modifications

1. Exécutez `add_updated_at_column.sql` pour ajouter la colonne et le trigger
2. Exécutez `create_user_status_rpc.sql` pour créer la fonction RPC de mise à jour sécurisée
3. Exécutez `fix_kyc_storage_permissions.sql` pour configurer correctement le bucket de stockage
4. Les modifications de code ont déjà été appliquées au fichier `PrestatairesScreen.tsx`

Après ces modifications, le système de validation des prestataires devrait fonctionner correctement, sans erreurs de cache de schéma.