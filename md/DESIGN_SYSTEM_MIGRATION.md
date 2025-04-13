# Plan de migration vers le Design System

Ce document décrit le plan de migration progressif pour adopter le Design System dans l'ensemble de l'application. L'objectif est d'améliorer la cohérence visuelle, la maintenabilité et la réutilisation des composants sans perturber le fonctionnement actuel de l'application.

## Architecture du Design System

Le Design System est organisé comme suit :

```
src/design-system/
  ├── components/           # Composants réutilisables
  │   ├── Button.tsx        # Composants d'interface utilisateur
  │   ├── Box.tsx           # Composants de mise en page
  │   ├── ...
  │   └── index.ts          # Point d'entrée pour tous les composants
  ├── tokens.ts             # Variables de design (couleurs, espacements, etc.)
  └── index.ts              # Point d'entrée principal
```

## Phases de migration

### Phase 1 : Préparation et fondations (Actuelle)

- [x] Créer la structure de base du Design System
- [x] Définir les tokens de design (couleurs, espacements, etc.)
- [x] Créer les composants fondamentaux (Button, Box, Container, etc.)
- [x] Mettre en place l'écran de démonstration
- [ ] Documenter l'utilisation des composants

### Phase 2 : Migration des composants UI existants (Prochaine étape)

- [ ] Migrer le composant Input
- [ ] Migrer le composant Text avec support amélioré de la typographie
- [ ] Migrer le composant Card
- [ ] Migrer le composant Badge
- [ ] Créer des guidelines d'utilisation pour chaque composant

### Phase 3 : Migration des écrans principaux

- [ ] Identifier les écrans les plus utilisés
- [ ] Remplacer les imports de composants existants par ceux du Design System
- [ ] Tester minutieusement chaque écran migré
- [ ] Monitorer les performances et corriger les problèmes

### Phase 4 : Finalisation et standardisation

- [ ] Migrer les écrans restants
- [ ] Éliminer les composants dupliqués
- [ ] Documenter le Design System complet
- [ ] Former l'équipe à l'utilisation du Design System

## Guide de migration des écrans

Pour migrer un écran existant vers le Design System, suivez ces étapes :

1. **Importation** : Remplacez les imports des composants UI par ceux du Design System

   ```tsx
   // Avant
   import { Text, Card, Button } from '../../components/ui';
   
   // Après
   import { Text, Card, Button } from '../../design-system';
   ```

2. **Adaptez les props** si nécessaire
   
   ```tsx
   // Avant
   <Button 
     title="Connexion" 
     variant="primary" 
     onPress={handleLogin} 
   />
   
   // Après
   <Button 
     label="Connexion" // 'title' devient 'label'
     variant="primary" 
     onPress={handleLogin} 
   />
   ```

3. **Utilisez les nouveaux composants de mise en page** pour simplifier le code
   
   ```tsx
   // Avant
   <View style={{ 
     marginBottom: 16, 
     padding: 16, 
     backgroundColor: COLORS.white,
     borderRadius: BORDER_RADIUS.md,
     ...SHADOWS.small
   }}>
     <Text>Contenu</Text>
   </View>
   
   // Après
   <Box 
     margin="md" 
     padding="md" 
     background="white" 
     borderRadius="md" 
     elevation="sm"
   >
     <Text>Contenu</Text>
   </Box>
   ```

4. **Utilisez Spacer** au lieu de margins vides
   
   ```tsx
   // Avant
   <View style={{ marginBottom: 16 }} />
   
   // Après
   <Spacer size="md" />
   ```

5. **Utilisez Divider** pour les séparateurs
   
   ```tsx
   // Avant
   <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 16 }} />
   
   // Après
   <Divider spacing="md" />
   ```

## Bonnes pratiques

1. **Migration progressive** : Migrez un écran à la fois, en commençant par les moins complexes
2. **Tests approfondis** : Testez chaque écran après migration
3. **Rétrocompatibilité** : Maintenez la compatibilité avec les anciens composants pendant la transition
4. **Cohérence** : Suivez les guidelines du Design System pour l'utilisation des couleurs, espacements, etc.
5. **Documentation** : Documentez les changements et mettez à jour la documentation du Design System

## Exemple d'écran migré

Voici un exemple de migration de l'écran de profil :

```tsx
// Avant
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Button } from '../../components/ui';
import { COLORS, SPACING } from '../../utils/theme';

const ProfileScreen = () => {
  return (
    <View style={styles.container}>
      <Card style={styles.profileCard}>
        <Text variant="h4">John Doe</Text>
        <View style={styles.separator} />
        <Text>john.doe@example.com</Text>
        <View style={{ marginBottom: 16 }} />
        <Button label="Modifier" onPress={() => {}} />
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
  },
  profileCard: {
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  }
});

// Après
import React from 'react';
import { Box, Container, Text, Card, Button, Divider, Spacer } from '../../design-system';

const ProfileScreen = () => {
  return (
    <Container padding="md" background="background" flex>
      <Card padding="md">
        <Text variant="h4">John Doe</Text>
        <Divider spacing="md" />
        <Text>john.doe@example.com</Text>
        <Spacer size="md" />
        <Button label="Modifier" onPress={() => {}} />
      </Card>
    </Container>
  );
};
```

## Résultat attendu

À la fin de la migration, nous aurons :

1. **Une base de code plus cohérente** et maintenable
2. **Un développement plus rapide** grâce à la réutilisation des composants
3. **Une expérience utilisateur cohérente** à travers toute l'application
4. **Une documentation complète** du Design System
5. **Une facilité d'évolution** pour les futures fonctionnalités