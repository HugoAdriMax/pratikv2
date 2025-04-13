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