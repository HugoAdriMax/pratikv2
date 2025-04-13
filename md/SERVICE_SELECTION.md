# Système de sélection des services

Ce document explique en détail le système de sélection des services par les prestataires, qui permet aux professionnels d'indiquer quels services ils proposent et de recevoir uniquement les demandes correspondant à leurs compétences.

## Architecture

Le système comprend plusieurs composants clés:

1. **Base de données**
   - Tables `services` et `prestataire_services`
   - Fonctions RPC et règles de sécurité
   - Vue pour l'administration

2. **Interface utilisateur**
   - Écran de sélection de services pour les prestataires
   - Filtre des demandes en fonction des services sélectionnés

3. **Logique d'application**
   - Filtrage des demandes côté serveur
   - Optimisation des performances pour les requêtes fréquentes

## Schéma de base de données

### Table `services`

Contient la liste des services disponibles sur la plateforme.

```sql
CREATE TABLE services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### Table `prestataire_services`

Associe les prestataires aux services qu'ils proposent, avec des détails supplémentaires.

```sql
CREATE TABLE prestataire_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prestataire_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    experience_years INT,
    hourly_rate DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(prestataire_id, service_id)
);
```

## Fonctions RPC et API

### `get_prestataire_services`

Récupère tous les services disponibles avec leur statut de sélection pour un prestataire donné.

```sql
CREATE OR REPLACE FUNCTION get_prestataire_services(prestataire_id UUID)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    category TEXT,
    description TEXT,
    is_selected BOOLEAN,
    experience_years INT,
    hourly_rate DECIMAL(10, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.category,
        s.description,
        CASE WHEN ps.prestataire_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_selected,
        ps.experience_years,
        ps.hourly_rate
    FROM 
        services s
    LEFT JOIN 
        prestataire_services ps ON s.id = ps.service_id AND ps.prestataire_id = get_prestataire_services.prestataire_id
    ORDER BY 
        s.category, s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### `update_prestataire_service`

Met à jour la sélection de services d'un prestataire (ajout, modification ou suppression).

```sql
CREATE OR REPLACE FUNCTION update_prestataire_service(
    p_prestataire_id UUID,
    p_service_id TEXT,
    p_selected BOOLEAN,
    p_experience_years INT DEFAULT NULL,
    p_hourly_rate DECIMAL(10, 2) DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Si le service doit être sélectionné
    IF p_selected THEN
        -- Insérer ou mettre à jour la sélection de service
        INSERT INTO prestataire_services (
            prestataire_id, 
            service_id, 
            experience_years, 
            hourly_rate
        ) 
        VALUES (
            p_prestataire_id, 
            p_service_id, 
            p_experience_years, 
            p_hourly_rate
        )
        ON CONFLICT (prestataire_id, service_id) 
        DO UPDATE SET
            experience_years = COALESCE(p_experience_years, prestataire_services.experience_years),
            hourly_rate = COALESCE(p_hourly_rate, prestataire_services.hourly_rate),
            updated_at = now()
        RETURNING jsonb_build_object('id', id) INTO result;
    ELSE
        -- Si le service doit être désélectionné, le supprimer
        DELETE FROM prestataire_services 
        WHERE prestataire_id = p_prestataire_id AND service_id = p_service_id
        RETURNING jsonb_build_object('id', id, 'removed', true) INTO result;
        
        -- Si aucune ligne n'a été supprimée, définir un résultat par défaut
        IF result IS NULL THEN
            result := jsonb_build_object('removed', false, 'message', 'Service was not selected');
        END IF;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'service_id', p_service_id,
        'selected', p_selected,
        'result', result
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'service_id', p_service_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### `get_requests_by_prestataire_services`

Récupère les demandes en fonction des services proposés par un prestataire.

```sql
CREATE OR REPLACE FUNCTION get_requests_by_prestataire_services(p_prestataire_id UUID)
RETURNS SETOF requests AS $$
BEGIN
    RETURN QUERY
    SELECT r.*
    FROM requests r
    WHERE r.service_id IN (
        SELECT ps.service_id
        FROM prestataire_services ps
        WHERE ps.prestataire_id = p_prestataire_id
    )
    AND (r.status = 'pending' OR r.status = 'offered')
    ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Interface utilisateur

### Écran de sélection de services

L'écran de sélection de services (`ServiceSelectionScreen.tsx`) permet aux prestataires de:

1. **Voir tous les services** - Affichés par catégories pour faciliter la navigation
2. **Sélectionner/désélectionner** - Via un simple bouton switch pour chaque service
3. **Ajouter des détails** - Pour chaque service sélectionné:
   - Années d'expérience
   - Tarif horaire

L'interface est également dotée d'une barre de recherche pour trouver rapidement un service spécifique.

### Intégration dans le profil utilisateur

La sélection de services est accessible depuis le profil du prestataire via un bouton "Mes services proposés".

## Filtrage des demandes

Le filtrage des demandes se fait à deux niveaux:

1. **Côté serveur** - Via la fonction RPC `get_requests_by_prestataire_services` qui ne renvoie que les demandes correspondant aux services d'un prestataire.

2. **Côté client** - Via le service `getNearbyRequests` dans `api.ts`, qui implémente une logique de fallback en cas d'erreur.

```typescript
export const getNearbyRequests = async (
  userId: string,
  maxDistance?: number,
  serviceIds?: string[]
): Promise<Request[]> => {
  try {
    // Récupérer d'abord les services du prestataire
    if (!serviceIds || serviceIds.length === 0) {
      const { data: prestataireServices, error: servicesError } = await supabase
        .from('prestataire_services')
        .select('service_id')
        .eq('prestataire_id', userId);
      
      if (!servicesError && prestataireServices && prestataireServices.length > 0) {
        serviceIds = prestataireServices.map(item => item.service_id);
      }
    }
    
    // Essayer d'utiliser la RPC si disponible
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_requests_by_prestataire_services',
        { p_prestataire_id: userId }
      );
      
      if (!rpcError && rpcData) {
        return rpcData as Request[];
      }
    } catch (rpcException) {
      // Continuer avec la méthode classique
    }
    
    // Méthode de secours: Requête directe
    let query = supabase
      .from('requests')
      .select('*')
      .or(`status.eq.${RequestStatus.PENDING},status.eq.${RequestStatus.OFFERED}`)
      .order('created_at', { ascending: false });
    
    // Filtrer par services si disponible
    if (serviceIds && serviceIds.length > 0) {
      query = query.in('service_id', serviceIds);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Enrichir les données avec les informations de service
    const enrichedRequests = await Promise.all((data || []).map(async (request) => {
      if (request.service_id) {
        try {
          const serviceData = await getServiceById(request.service_id);
          return {
            ...request,
            service: serviceData
          };
        } catch (serviceError) {
          return request;
        }
      }
      return request;
    }));
    
    return enrichedRequests as Request[];
  } catch (error) {
    return handleError(error, 'Erreur lors de la récupération des demandes à proximité');
  }
};
```

## Sécurité et Permissions

Les règles de sécurité pour les tables `services` et `prestataire_services` sont configurées comme suit:

- **Table `services`**
  - Select: Accessible par tous les utilisateurs authentifiés
  - Insert/Update/Delete: Réservé aux administrateurs

- **Table `prestataire_services`**
  - Select/Insert/Update/Delete: Chaque prestataire ne peut accéder et modifier que ses propres entrées

## Migration et Initialisation

Le script `complete_service_system.sql` contient toutes les commandes nécessaires pour:

1. Créer les tables si elles n'existent pas
2. Définir les fonctions RPC
3. Configurer les règles de sécurité
4. Initialiser les services de base

## Conseils d'utilisation

### Pour les prestataires

1. Accédez à votre profil
2. Touchez "Mes services proposés"
3. Sélectionnez les services que vous offrez
4. Pour chaque service sélectionné, vous pouvez optionnellement:
   - Indiquer vos années d'expérience
   - Définir votre tarif horaire
5. Enregistrez vos modifications

### Pour les administrateurs

Pour ajouter de nouveaux services ou catégories, utilisez:

```sql
INSERT INTO services (id, name, category, description)
VALUES 
('nouveau-service', 'Nom du service', 'Catégorie', 'Description détaillée')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    description = EXCLUDED.description;
```