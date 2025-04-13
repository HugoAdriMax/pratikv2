-- Version mise à jour sans cors_origins qui n'existe pas
-- Simplement mettre le bucket en public
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Vérifier la structure de la table buckets
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'storage' AND table_name = 'buckets';
