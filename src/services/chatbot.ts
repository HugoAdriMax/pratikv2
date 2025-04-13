import OpenAI from 'openai';
import Constants from 'expo-constants';

// Récupérer la clé API OpenAI depuis les variables d'environnement ou Constants
const getOpenAIKey = (): string => {
  // Priorités:
  // 1. Variables d'environnement process.env (pour le déploiement)
  // 2. Extra du manifest Expo (pour le développement)
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }
  
  if (Constants.expoConfig?.extra?.openaiApiKey) {
    return Constants.expoConfig.extra.openaiApiKey;
  }
  
  console.warn('Aucune clé API OpenAI trouvée dans les variables d\'environnement ou le manifest Expo');
  return ''; // Retourner une chaîne vide si aucune clé n'est trouvée
};

// Déterminer si nous utilisons une clé API Projects d'OpenAI (commence par sk-proj-)
const isProjectKey = (key: string): boolean => {
  return key.startsWith('sk-proj-');
}

// Initialiser le client OpenAI avec la clé API appropriée
const apiKey = getOpenAIKey();
const openai = new OpenAI({
  apiKey,
  dangerouslyAllowBrowser: true, // Pour l'utilisation côté client
  baseURL: isProjectKey(apiKey) ? 'https://api.openai.com/v1' : undefined, // S'assurer que l'URL de base est correcte pour les clés de projet
});

interface ChatbotResponse {
  type: string;
  content: string;
  data?: any;
}

// Les types de messages que le chatbot peut reconnaître
const MESSAGE_TYPES = {
  SERVICE_REQUEST: 'service_request',
  LOCATION: 'location',
  URGENCY: 'urgency',
  ADDITIONAL_INFO: 'additional_info',
  GENERAL: 'general'
};

// Fonction pour analyser la demande de l'utilisateur
export const analyzeChatMessage = async (message: string, conversationHistory: string[] = []): Promise<ChatbotResponse> => {
  try {
    // Vérifier que la clé API est configurée
    if (!apiKey) {
      throw new Error('Clé API OpenAI non configurée');
    }

    // Construire le contexte de la conversation
    const conversationContext = conversationHistory.length > 0 
      ? conversationHistory.join('\n') + '\n\nUtilisateur: ' + message
      : 'Utilisateur: ' + message;
    
    const prompt = `
      Tu es un assistant intelligent pour une plateforme de mise en relation entre clients et prestataires de services.
      
      Analyse ce message de l'utilisateur: "${conversationContext}"
      
      Si l'utilisateur demande un service spécifique ou mentionne un métier (par exemple "menuisier", "électricien", "plombier", etc.), réponds avec:
      - type: "service_request"
      - content: normalise toujours le nom du service sous sa forme standard, par exemple:
        * menuisier → menuiserie
        * électricien → électricité
        * plombier → plomberie
        * carreleur → carrelage
        * peintre → peinture
        * jardinier → jardinage
        Ceci est TRÈS IMPORTANT car le système a besoin du nom standardisé pour trouver le bon service.
        
      Si l'utilisateur indique une localisation ou une adresse, réponds avec le type "location" et extrais l'adresse.
      
      Si l'utilisateur mentionne une urgence ou un délai, réponds avec:
      - type: "urgency"
      - content: description textuelle de l'urgence
      - data: { level: X } où X est un nombre entre 1 et 5 représentant le niveau d'urgence
      
      Si l'utilisateur donne des détails additionnels sur sa demande, réponds avec le type "additional_info".
      Sinon, réponds avec le type "general".
      
      Réponds UNIQUEMENT au format JSON avec les propriétés "type", "content", et éventuellement "data" pour des informations structurées.
      
      Exemples corrects:
      - "J'ai besoin d'un menuisier pour réparer ma table" → {"type":"service_request","content":"menuiserie"}
      - "Je cherche un électricien" → {"type":"service_request","content":"électricité"}
      - "J'habite à Paris 15ème" → {"type":"location","content":"Paris 15ème"}
      - "C'est urgent" → {"type":"urgency","content":"Très urgent","data":{"level":5}}
    `;

    console.log("Envoi de la requête à l'API OpenAI...");
    console.log(`Utilisation d'une clé API de type: ${isProjectKey(apiKey) ? 'Projects' : 'Standard'}`);

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: message }
      ],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '';
    
    try {
      // Essayer de parser la réponse JSON
      const parsedResponse = JSON.parse(content);
      return parsedResponse;
    } catch (e) {
      // Fallback si la réponse n'est pas un JSON valide
      return {
        type: MESSAGE_TYPES.GENERAL,
        content: content
      };
    }
  } catch (error) {
    console.error('Erreur lors de l\'analyse du message:', error);
    return {
      type: MESSAGE_TYPES.GENERAL,
      content: "Je suis désolé, je n'ai pas pu analyser votre message. Pouvez-vous reformuler votre demande?"
    };
  }
};

// Fonction pour générer une réponse basée sur l'analyse
export const generateChatbotResponse = async (analysis: ChatbotResponse, conversationHistory: string[] = []): Promise<string> => {
  try {
    // Vérifier que la clé API est configurée
    if (!apiKey) {
      throw new Error('Clé API OpenAI non configurée');
    }

    let systemPrompt = '';
    
    switch (analysis.type) {
      case MESSAGE_TYPES.SERVICE_REQUEST:
        systemPrompt = `L'utilisateur cherche un service de "${analysis.content}". 
          Confirme que tu as bien compris son besoin et précise exactement le service que tu as identifié.
          Demande-lui maintenant son adresse ou sa localisation pour trouver des prestataires à proximité.
          
          Par exemple: "J'ai bien noté que vous recherchez un prestataire en menuiserie. Pour trouver des artisans disponibles près de chez vous, pouvez-vous m'indiquer votre adresse?"`;
        break;
      case MESSAGE_TYPES.LOCATION:
        systemPrompt = `L'utilisateur a indiqué sa localisation: "${analysis.content}" et le système a validé cette adresse.
          Confirme à l'utilisateur que son adresse a été validée.
          Puis demande-lui de préciser l'urgence de sa demande sur une échelle de 1 à 5 (1 = pas urgent, peut attendre plusieurs jours, 5 = très urgent, besoin immédiat).
          
          Par exemple: "Parfait, j'ai bien enregistré et validé votre adresse. Sur une échelle de 1 à 5, quel est le niveau d'urgence de votre demande? (1 = pas urgent, 5 = très urgent)"`;
        break;
      case MESSAGE_TYPES.URGENCY:
        systemPrompt = `L'utilisateur a indiqué le niveau d'urgence: "${analysis.content}". 
          Demande-lui s'il souhaite ajouter des informations complémentaires qui pourraient aider le prestataire à mieux comprendre sa demande.
          
          Par exemple: "J'ai bien noté le niveau d'urgence. Souhaitez-vous ajouter des détails supplémentaires concernant votre demande? Par exemple, la nature du problème, des spécificités de votre situation, etc."`;
        break;
      case MESSAGE_TYPES.ADDITIONAL_INFO:
        systemPrompt = `L'utilisateur a fourni ces informations complémentaires: "${analysis.content}". 
          Récapitule toutes les informations collectées (service, localisation, urgence, détails) et demande à l'utilisateur s'il est prêt à créer sa demande.
          Indique-lui qu'il verra apparaître un récapitulatif avec un bouton "Valider ma demande" s'il a complété toutes les informations nécessaires.
          
          Par exemple: "Merci pour ces précisions. Voici un récapitulatif de votre demande: [résumé]. Si toutes les informations sont correctes, vous devriez voir un récapitulatif s'afficher. Vous pouvez cliquer sur 'Valider ma demande' pour finaliser."`;
        break;
      default:
        systemPrompt = `Réponds à l'utilisateur de manière amicale et professionnelle. 
          Si tu ne comprends pas sa demande, demande-lui de préciser quel service il recherche parmi les choix suivants: plomberie, électricité, menuiserie, peinture, jardinage, nettoyage, ou autre service.
          
          Par exemple: "Bonjour! Je suis Pat, votre assistant Pratik. Je peux vous aider à trouver un prestataire. Quel type de service recherchez-vous? Par exemple: plomberie, électricité, menuiserie, etc."`;
    }
    
    // Contexte de la conversation pour une meilleure continuité
    const conversationContext = conversationHistory.length > 0 
      ? conversationHistory.join('\n') 
      : '';
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: `Tu es un assistant virtuel amical pour une plateforme de services. 
                                   Sois concis, professionnel et utile. ${systemPrompt}` },
        ...(conversationContext ? [{ role: 'user', content: conversationContext }] : []),
        { role: 'user', content: `Analyse: ${JSON.stringify(analysis)}` }
      ],
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || "Je suis désolé, je n'ai pas pu générer une réponse.";
  } catch (error) {
    console.error('Erreur lors de la génération de la réponse:', error);
    return "Je suis désolé, une erreur s'est produite. Pouvez-vous réessayer?";
  }
};