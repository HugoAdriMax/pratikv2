-- Ajouter une colonne pour stocker l'URL de l'image dans les messages de chat
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- S'assurer que les politiques RLS sont mises à jour pour prendre en compte la nouvelle colonne
DROP POLICY IF EXISTS "Users can update is_read for received messages" ON public.chat_messages;

CREATE POLICY "Users can update is_read for received messages" ON public.chat_messages
  FOR UPDATE USING (
    auth.uid() = receiver_id
  );