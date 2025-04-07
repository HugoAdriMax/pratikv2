import OpenAI from 'openai';

// Initialisez avec votre clé API (à configurer dans un fichier .env)
const openai = new OpenAI({
  apiKey: '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', // Remplacez par votre clé API OpenAI
  dangerouslyAllowBrowser: true // Pour l'utilisation côté client
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
    // Construire le contexte de la conversation
    const conversationContext = conversationHistory.length > 0 
      ? conversationHistory.join('\n') + '\n\nUtilisateur: ' + message
      : 'Utilisateur: ' + message;
    
    const prompt = `
      Tu es un assistant intelligent pour une plateforme de mise en relation entre clients et prestataires de services.
      
      Analyse ce message de l'utilisateur: "${conversationContext}"
      
      Si l'utilisateur demande un service spécifique, réponds avec le type "service_request" et identifie le service demandé.
      Si l'utilisateur indique une localisation ou une adresse, réponds avec le type "location" et extrais l'adresse.
      Si l'utilisateur mentionne une urgence ou un délai, réponds avec le type "urgency" et évalue le niveau d'urgence (1-5).
      Si l'utilisateur donne des détails additionnels sur sa demande, réponds avec le type "additional_info".
      Sinon, réponds avec le type "general".
      
      Réponds au format JSON avec les propriétés "type" et "content", et éventuellement "data" pour des informations structurées.
    `;

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
    let systemPrompt = '';
    
    switch (analysis.type) {
      case MESSAGE_TYPES.SERVICE_REQUEST:
        systemPrompt = `L'utilisateur cherche un service de "${analysis.content}". 
          Demande-lui maintenant sa localisation pour trouver des prestataires à proximité.`;
        break;
      case MESSAGE_TYPES.LOCATION:
        systemPrompt = `L'utilisateur a indiqué sa localisation: "${analysis.content}". 
          Demande-lui maintenant si sa demande est urgente (sur une échelle de 1 à 5).`;
        break;
      case MESSAGE_TYPES.URGENCY:
        systemPrompt = `L'utilisateur a indiqué le niveau d'urgence: "${analysis.content}". 
          Demande-lui s'il souhaite ajouter des informations complémentaires ou une photo.`;
        break;
      case MESSAGE_TYPES.ADDITIONAL_INFO:
        systemPrompt = `L'utilisateur a fourni ces informations complémentaires: "${analysis.content}". 
          Confirme que tu as bien compris sa demande et indique que tu vas rechercher des prestataires disponibles.`;
        break;
      default:
        systemPrompt = `Réponds à l'utilisateur de manière amicale et professionnelle. 
          Si tu ne comprends pas sa demande, demande-lui de préciser quel service il recherche.`;
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