import { createClient } from '@supabase/supabase-js';

// Les clés doivent être configurées dans un fichier .env 
// Ces valeurs sont temporaires et devront être remplacées par les vraies clés
const supabaseUrl = 'https://mkexcgwxenvzhbbopnko.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZXhjZ3d4ZW52emhiYm9wbmtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5NjgyNzEsImV4cCI6MjA1OTU0NDI3MX0.i62OyrXUnPQRTfZto9mNiMUf2W-e--8gOCj6z6lrCHk';

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;