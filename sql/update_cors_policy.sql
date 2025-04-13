-- Ajuster les configurations CORS pour le bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Définir des politiques CORS explicites
BEGIN;
UPDATE storage.buckets
SET cors_origins = array['*'],
    cors_methods = array['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    cors_allowed_headers = array['*'],
    cors_exposed_headers = array['*'],
    cors_max_age = 3600
WHERE id = 'chat-media';
COMMIT;
