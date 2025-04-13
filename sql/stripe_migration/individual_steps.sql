-- Exécutez ces commandes une par une pour éviter les erreurs de syntaxe

-- 1. Créer la fonction set_updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Ajouter les champs Stripe à la table users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_account_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- 3. Ajouter le statut de paiement à la table offers
ALTER TABLE offers
ADD COLUMN IF NOT EXISTS payment_status TEXT CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded'));

-- 4. Créer la table transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES offers(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    stripe_id TEXT NOT NULL,
    commission NUMERIC NOT NULL,
    payout_status BOOLEAN DEFAULT FALSE,
    payment_status TEXT CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Ajouter le trigger pour updated_at
DROP TRIGGER IF EXISTS set_transactions_updated_at ON transactions;

CREATE TRIGGER set_transactions_updated_at
BEFORE UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 6. Configurer RLS sur la table transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 7. Créer les politiques RLS
DROP POLICY IF EXISTS admin_transactions_policy ON transactions;

CREATE POLICY admin_transactions_policy ON transactions
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

DROP POLICY IF EXISTS prestataire_transactions_policy ON transactions;

CREATE POLICY prestataire_transactions_policy ON transactions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM offers 
            JOIN jobs ON offers.id = jobs.offer_id
            WHERE transactions.job_id = offers.id 
            AND jobs.prestataire_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS client_transactions_policy ON transactions;

CREATE POLICY client_transactions_policy ON transactions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM offers 
            JOIN jobs ON offers.id = jobs.offer_id
            WHERE transactions.job_id = offers.id 
            AND jobs.client_id = auth.uid()
        )
    );

-- 8. Créer la fonction check_prestataire_stripe_account
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

-- 9. Créer la fonction record_payment_transaction
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
    -- Vérification des paramètres
    IF p_job_id IS NULL OR p_amount <= 0 OR p_stripe_id IS NULL OR p_commission < 0 THEN
        RAISE EXCEPTION 'Paramètres invalides pour l''enregistrement de la transaction';
    END IF;

    -- Vérifier que le statut de paiement est valide
    IF p_payment_status NOT IN ('pending', 'processing', 'completed', 'failed', 'refunded') THEN
        RAISE EXCEPTION 'Statut de paiement invalide: %', p_payment_status;
    END IF;

    -- Insertion de la transaction
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
        p_payment_status = 'completed'
    )
    RETURNING id INTO transaction_id;

    -- Mise à jour du statut de l'offre
    IF p_payment_status = 'completed' THEN
        UPDATE offers SET 
            payment_status = 'completed',
            status = 'accepted'
        WHERE id = p_job_id;
    END IF;

    RETURN transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Attribution des droits d'exécution
GRANT EXECUTE ON FUNCTION check_prestataire_stripe_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_payment_transaction(UUID, NUMERIC, TEXT, NUMERIC, TEXT) TO authenticated;