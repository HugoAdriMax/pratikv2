# Système de Validation des Prestataires

Ce document explique le fonctionnement du système de validation des prestataires, qui permet aux administrateurs d'approuver les comptes prestataires avant qu'ils ne puissent accéder à la plateforme.

## Aperçu du système

Le système de validation permet :
1. Aux nouveaux prestataires de soumettre des documents KYC (pièce d'identité et documents professionnels)
2. Aux administrateurs de vérifier ces documents et d'approuver ou rejeter les demandes
3. De garantir que seuls les prestataires vérifiés peuvent accéder aux fonctionnalités de la plateforme

## Problèmes résolus récemment

1. **Demandes rejetées qui réapparaissent**
   - Les demandes de prestataires rejetées continuaient à apparaître dans l'interface admin
   - Solution: Implémentation du champ `is_active` pour suivre uniquement les derniers statuts

2. **Affichage des documents KYC**
   - Problèmes d'affichage des documents soumis dans l'interface admin
   - Solution: Amélioration du parsing des données JSON pour gérer différents formats

3. **Compteur de demandes inexact**
   - Le nombre de demandes en attente n'était pas correctement affiché
   - Solution: Amélioration de la requête pour filtrer uniquement les enregistrements actifs

## Flux d'approbation des prestataires

1. **Inscription du prestataire**:
   - Un nouveau prestataire crée un compte
   - Par défaut, le compte est créé avec `is_active = false`

2. **Soumission des documents KYC**:
   - Le prestataire est redirigé vers `KycSubmissionScreen`
   - Il soumet sa pièce d'identité et ses documents professionnels
   - Les documents sont stockés dans Supabase Storage (`chat-media` bucket)
   - Le statut `kyc_submitted` est mis à `true` dans la table `users`

3. **Attente d'approbation**:
   - Le prestataire est redirigé vers `ActivationPendingScreen`
   - Il peut vérifier le statut de sa demande et se déconnecter

4. **Vérification par l'administrateur**:
   - L'administrateur voit les prestataires en attente dans `PrestatairesScreen`
   - Il peut voir les détails, approuver ou rejeter les demandes
   - La fonction RPC `manage_prestataire_status` gère tous les changements de statut

5. **Activation du compte**:
   - Si la demande est approuvée, `is_active` est mis à `true`
   - Le prestataire peut maintenant accéder à toutes les fonctionnalités

## Structure de la base de données améliorée

### Table `users` (colonnes ajoutées)
```sql
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS kyc_submitted BOOLEAN DEFAULT FALSE;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS business_reg_number TEXT;
```

### Table `prestataire_activations` améliorée
```sql
CREATE TABLE IF NOT EXISTS public.prestataire_activations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  admin_id UUID REFERENCES public.users(id),
  is_active BOOLEAN DEFAULT TRUE -- NOUVEAU: marque l'enregistrement actif
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_prestataire_activations_is_active 
ON prestataire_activations(is_active);
```

## Fonction RPC centralisée

Toute la logique de gestion des statuts est centralisée dans une fonction RPC:

```sql
CREATE OR REPLACE FUNCTION public.manage_prestataire_status(
  prestataire_id UUID,
  new_status TEXT, -- 'approved', 'rejected', 'pending'
  admin_id UUID,
  notes_param TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  current_activation_id UUID;
  result JSONB;
BEGIN
  -- Désactiver les anciens enregistrements
  UPDATE prestataire_activations 
  SET is_active = FALSE,
      updated_at = now()
  WHERE user_id = prestataire_id AND is_active = TRUE;
  
  -- Créer un nouvel enregistrement actif
  INSERT INTO prestataire_activations (
    user_id, status, admin_id, notes, is_active
  ) 
  VALUES (
    prestataire_id, new_status, admin_id, COALESCE(notes_param, ''), TRUE
  )
  RETURNING id INTO current_activation_id;
  
  -- Mettre à jour le statut utilisateur
  UPDATE users 
  SET 
    is_active = CASE WHEN new_status = 'approved' THEN TRUE ELSE FALSE END,
    is_verified = CASE WHEN new_status = 'approved' THEN TRUE ELSE users.is_verified END
  WHERE id = prestataire_id;
  
  -- Renvoyer le résultat
  result = jsonb_build_object(
    'action', 'created',
    'activation_id', current_activation_id,
    'user_id', prestataire_id,
    'status', new_status,
    'is_active', TRUE
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Politiques de sécurité (RLS) mises à jour

Les politiques ont été améliorées pour ne montrer que les enregistrements actifs:

```sql
-- SELECT: Prestataires peuvent voir leurs demandes actives, admins peuvent voir toutes les demandes actives
DROP POLICY IF EXISTS prestataire_activations_select_policy ON prestataire_activations;
CREATE POLICY prestataire_activations_select_policy ON prestataire_activations 
  FOR SELECT USING (
    (auth.uid() = user_id OR 
     auth.uid() = admin_id OR 
     EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')) 
    AND is_active = TRUE
  );
```

## Gestion améliorée des documents KYC

Le code a été amélioré pour gérer différents formats de documents KYC:

```typescript
let docData = { idCardUrl: '', businessDocUrl: '' };

if (typeof kyc.doc_url === 'string') {
  try {
    // Tentative de parse JSON
    docData = JSON.parse(kyc.doc_url);
  } catch (e) {
    // Si ce n'est pas du JSON valide, considérer comme URL simple
    docData = { idCardUrl: kyc.doc_url };
  }
} else if (kyc.doc_url && typeof kyc.doc_url === 'object') {
  // Si c'est déjà un objet parsé
  docData = kyc.doc_url;
}
```

## Navigation conditionnelle

Le flux de navigation est géré dans `AppNavigator.tsx`:

```javascript
// Vérifier si le prestataire est actif
if (user.is_active) {
  // Interface normale
  return <PrestataireTabs />; 
}

// Vérification du statut KYC
const hasSubmittedKyc = user.kyc_submitted || false;

// Si l'utilisateur n'a pas encore soumis ses documents KYC
if (!hasSubmittedKyc) {
  return <KycSubmissionScreen />;
}

// Prestataire en attente d'activation
return <ActivationPendingScreen />;
```

## Résolution des problèmes

Si des problèmes persistent après l'implémentation des améliorations:

1. **Vérifier la structure de la base de données**
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'prestataire_activations';
   ```

2. **Vérifier les politiques RLS**
   ```sql
   SELECT tablename, policyname, permissive, roles, cmd, qual
   FROM pg_policies
   WHERE tablename = 'prestataire_activations';
   ```

3. **Vérifier les enregistrements pour un prestataire spécifique**
   ```sql
   SELECT * FROM prestataire_activations
   WHERE user_id = 'user_id_here'
   ORDER BY created_at DESC;
   ```

4. **Forcer un rechargement complet de l'interface**
   - Utilisez la fonction pull-to-refresh dans l'application
   - Vérifiez la console pour des erreurs spécifiques

5. **Nettoyer les enregistrements obsolètes**
   ```sql
   SELECT cleanup_inactive_prestataire_activations();
   ```

## Scripts d'implémentation

Pour mettre en œuvre ces améliorations, exécutez les scripts SQL suivants dans cet ordre:

1. `add_is_active_to_prestataire_activations.sql` - Ajoute la colonne is_active
2. `fix_prestataire_activation_system.sql` - Crée la fonction RPC améliorée