-- Vérifier les politiques existantes sur la table transactions
SELECT * FROM pg_policies WHERE tablename = 'transactions';

-- Supprimer les politiques existantes sur la table transactions
DROP POLICY IF EXISTS "Transactions are viewable by authenticated users" ON transactions;
DROP POLICY IF EXISTS "Transactions are insertable by authenticated users" ON transactions;
DROP POLICY IF EXISTS "Transactions are updatable by authenticated users" ON transactions;

-- Activer RLS sur la table transactions si ce n'est pas déjà fait
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Créer une politique qui permet à tous les utilisateurs authentifiés de lire les transactions
CREATE POLICY "Transactions are viewable by authenticated users"
ON transactions FOR SELECT
USING (auth.role() = 'authenticated');

-- Créer une politique qui permet à tous les utilisateurs authentifiés d'insérer des transactions
CREATE POLICY "Transactions are insertable by authenticated users"
ON transactions FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Créer une politique qui permet à tous les utilisateurs authentifiés de mettre à jour les transactions
CREATE POLICY "Transactions are updatable by authenticated users"
ON transactions FOR UPDATE
USING (auth.role() = 'authenticated');

-- Vérifier que les politiques ont été correctement créées
SELECT * FROM pg_policies WHERE tablename = 'transactions';