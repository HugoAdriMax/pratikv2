-- Fonction pour vérifier le statut du compte Stripe d'un prestataire
-- Utiliser CREATE OR REPLACE pour mettre à jour si elle existe déjà
CREATE OR REPLACE FUNCTION check_prestataire_stripe_account(prestataire_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'hasAccount', stripe_account_id IS NOT NULL,
        'accountId', stripe_account_id,
        'isEnabled', stripe_account_enabled
    ) INTO result
    FROM users
    WHERE id = prestataire_id 
    AND role = 'prestataire';

    IF result IS NULL THEN
        RETURN json_build_object(
            'hasAccount', false,
            'accountId', NULL,
            'isEnabled', false
        );
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour enregistrer une transaction de paiement
CREATE OR REPLACE FUNCTION record_payment_transaction(
    p_job_id UUID,
    p_amount NUMERIC,
    p_stripe_id TEXT,
    p_commission NUMERIC,
    p_payment_status TEXT DEFAULT 'completed'
)
RETURNS UUID AS $$
DECLARE
    transaction_id UUID;
BEGIN
    -- Vérifier que les paramètres sont valides
    IF p_job_id IS NULL OR p_amount <= 0 OR p_stripe_id IS NULL OR p_commission < 0 THEN
        RAISE EXCEPTION 'Paramètres invalides pour l''enregistrement de la transaction';
    END IF;

    -- Vérifier que le statut de paiement est valide
    IF p_payment_status NOT IN ('pending', 'processing', 'completed', 'failed', 'refunded') THEN
        RAISE EXCEPTION 'Statut de paiement invalide: %', p_payment_status;
    END IF;

    -- Insérer la transaction
    INSERT INTO transactions (
        job_id,
        amount,
        stripe_id,
        commission,
        payment_status,
        payout_status
    ) VALUES (
        p_job_id,
        p_amount,
        p_stripe_id,
        p_commission,
        p_payment_status,
        p_payment_status = 'completed' -- Marquer comme payé si le statut est 'completed'
    )
    RETURNING id INTO transaction_id;

    -- Si le paiement est complété, mettre à jour le statut de l'offre
    IF p_payment_status = 'completed' THEN
        UPDATE offers SET 
            payment_status = 'completed',
            status = 'accepted'
        WHERE id = p_job_id;
    END IF;

    RETURN transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour mettre à jour le statut de paiement d'une transaction
CREATE OR REPLACE FUNCTION update_payment_status(
    p_transaction_id UUID,
    p_payment_status TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    job_id UUID;
BEGIN
    -- Vérifier que le statut est valide
    IF p_payment_status NOT IN ('pending', 'processing', 'completed', 'failed', 'refunded') THEN
        RAISE EXCEPTION 'Statut de paiement invalide: %', p_payment_status;
    END IF;

    -- Mettre à jour la transaction
    UPDATE transactions
    SET 
        payment_status = p_payment_status,
        payout_status = CASE WHEN p_payment_status = 'completed' THEN TRUE ELSE payout_status END,
        updated_at = NOW()
    WHERE id = p_transaction_id
    RETURNING job_id INTO job_id;

    -- Si aucune transaction n'a été trouvée
    IF job_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Mettre à jour le statut de paiement de l'offre
    UPDATE offers
    SET payment_status = p_payment_status
    WHERE id = job_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour créer ou mettre à jour les infos Stripe d'un utilisateur
CREATE OR REPLACE FUNCTION upsert_user_stripe_info(
    p_user_id UUID,
    p_stripe_account_id TEXT DEFAULT NULL,
    p_stripe_account_enabled BOOLEAN DEFAULT NULL,
    p_stripe_customer_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    user_exists BOOLEAN;
BEGIN
    -- Vérifier si l'utilisateur existe
    SELECT EXISTS(SELECT 1 FROM users WHERE id = p_user_id) INTO user_exists;
    
    IF NOT user_exists THEN
        RETURN FALSE;
    END IF;

    -- Mettre à jour les informations Stripe
    UPDATE users
    SET 
        stripe_account_id = COALESCE(p_stripe_account_id, stripe_account_id),
        stripe_account_enabled = COALESCE(p_stripe_account_enabled, stripe_account_enabled),
        stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir les statistiques de paiement d'un prestataire
CREATE OR REPLACE FUNCTION get_prestataire_payment_stats(p_prestataire_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'totalEarnings', COALESCE(SUM(t.amount - t.commission), 0),
        'totalTransactions', COUNT(t.*),
        'pendingPayouts', COUNT(t.*) FILTER (WHERE t.payment_status = 'completed' AND NOT t.payout_status),
        'completedPayouts', COUNT(t.*) FILTER (WHERE t.payment_status = 'completed' AND t.payout_status),
        'lastPaymentDate', MAX(t.created_at) FILTER (WHERE t.payment_status = 'completed')
    ) INTO result
    FROM transactions t
    JOIN offers o ON t.job_id = o.id
    JOIN jobs j ON o.id = j.offer_id
    WHERE j.prestataire_id = p_prestataire_id;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Création de la table pour stocker les événements de webhook Stripe
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    object_type TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE
);

-- Fonction pour traiter les événements webhook Stripe
CREATE OR REPLACE FUNCTION process_stripe_webhook(
    p_event_id TEXT,
    p_event_type TEXT,
    p_object_id TEXT,
    p_object_type TEXT,
    p_data JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Insérer l'événement dans la table des événements
    INSERT INTO stripe_webhook_events (
        id, 
        event_type, 
        object_id, 
        object_type, 
        data, 
        processed
    ) 
    VALUES (
        p_event_id, 
        p_event_type, 
        p_object_id, 
        p_object_type, 
        p_data, 
        TRUE
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;