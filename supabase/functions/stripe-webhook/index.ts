import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@12.5.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.32.0'

// Créer un client Supabase d'abord pour réduire les problèmes potentiels avec les imports
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey)

// Configuration Stripe
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Handler pour l'événement account.updated - défini avant d'être utilisé
async function handleAccountUpdated(event) {
  try {
    const account = event.data.object
    const prestataireId = account.metadata?.prestataireId
    
    if (prestataireId) {
      console.log(`Mise à jour du compte pour le prestataire: ${prestataireId}`)
      // Mettre à jour le statut du compte dans la base de données
      const { error } = await supabaseClient
        .from('users')
        .update({ 
          stripe_account_enabled: account.charges_enabled && account.payouts_enabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', prestataireId)
        
      if (error) {
        console.error('Erreur lors de la mise à jour du statut du compte:', error)
      } else {
        console.log(`Statut du compte mis à jour avec succès pour: ${prestataireId}`)
      }
    }
  } catch (err) {
    console.error('Erreur dans handleAccountUpdated:', err)
  }
}

// Handler pour l'événement payment_intent.succeeded - défini avant d'être utilisé
async function handlePaymentIntentSucceeded(event) {
  try {
    const paymentIntent = event.data.object
    const offerId = paymentIntent.metadata?.offerId
    
    if (offerId) {
      console.log(`Traitement du paiement réussi pour l'offre: ${offerId}`)
      // Calculer la commission (10%)
      const amount = paymentIntent.amount / 100 // Conversion en euros
      const commission = amount * 0.1
      
      // Enregistrer la transaction
      const { data, error } = await supabaseClient.rpc(
        'record_payment_transaction',
        {
          p_job_id: offerId,
          p_amount: amount,
          p_stripe_id: paymentIntent.id,
          p_commission: commission,
          p_payment_status: 'completed'
        }
      )
      
      if (error) {
        console.error('Erreur lors de l\'enregistrement de la transaction:', error)
      } else {
        console.log(`Transaction enregistrée avec succès pour l'offre: ${offerId}`)
      }
    }
  } catch (err) {
    console.error('Erreur dans handlePaymentIntentSucceeded:', err)
  }
}

// Point d'entrée principal de la fonction
serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Vérification de santé simple
  const url = new URL(req.url)
  if (url.pathname.endsWith('/health')) {
    return new Response(
      JSON.stringify({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        env: {
          hasStripeKey: !!stripeSecretKey,
          hasWebhookSecret: !!webhookSecret,
          hasSupabaseUrl: !!supabaseUrl,
          hasSupabaseKey: !!supabaseServiceRoleKey
        }
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    )
  }

  // Vérifier la signature du webhook
  const signature = req.headers.get('stripe-signature')
  
  if (!signature) {
    console.error('Aucune signature Stripe trouvée')
    return new Response(
      JSON.stringify({ error: 'Aucune signature Stripe trouvée' }),
      { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    )
  }
  
  try {
    // Récupérer le corps brut de la requête
    const body = await req.text()
    
    // Vérifier la signature Stripe en utilisant un bloc try/catch spécifique
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      )
    } catch (verificationError) {
      console.error('Erreur de vérification de signature:', verificationError)
      return new Response(
        JSON.stringify({ error: 'Signature invalide' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      )
    }
    
    console.log(`Événement webhook reçu: ${event.type}`)

    // Traiter l'événement selon son type avec une gestion d'erreur spécifique
    try {
      switch (event.type) {
        case 'account.updated':
          await handleAccountUpdated(event)
          break
        case 'payment_intent.succeeded':
          await handlePaymentIntentSucceeded(event)
          break
        default:
          console.log(`Événement non géré: ${event.type}`)
      }
    } catch (handlerError) {
      console.error(`Erreur lors du traitement de l'événement ${event.type}:`, handlerError)
      // Continuer même si le handler a échoué, pour ne pas bloquer la réponse à Stripe
    }
    
    // Essayer d'enregistrer l'événement, mais ne pas échouer si cela ne fonctionne pas
    try {
      // Appeler la fonction SQL pour enregistrer l'événement
      const { data, error } = await supabaseClient.rpc(
        'process_stripe_webhook',
        {
          p_event_id: event.id,
          p_event_type: event.type,
          p_object_id: event.data.object.id,
          p_object_type: event.data.object.object,
          p_data: event
        }
      )
      
      if (error) {
        console.error('Erreur lors de l\'enregistrement de l\'événement dans la base de données:', error)
      } else {
        console.log('Événement enregistré avec succès dans la base de données')
      }
    } catch (dbError) {
      console.error('Exception lors de l\'enregistrement de l\'événement:', dbError)
      // Ne pas échouer complètement à cause d'une erreur de base de données
    }
    
    // Toujours retourner un succès à Stripe pour éviter les retenues
    return new Response(
      JSON.stringify({ received: true }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    )
  } catch (err) {
    console.error('Erreur webhook générale:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    )
  }
})