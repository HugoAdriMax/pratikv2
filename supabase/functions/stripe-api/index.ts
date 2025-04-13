import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@12.5.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.32.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Récupérer la clé secrète Stripe depuis les variables d'environnement
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY est manquante dans les variables d\'environnement');
}

// Initialiser Stripe avec le client HTTP Fetch pour éviter les erreurs de microtasks
let stripe;
let stripeInitialized = false;

try {
  stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient()
  });
  stripeInitialized = true;
  console.log('✅ Client Stripe initialisé avec succès');
} catch (error) {
  console.error('❌ Erreur lors de l\'initialisation de Stripe:', error);
}

// Point d'entrée principal de la fonction
serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Vérification de santé
  const url = new URL(req.url);
  if (url.pathname.endsWith('/health')) {
    return new Response(
      JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        stripeInitialized,
        stripeApiKey: stripeSecretKey ? '✓ Configurée' : '✗ Manquante'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }

  // Endpoint de test simple
  if (url.pathname.endsWith('/test')) {
    return new Response(
      JSON.stringify({
        message: 'Test endpoint works!',
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }

  try {
    const path = url.pathname.split('/').pop();
    console.log(`📥 Requête reçue pour l'endpoint: ${path}`);

    // Extraire le corps de la requête
    let body;
    try {
      body = await req.json();
      console.log(`📦 Corps de la requête: ${JSON.stringify(body)}`);
    } catch (e) {
      body = {};
      console.log('📦 Corps de la requête vide ou invalide');
    }

    // Endpoint de création d'intention de paiement
    if (path === 'create-payment-intent') {
      return await handleCreatePaymentIntent(body);
    }

    // Endpoint pour confirmer les transferts après un paiement réussi
    if (path === 'confirm-transfer') {
      return await handleConfirmTransfer(body);
    }

    // Endpoint pour créer un compte Stripe Connect
    if (path === 'create-account') {
      return await handleCreateAccount(body);
    }

    // Endpoint pour générer un lien d'onboarding Stripe Connect
    if (path === 'onboarding-link') {
      return await handleOnboardingLink(body);
    }

    // Autres endpoints non implémentés pour cette version simplifiée
    return new Response(
      JSON.stringify({ error: 'Endpoint non trouvé ou non implémenté' }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  } catch (error) {
    console.error('❌ Erreur globale:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});

// Créer un compte Stripe Connect pour un prestataire
async function handleCreateAccount(body) {
  const { prestataireId, email, name } = body;

  console.log(`🔄 Création de compte Stripe Connect pour: prestataireId=${prestataireId}, email=${email}`);

  if (!prestataireId || !email) {
    return new Response(
      JSON.stringify({ error: 'Les paramètres prestataireId et email sont requis' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }

  try {
    // Créer un compte Stripe Express avec les informations du prestataire
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'FR',
      email: email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      business_profile: {
        name: name || email.split('@')[0],
        url: 'https://www.example.com', // URL fictif pour les tests
      },
      metadata: {
        prestataireId,
      },
    });

    console.log(`✅ Compte Stripe créé: ${account.id}`);

    // Mettre à jour l'utilisateur dans Supabase avec l'ID du compte Stripe
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Configuration Supabase manquante');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { error: updateError } = await supabase
      .from('users')
      .update({
        stripe_account_id: account.id,
        stripe_account_enabled: false // Compte créé mais pas encore activé
      })
      .eq('id', prestataireId);

    if (updateError) {
      console.error('❌ Erreur lors de la mise à jour des informations Stripe:', updateError);
      throw new Error(`Erreur lors de la mise à jour de l'utilisateur: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        accountId: account.id,
        success: true
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  } catch (stripeError) {
    console.error('❌ Erreur Stripe lors de la création du compte:', stripeError);

    return new Response(
      JSON.stringify({
        error: `Erreur Stripe: ${stripeError.message}`,
        stripeError: {
          type: stripeError.type,
          code: stripeError.code,
          param: stripeError.param
        }
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
}

// Créer un lien d'onboarding pour un compte Stripe
async function handleOnboardingLink(body) {
  const { accountId } = body;

  console.log(`🔄 Création d'un lien d'onboarding pour le compte: ${accountId}`);

  if (!accountId) {
    return new Response(
      JSON.stringify({ error: 'Le paramètre accountId est requis' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }

  try {
    // Créer un lien d'onboarding
    const onboardingLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: 'https://example.com/reauth', // URL à remplacer par votre URL réelle
      return_url: 'https://example.com/success', // URL à remplacer par votre URL réelle
      type: 'account_onboarding',
    });

    console.log(`✅ Lien d'onboarding créé: ${onboardingLink.url}`);

    return new Response(
      JSON.stringify({
        url: onboardingLink.url,
        success: true
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  } catch (stripeError) {
    console.error('❌ Erreur Stripe lors de la création du lien d\'onboarding:', stripeError);

    return new Response(
      JSON.stringify({
        error: `Erreur Stripe: ${stripeError.message}`,
        stripeError: {
          type: stripeError.type,
          code: stripeError.code,
          param: stripeError.param
        }
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
}

// Confirmer un transfert après un paiement réussi
async function handleConfirmTransfer(body) {
  const { offerId, clientSecret, totalAmount, prestataireId } = body;

  console.log(`🔄 Confirmation de transfert: offerId=${offerId}, montant=${totalAmount}`);

  if (!offerId || !clientSecret || !totalAmount || !prestataireId) {
    return new Response(
      JSON.stringify({ error: 'Paramètres incomplets pour la confirmation du transfert' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }

  try {
    // Récupérer les détails du PaymentIntent pour vérifier son statut
    const paymentIntentId = clientSecret.split('_secret_')[0];
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Vérifier si le paiement est réussi
    if (paymentIntent.status !== 'succeeded') {
      console.log(`⚠️ Le paiement n'est pas encore terminé. Statut actuel: ${paymentIntent.status}`);

      return new Response(
        JSON.stringify({
          status: paymentIntent.status,
          success: false,
          message: `Le paiement n'est pas encore terminé. Statut actuel: ${paymentIntent.status}`
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    console.log(`✅ Paiement confirmé avec succès: ${paymentIntent.id}`);

    // Calculer la commission (10%)
    const commission = Math.round(totalAmount * 0.1);

    // Mettre à jour la base de données avec les informations de transaction
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Configuration Supabase manquante');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Vérifier d'abord que l'offre existe pour éviter l'erreur de clé étrangère
    const { data: offerCheck, error: offerCheckError } = await supabase
      .from('offers')
      .select('id')
      .eq('id', offerId)
      .single();

    if (offerCheckError) {
      console.error(`❌ Erreur lors de la vérification de l'offre ${offerId}:`, offerCheckError);
      throw new Error(`L'offre avec ID ${offerId} n'existe pas ou n'est pas accessible`);
    }

    // Créer une entrée dans la table des transactions
    const { data: transactionData, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        job_id: offerId, // Utiliser offerId comme job_id (référence à la table offers)
        amount: totalAmount / 100, // Convertir en euros
        stripe_id: paymentIntent.id,
        commission: commission / 100, // Convertir en euros
        payment_status: 'completed', // Ajouter le statut de paiement requis par le schéma
        payout_status: true // Le transfert est direct avec Stripe Connect
      })
      .select()
      .single();

    if (transactionError) {
      console.error('❌ Erreur lors de l\'enregistrement de la transaction:', transactionError);
      throw new Error(`Erreur lors de l'enregistrement de la transaction: ${transactionError.message}`);
    } else {
      console.log(`✅ Transaction enregistrée dans la base de données: ${transactionData.id}`);
    }

    // Mettre à jour le statut de l'offre
    const { error: offerError } = await supabase
      .from('offers')
      .update({
        payment_status: 'completed',
        status: 'accepted'
      })
      .eq('id', offerId);

    if (offerError) {
      console.error('❌ Erreur lors de la mise à jour du statut de l\'offre:', offerError);
      throw new Error(`Erreur lors de la mise à jour du statut de l'offre: ${offerError.message}`);
    } else {
      console.log('✅ Statut de l\'offre mis à jour avec succès');
    }

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: transactionData?.id,
        message: 'Transfert confirmé avec succès'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  } catch (error) {
    console.error('❌ Erreur lors de la confirmation du transfert:', error);

    return new Response(
      JSON.stringify({
        error: `Erreur: ${error.message}`,
        success: false
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
}

// Créer une intention de paiement
async function handleCreatePaymentIntent(body) {
  const { offerId, totalAmount, clientId, prestataireId, isSimulatedAccount } = body;

  console.log(`🔄 Création de PaymentIntent: offerId=${offerId}, montant=${totalAmount}`);

  if (!offerId || !totalAmount) {
    return new Response(
      JSON.stringify({ error: 'Les paramètres offerId et totalAmount sont requis' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }

  if (!stripeInitialized || !stripeSecretKey) {
    return new Response(
      JSON.stringify({
        error: "Stripe n'est pas correctement configuré",
        debug: {
          initialized: stripeInitialized,
          hasApiKey: !!stripeSecretKey
        }
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }

  try {
    // Obtenir l'ID du compte Stripe du prestataire
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Configuration Supabase manquante');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Vérifier que l'offre existe
    const { data: offerCheck, error: offerCheckError } = await supabase
      .from('offers')
      .select('id')
      .eq('id', offerId)
      .single();

    if (offerCheckError) {
      console.error(`❌ Erreur lors de la vérification de l'offre ${offerId}:`, offerCheckError);
      throw new Error(`L'offre avec ID ${offerId} n'existe pas ou n'est pas accessible`);
    }

    // Chercher le compte Stripe du prestataire
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('stripe_account_id')
      .eq('id', prestataireId)
      .single();

    if (userError) {
      console.error('❌ Erreur lors de la récupération du compte Stripe:', userError);
      throw new Error(`Erreur lors de la récupération des informations du prestataire: ${userError.message}`);
    }

    const prestataireStripeAccountId = userData?.stripe_account_id;

    // Vérifier si le compte est simulé (depuis la requête ou en vérifiant l'ID)
    const isAccountSimulated = isSimulatedAccount ||
                              (prestataireStripeAccountId && prestataireStripeAccountId.startsWith('acct_simulated_'));

    // Si pas de compte Stripe ou compte simulé, créer un PaymentIntent standard sans transfers
    if (!prestataireStripeAccountId || isAccountSimulated) {
      console.log('⚠️ Le prestataire n\'a pas de compte Stripe réel ou utilise un compte simulé. Création d\'un PaymentIntent standard...');

      // Créer un PaymentIntent standard sans destination de transfert
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: 'eur',
        payment_method_types: ['card'],
        metadata: {
          offerId,
          prestataireId,
          clientId,
          applicationFee: Math.round(totalAmount * 0.1), // 10% de commission
          isSimulated: isAccountSimulated ? 'true' : 'false'
        }
      });

      console.log(`✅ Intention de paiement standard créée: ${paymentIntent.id}`);

      return new Response(
        JSON.stringify({
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          useConnectAccount: false
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    console.log(`🔍 Compte Stripe du prestataire trouvé: ${prestataireStripeAccountId}`);

    // Calculer le montant de la commission (10%)
    const applicationFeeAmount = Math.round(totalAmount * 0.1);
    const prestataireAmount = totalAmount - applicationFeeAmount;

    console.log(`💰 Détails financiers:
      - Montant total: ${totalAmount / 100}€
      - Commission (10%): ${applicationFeeAmount / 100}€
      - Montant prestataire: ${prestataireAmount / 100}€`);

    // Créer un PaymentIntent avec Connect pour le transfert direct
    // Utilisation du paramètre transfer_data pour automatiser le transfert
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'eur',
      payment_method_types: ['card'],
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: prestataireStripeAccountId,
      },
      metadata: {
        offerId,
        prestataireId,
        clientId,
        applicationFee: applicationFeeAmount
      }
    });

    console.log(`✅ Intention de paiement Connect créée: ${paymentIntent.id}`);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        useConnectAccount: true,
        prestataireAccountId: prestataireStripeAccountId
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  } catch (stripeError) {
    console.error('❌ Erreur Stripe:', stripeError);

    return new Response(
      JSON.stringify({
        error: `Erreur Stripe: ${stripeError.message}`,
        stripeError: {
          type: stripeError.type,
          code: stripeError.code,
          param: stripeError.param
        }
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
}