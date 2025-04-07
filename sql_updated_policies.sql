-- Politique pour les demandes: les prestataires ne voient que les demandes non acceptées
DROP POLICY IF EXISTS "Les prestataires peuvent voir toutes les demandes" ON requests;

CREATE POLICY "Les prestataires voient seulement les demandes non acceptées" ON requests
  FOR SELECT
  USING (
    (auth.jwt() ->> 'role' = 'prestataire') AND
    (status <> 'accepted')
  );

-- Politiques pour les offres - ne permettant de faire une offre que sur les demandes en statut pending ou offered
-- D'abord, vérifions si la table offers a bien les policies activées
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- Politique pour les offres - permettant aux prestataires de créer des offres
CREATE POLICY "Les prestataires peuvent créer des offres" ON offers
  FOR INSERT
  WITH CHECK (
    (auth.uid() = prestataire_id) AND
    EXISTS (
      SELECT 1 FROM requests 
      WHERE requests.id = request_id 
      AND (status = 'pending' OR status = 'offered')
    )
  );

-- Politique pour les offres - permettant aux prestataires et clients de voir les offres
CREATE POLICY "Les offres sont visibles par le prestataire concerné et le client" ON offers
  FOR SELECT
  USING (
    auth.uid() = prestataire_id OR
    EXISTS (
      SELECT 1 FROM requests 
      WHERE requests.id = request_id 
      AND requests.client_id = auth.uid()
    ) OR
    auth.jwt() ->> 'role' = 'admin'
  );

-- Confirmation des nouvelles politiques
SELECT policynamemgable, permissionname, schemaname FROM pg_policies WHERE tablename = 'requests' OR tablename = 'offers';
