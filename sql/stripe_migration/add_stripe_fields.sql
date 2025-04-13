-- Ajouter des champs pour Stripe à la table users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_account_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Ajouter le statut de paiement dans la table offers
ALTER TABLE offers
ADD COLUMN IF NOT EXISTS payment_status TEXT CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded'));

-- Créer une table pour les transactions de paiement
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

-- Ajouter une mise à jour automatique du timestamp updated_at pour la table transactions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_transactions_updated_at') THEN
        CREATE TRIGGER set_transactions_updated_at
        BEFORE UPDATE ON transactions
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
    END IF;
END
$$;

-- Créer une politique de sécurité (RLS) pour la table transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Politique pour l'administrateur
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_transactions_policy') THEN
        CREATE POLICY admin_transactions_policy ON transactions
            FOR ALL
            TO authenticated
            USING (EXISTS (
                SELECT 1 FROM users
                WHERE users.id = auth.uid() AND users.role = 'admin'
            ));
    END IF;
END
$$;

-- Politique pour le prestataire (peut voir ses propres transactions)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'prestataire_transactions_policy') THEN
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
    END IF;
END
$$;

-- Politique pour le client (peut voir ses propres transactions)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'client_transactions_policy') THEN
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
    END IF;
END
$$;