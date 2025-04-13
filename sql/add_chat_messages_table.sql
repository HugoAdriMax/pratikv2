-- Ajout de la table de messages de chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index pour accélérer les requêtes
CREATE INDEX IF NOT EXISTS chat_messages_job_id_idx ON public.chat_messages(job_id);
CREATE INDEX IF NOT EXISTS chat_messages_sender_id_idx ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS chat_messages_receiver_id_idx ON public.chat_messages(receiver_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON public.chat_messages(created_at);

-- RLS (Row Level Security) pour la table chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Politique de sécurité : les utilisateurs ne peuvent voir que les messages qu'ils ont envoyés ou reçus
CREATE POLICY "Users can view their own messages" ON public.chat_messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- Les utilisateurs peuvent insérer des messages s'ils sont l'expéditeur
CREATE POLICY "Users can insert messages they send" ON public.chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
  );

-- Les utilisateurs peuvent mettre à jour uniquement le champ is_read des messages qu'ils ont reçus
CREATE POLICY "Users can update is_read for received messages" ON public.chat_messages
  FOR UPDATE USING (
    auth.uid() = receiver_id
  ) WITH CHECK (
    auth.uid() = receiver_id AND 
    (
      -- S'assurer que seul le champ is_read est modifié
      NEW.id = OLD.id AND
      NEW.job_id = OLD.job_id AND
      NEW.sender_id = OLD.sender_id AND
      NEW.receiver_id = OLD.receiver_id AND
      NEW.content = OLD.content AND
      NEW.created_at = OLD.created_at
    )
  );

-- Ajouter un déclencheur pour mettre à jour updated_at lors des modifications
CREATE OR REPLACE FUNCTION update_chat_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_messages_updated_at
BEFORE UPDATE ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION update_chat_messages_updated_at();