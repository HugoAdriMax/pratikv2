-- Création d'une table pour stocker les événements Stripe webhook
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id TEXT PRIMARY KEY, -- ID unique de l'événement Stripe
    type TEXT NOT NULL, -- Type d'événement (ex: account.updated, payment_intent.succeeded)
    object_id TEXT, -- ID de l'objet concerné par l'événement
    object_type TEXT, -- Type d'objet (ex: account, payment_intent)
    status TEXT DEFAULT 'pending', -- Status du traitement: pending, processed, failed
    data JSONB NOT NULL, -- Données complètes de l'événement
    error TEXT, -- Message d'erreur en cas d'échec de traitement
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ, -- Date de traitement de l'événement
    attempts INTEGER DEFAULT 0 -- Nombre de tentatives de traitement
);

-- Fonction pour traiter les webhooks d'onboarding de compte Stripe Connect
CREATE OR REPLACE FUNCTION process_account_updated_webhook(
    event_id TEXT,
    account_id TEXT,
    data JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
    payouts_enabled BOOLEAN;
    charges_enabled BOOLEAN;
    account_enabled BOOLEAN;
    prestataire_id UUID;
BEGIN
    -- Extraire les informations pertinentes
    payouts_enabled := data->'object'->'payouts_enabled';
    charges_enabled := data->'object'->'charges_enabled';
    
    -- Un compte est considéré comme activé si les paiements et les versements sont activés
    account_enabled := payouts_enabled AND charges_enabled;
    
    -- Rechercher l'utilisateur prestataire associé à ce compte
    SELECT id INTO prestataire_id 
    FROM users 
    WHERE stripe_account_id = account_id 
    AND role = 'prestataire';
    
    -- Si l'utilisateur existe, mettre à jour son statut Stripe
    IF prestataire_id IS NOT NULL THEN
        UPDATE users
        SET 
            stripe_account_enabled = account_enabled,
            updated_at = NOW()
        WHERE id = prestataire_id;
        
        -- Mettre à jour le statut de l'événement
        UPDATE stripe_webhook_events
        SET 
            status = 'processed',
            processed_at = NOW()
        WHERE id = event_id;
        
        RETURN TRUE;
    ELSE
        -- Aucun utilisateur trouvé pour ce compte Stripe
        UPDATE stripe_webhook_events
        SET 
            status = 'failed',
            error = 'Aucun prestataire trouvé avec ce compte Stripe: ' || account_id,
            processed_at = NOW()
        WHERE id = event_id;
        
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour traiter les webhooks de succès de paiement
CREATE OR REPLACE FUNCTION process_payment_intent_succeeded_webhook(
    event_id TEXT,
    payment_intent_id TEXT,
    data JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
    offer_id UUID;
    transaction_id UUID;
    amount NUMERIC;
    prestataire_account_id TEXT;
    stripe_id TEXT;
BEGIN
    -- Extraire les métadonnées de l'intention de paiement
    offer_id := (data->'object'->'metadata'->>'offerId')::UUID;
    amount := (data->'object'->>'amount')::NUMERIC / 100; -- Conversion de cents en euros
    prestataire_account_id := data->'object'->'metadata'->>'prestataireAccountId';
    stripe_id := data->'object'->>'id';
    
    -- Si aucune offre n'est spécifiée, marquer comme erreur
    IF offer_id IS NULL THEN
        UPDATE stripe_webhook_events
        SET 
            status = 'failed',
            error = 'Aucun ID d''offre trouvé dans les métadonnées du paiement',
            processed_at = NOW()
        WHERE id = event_id;
        
        RETURN FALSE;
    END IF;
    
    -- Calculer la commission (10%)
    SELECT record_payment_transaction(
        offer_id,
        amount,
        stripe_id,
        amount * 0.1, -- 10% de commission
        'completed'
    ) INTO transaction_id;
    
    -- Si la transaction a été créée avec succès
    IF transaction_id IS NOT NULL THEN
        -- Mettre à jour le statut de l'événement
        UPDATE stripe_webhook_events
        SET 
            status = 'processed',
            processed_at = NOW()
        WHERE id = event_id;
        
        RETURN TRUE;
    ELSE
        -- Échec de l'enregistrement de la transaction
        UPDATE stripe_webhook_events
        SET 
            status = 'failed',
            error = 'Échec de l''enregistrement de la transaction pour l''offre: ' || offer_id,
            processed_at = NOW()
        WHERE id = event_id;
        
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction générique pour traiter n'importe quel événement webhook
CREATE OR REPLACE FUNCTION process_stripe_webhook(
    p_event_id TEXT,
    p_event_type TEXT,
    p_object_id TEXT,
    p_object_type TEXT,
    p_data JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
    success BOOLEAN;
BEGIN
    -- Insérer l'événement dans la table des webhooks
    INSERT INTO stripe_webhook_events (
        id,
        type,
        object_id,
        object_type,
        data,
        status
    ) VALUES (
        p_event_id,
        p_event_type,
        p_object_id,
        p_object_type,
        p_data,
        'pending'
    )
    ON CONFLICT (id) DO UPDATE SET
        attempts = stripe_webhook_events.attempts + 1,
        status = 'pending';
    
    -- Traiter l'événement selon son type
    CASE p_event_type
        WHEN 'account.updated' THEN
            SELECT process_account_updated_webhook(p_event_id, p_object_id, p_data) INTO success;
        WHEN 'payment_intent.succeeded' THEN
            SELECT process_payment_intent_succeeded_webhook(p_event_id, p_object_id, p_data) INTO success;
        ELSE
            -- Pour les autres types d'événements, les marquer comme traités sans action
            UPDATE stripe_webhook_events
            SET 
                status = 'processed',
                processed_at = NOW()
            WHERE id = p_event_id;
            
            success := TRUE;
    END CASE;
    
    RETURN success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accorder les autorisations d'exécution aux utilisateurs authentifiés (admin uniquement)
GRANT EXECUTE ON FUNCTION process_stripe_webhook(TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;