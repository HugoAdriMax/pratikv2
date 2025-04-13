import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Récupérer les clés depuis les variables d'environnement ou depuis Constants
const getSupabaseUrl = (): string => {
  // Priorités:
  // 1. Variables d'environnement process.env (pour le déploiement)
  // 2. Extra du manifest Expo (pour le développement)
  // 3. Valeur par défaut
  if (process.env.SUPABASE_URL) {
    return process.env.SUPABASE_URL;
  }
  
  if (Constants.expoConfig?.extra?.supabaseUrl) {
    return Constants.expoConfig.extra.supabaseUrl;
  }
  
  // Valeur par défaut (ne jamais utiliser en production)
  return 'https://mkexcgwxenvzhbbopnko.supabase.co';
};

const getSupabaseKey = (): string => {
  if (process.env.SUPABASE_KEY) {
    return process.env.SUPABASE_KEY;
  }
  
  if (Constants.expoConfig?.extra?.supabaseKey) {
    return Constants.expoConfig.extra.supabaseKey;
  }
  
  // Valeur par défaut (ne jamais utiliser en production)
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZXhjZ3d4ZW52emhiYm9wbmtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5NjgyNzEsImV4cCI6MjA1OTU0NDI3MX0.i62OyrXUnPQRTfZto9mNiMUf2W-e--8gOCj6z6lrCHk';
};

const options = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'Cache-Control': 'no-store',
    },
  },
};

const supabase = createClient(getSupabaseUrl(), getSupabaseKey(), options);

export default supabase;