/*
INSTRUCTIONS POUR LE CLIENT:

Ce fichier contient une solution de contournement pour le problème de saisie dans le formulaire de profil.

Au lieu de modifier le code React, nous utiliserons une approche alternative qui permet de modifier les valeurs
du profil sans utiliser les champs de saisie qui causent le problème.

MÉTHODE:
1. Ouvrez la console de développement dans votre simulateur/émulateur (iOS: Cmd+D, Android: Ctrl+M)
2. Sélectionnez "Debug JS Remotely" ou "Debug"
3. Collez et exécutez le code ci-dessous dans la console de développement
4. Suivez les instructions qui apparaissent à l'écran
*/

// Solution de contournement pour le problème de saisie dans le formulaire de profil
(function() {
  console.log("=== SOLUTION DE CONTOURNEMENT POUR LE PROFIL ===");
  
  // Vérifier si nous sommes sur la page de profil
  if (!window.location.href.includes('profile')) {
    console.error("⚠️ Veuillez d'abord naviguer vers l'écran de modification de profil !");
    return;
  }
  
  // Trouver le contexte d'authentification
  let authContext;
  try {
    // Parcourir la hiérarchie React pour trouver le contexte Auth
    authContext = document.querySelector('[data-testid="root"]').__reactInternalInstance.memoizedProps.children.props.auth;
    
    if (!authContext || !authContext.user) {
      throw new Error("Contexte d'authentification non trouvé");
    }
  } catch (e) {
    console.error("⚠️ Impossible de trouver le contexte d'authentification. Vérifiez que vous êtes connecté et sur la page de profil.");
    return;
  }
  
  // Créer un formulaire alternatif
  const createAlternativeForm = () => {
    // Supprimer l'ancien formulaire s'il existe
    const oldForm = document.getElementById('profile-workaround');
    if (oldForm) {
      document.body.removeChild(oldForm);
    }
    
    // Créer un nouvel élément div pour le formulaire
    const formContainer = document.createElement('div');
    formContainer.id = 'profile-workaround';
    formContainer.style.position = 'fixed';
    formContainer.style.top = '50px';
    formContainer.style.left = '10px';
    formContainer.style.right = '10px';
    formContainer.style.backgroundColor = 'white';
    formContainer.style.padding = '20px';
    formContainer.style.borderRadius = '10px';
    formContainer.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
    formContainer.style.zIndex = '9999';
    formContainer.style.maxHeight = '80vh';
    formContainer.style.overflowY = 'auto';
    
    // Ajouter un titre
    const title = document.createElement('h2');
    title.textContent = 'Modification de profil (solution temporaire)';
    title.style.marginBottom = '20px';
    formContainer.appendChild(title);
    
    // Créer les champs du formulaire
    const fields = [
      { id: 'name', label: 'Nom', value: authContext.user.name || '', type: 'text' },
      { id: 'phone', label: 'Téléphone', value: authContext.user.phone || '', type: 'tel' },
      { id: 'address', label: 'Adresse', value: authContext.user.address || '', type: 'text' }
    ];
    
    // Ajouter le champ SIRET si c'est un prestataire
    if (authContext.user.role === 'prestataire') {
      fields.push({ 
        id: 'business_reg_number', 
        label: 'Numéro SIRET/SIREN', 
        value: authContext.user.business_reg_number || '', 
        type: 'text' 
      });
    }
    
    // Créer chaque champ
    fields.forEach(field => {
      const fieldContainer = document.createElement('div');
      fieldContainer.style.marginBottom = '15px';
      
      const label = document.createElement('label');
      label.htmlFor = field.id;
      label.textContent = field.label;
      label.style.display = 'block';
      label.style.marginBottom = '5px';
      label.style.fontWeight = 'bold';
      
      const input = document.createElement('input');
      input.type = field.type;
      input.id = field.id;
      input.value = field.value;
      input.style.width = '100%';
      input.style.padding = '10px';
      input.style.borderRadius = '5px';
      input.style.border = '1px solid #ccc';
      
      fieldContainer.appendChild(label);
      fieldContainer.appendChild(input);
      formContainer.appendChild(fieldContainer);
    });
    
    // Ajouter les boutons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.justifyContent = 'space-between';
    buttonsContainer.style.marginTop = '20px';
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Annuler';
    cancelButton.style.padding = '10px 20px';
    cancelButton.style.backgroundColor = '#f1f1f1';
    cancelButton.style.border = 'none';
    cancelButton.style.borderRadius = '5px';
    cancelButton.style.cursor = 'pointer';
    cancelButton.onclick = () => {
      document.body.removeChild(formContainer);
    };
    
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Enregistrer';
    saveButton.style.padding = '10px 20px';
    saveButton.style.backgroundColor = '#4CAF50';
    saveButton.style.color = 'white';
    saveButton.style.border = 'none';
    saveButton.style.borderRadius = '5px';
    saveButton.style.cursor = 'pointer';
    saveButton.onclick = async () => {
      // Récupérer les valeurs
      const updatedData = {
        name: document.getElementById('name').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        address: document.getElementById('address').value.trim(),
        updated_at: new Date().toISOString()
      };
      
      // Ajouter le numéro SIRET si présent
      if (authContext.user.role === 'prestataire') {
        updatedData.business_reg_number = document.getElementById('business_reg_number').value.trim();
      }
      
      try {
        // Mise à jour directe dans Supabase
        const response = await fetch('https://YOUR_SUPABASE_URL/rest/v1/users?id=eq.' + authContext.user.id, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('supabase.auth.token')
          },
          body: JSON.stringify(updatedData)
        });
        
        if (response.ok) {
          alert('Profil mis à jour avec succès !');
          document.body.removeChild(formContainer);
          // Rafraîchir la page
          window.location.reload();
        } else {
          alert('Erreur lors de la mise à jour du profil: ' + response.statusText);
        }
      } catch (error) {
        alert('Erreur: ' + error.message);
      }
    };
    
    buttonsContainer.appendChild(cancelButton);
    buttonsContainer.appendChild(saveButton);
    formContainer.appendChild(buttonsContainer);
    
    // Ajouter le formulaire à la page
    document.body.appendChild(formContainer);
  };
  
  // Exécuter la création du formulaire
  createAlternativeForm();
  
  console.log("✅ Formulaire alternatif affiché ! Utilisez-le pour modifier votre profil.");
})();