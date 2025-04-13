import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Importer les composants du design system
import { 
  Button, 
  Text, 
  COLORS, 
  SPACING, 
  Badge, 
  Card, 
  Box, 
  Container, 
  Divider, 
  Spacer,
  Avatar,
  Input,
  Grid,
  Row,
  Col
} from '../../design-system';

// Écran de test pour le design system
const DesignSystemTestScreen = ({ navigation }: any) => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text variant="h3" weight="bold">Design System</Text>
          <Text variant="body1" color="text-secondary">Test des composants unifiés</Text>
        </View>
        
        {/* Section des boutons */}
        <View style={styles.section}>
          <Text variant="h5" weight="semibold" style={styles.sectionTitle}>Boutons</Text>
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Variantes</Text>
          <View style={styles.row}>
            <Button 
              label="Primary" 
              variant="primary" 
              onPress={() => {}} 
              style={styles.button}
            />
            <Button 
              label="Secondary" 
              variant="secondary" 
              onPress={() => {}} 
              style={styles.button}
            />
          </View>
          
          <View style={styles.row}>
            <Button 
              label="Success" 
              variant="success" 
              onPress={() => {}} 
              style={styles.button}
            />
            <Button 
              label="Danger" 
              variant="danger" 
              onPress={() => {}} 
              style={styles.button}
            />
          </View>
          
          <View style={styles.row}>
            <Button 
              label="Outline" 
              variant="outline" 
              onPress={() => {}} 
              style={styles.button}
            />
            <Button 
              label="Ghost" 
              variant="ghost" 
              onPress={() => {}} 
              style={styles.button}
            />
          </View>
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Tailles</Text>
          <View style={styles.column}>
            <Button 
              label="Small" 
              size="sm" 
              onPress={() => {}} 
              style={styles.fullWidthButton}
            />
            <Button 
              label="Medium" 
              size="md" 
              onPress={() => {}} 
              style={styles.fullWidthButton}
            />
            <Button 
              label="Large" 
              size="lg" 
              onPress={() => {}} 
              style={styles.fullWidthButton}
            />
          </View>
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>États</Text>
          <View style={styles.row}>
            <Button 
              label="Disabled" 
              disabled={true} 
              onPress={() => {}} 
              style={styles.button}
            />
            <Button 
              label="Loading" 
              loading={true} 
              onPress={() => {}} 
              style={styles.button}
            />
          </View>
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Avec icône</Text>
          <View style={styles.row}>
            <Button 
              label="À gauche" 
              icon={<Ionicons name="checkmark-circle" size={16} color="white" />}
              iconPosition="left"
              onPress={() => {}} 
              style={styles.button}
            />
            <Button 
              label="À droite" 
              icon={<Ionicons name="arrow-forward" size={16} color="white" />}
              iconPosition="right"
              onPress={() => {}} 
              style={styles.button}
            />
          </View>
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Forme</Text>
          <View style={styles.row}>
            <Button 
              label="Normal" 
              onPress={() => {}} 
              style={styles.button}
            />
            <Button 
              label="Arrondi" 
              rounded={true}
              onPress={() => {}} 
              style={styles.button}
            />
          </View>
        </View>
        
        {/* Section des badges */}
        <View style={styles.section}>
          <Text variant="h5" weight="semibold" style={styles.sectionTitle}>Badges</Text>
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Variantes</Text>
          <View style={styles.row}>
            <Badge label="Primary" variant="primary" style={styles.badge} />
            <Badge label="Secondary" variant="secondary" style={styles.badge} />
            <Badge label="Success" variant="success" style={styles.badge} />
            <Badge label="Danger" variant="danger" style={styles.badge} />
            <Badge label="Warning" variant="warning" style={styles.badge} />
            <Badge label="Info" variant="info" style={styles.badge} />
          </View>
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Avec bordures</Text>
          <View style={styles.row}>
            <Badge label="Primary" variant="primary" border style={styles.badge} />
            <Badge label="Secondary" variant="secondary" border style={styles.badge} />
            <Badge label="Success" variant="success" border style={styles.badge} />
          </View>
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Tailles</Text>
          <View style={styles.row}>
            <Badge label="Small" size="sm" style={styles.badge} />
            <Badge label="Medium" style={styles.badge} />
            <Badge label="Large" size="lg" style={styles.badge} />
          </View>
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Avec icône</Text>
          <View style={styles.row}>
            <Badge 
              label="Vérifié" 
              variant="success" 
              leftIcon={<Ionicons name="checkmark" size={12} color="white" />} 
              style={styles.badge} 
            />
            <Badge 
              label="Nouveau" 
              variant="primary" 
              leftIcon={<Ionicons name="star" size={12} color="white" />} 
              style={styles.badge} 
            />
          </View>
        </View>
        
        {/* Section Box et Container */}
        <View style={styles.section}>
          <Text variant="h5" weight="semibold" style={styles.sectionTitle}>Mise en page</Text>
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Box</Text>
          <Box 
            padding="md" 
            background="light" 
            borderRadius="md" 
            elevation="sm"
            borderWidth={1}
            borderColor="primary"
          >
            <Text variant="body2">Box avec padding, background et radius</Text>
          </Box>
          
          <Spacer size="md" />
          
          <Box 
            padding="md" 
            borderRadius="md" 
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            background="primary"
          >
            <Text variant="body2" color="light">Box avec flexDirection</Text>
            <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
          </Box>
          
          <Spacer size="md" />
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Container</Text>
          <Container padding="md" background="light" rounded={true}>
            <Text variant="body2">Container par défaut</Text>
          </Container>
          
          <Spacer size="md" />
          
          <Container padding="sm" background="primary" rounded={true} centerX={true}>
            <Text variant="body2" color="light">Container centré</Text>
          </Container>
          
          <Spacer size="md" />
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Divider</Text>
          <Text variant="body2">Contenu au-dessus</Text>
          <Divider spacing="md" color="primary" />
          <Text variant="body2">Contenu en-dessous</Text>
          
          <Spacer size="md" />
          
          <Box flexDirection="row" alignItems="center">
            <Text variant="body2">Gauche</Text>
            <Divider orientation="vertical" length={20} spacing="sm" color="primary" />
            <Text variant="body2">Droite</Text>
          </Box>
          
          <Spacer size="md" />
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Spacer</Text>
          <Box background="light" padding="sm" borderRadius="md">
            <Text variant="body2">Contenu 1</Text>
            <Spacer size="md" />
            <Text variant="body2">Contenu 2</Text>
          </Box>
          
          <Box 
            background="light" 
            padding="sm" 
            borderRadius="md" 
            flexDirection="row" 
            alignItems="center"
            marginTop={20}
          >
            <Text variant="body2">Gauche</Text>
            <Spacer direction="horizontal" size="md" />
            <Text variant="body2">Droite</Text>
          </Box>
        </View>
        
        {/* Section Avatar */}
        <View style={styles.section}>
          <Text variant="h5" weight="semibold" style={styles.sectionTitle}>Avatar</Text>
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Tailles</Text>
          <View style={styles.row}>
            <Avatar size="xs" initials="AB" style={styles.avatar} />
            <Avatar size="sm" initials="AB" style={styles.avatar} />
            <Avatar size="md" initials="AB" style={styles.avatar} />
            <Avatar size="lg" initials="AB" style={styles.avatar} />
            <Avatar size="xl" initials="AB" style={styles.avatar} />
          </View>
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Formes</Text>
          <View style={styles.row}>
            <Avatar shape="circle" initials="AB" style={styles.avatar} />
            <Avatar shape="rounded" initials="AB" style={styles.avatar} />
            <Avatar shape="square" initials="AB" style={styles.avatar} />
          </View>
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Avec image</Text>
          <View style={styles.row}>
            <Avatar 
              source={require('../../../assets/default-avatar.png')} 
              size="lg" 
              style={styles.avatar}
            />
            <Avatar 
              source={require('../../../assets/default-avatar.png')} 
              size="lg"
              bordered
              style={styles.avatar}
            />
          </View>
        </View>
        
        {/* Section Input */}
        <View style={styles.section}>
          <Text variant="h5" weight="semibold" style={styles.sectionTitle}>Input</Text>
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Variantes</Text>
          <Input 
            label="Filled (par défaut)" 
            placeholder="Entrez du texte"
            leftIcon={<Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />}
          />
          <Input 
            label="Outlined" 
            variant="outlined"
            placeholder="Entrez du texte"
            leftIcon={<Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />}
          />
          <Input 
            label="Underlined" 
            variant="underlined"
            placeholder="Entrez du texte"
            leftIcon={<Ionicons name="call-outline" size={20} color={COLORS.textSecondary} />}
          />
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>États</Text>
          <Input 
            label="Erreur" 
            placeholder="Entrez du texte"
            error="Message d'erreur"
          />
          <Input 
            label="Succès" 
            placeholder="Entrez du texte"
            state="success"
            helper="Validation réussie"
          />
          <Input 
            label="Mot de passe" 
            placeholder="Entrez votre mot de passe"
            secureTextEntry
          />
        </View>
        
        {/* Section Grid */}
        <View style={styles.section}>
          <Text variant="h5" weight="semibold" style={styles.sectionTitle}>Grid</Text>
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Colonnes égales</Text>
          <Row spacing="sm">
            <Col>
              <Box padding="sm" background="primary" borderRadius="md">
                <Text variant="body2" color="light" align="center">1/2</Text>
              </Box>
            </Col>
            <Col>
              <Box padding="sm" background="primary" borderRadius="md">
                <Text variant="body2" color="light" align="center">1/2</Text>
              </Box>
            </Col>
          </Row>
          
          <Spacer size="sm" />
          
          <Row spacing="sm">
            <Col>
              <Box padding="sm" background="primary" borderRadius="md">
                <Text variant="body2" color="light" align="center">1/3</Text>
              </Box>
            </Col>
            <Col>
              <Box padding="sm" background="primary" borderRadius="md">
                <Text variant="body2" color="light" align="center">1/3</Text>
              </Box>
            </Col>
            <Col>
              <Box padding="sm" background="primary" borderRadius="md">
                <Text variant="body2" color="light" align="center">1/3</Text>
              </Box>
            </Col>
          </Row>
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Colonnes personnalisées</Text>
          <Row spacing="sm">
            <Col size={4}>
              <Box padding="sm" background="primary" borderRadius="md">
                <Text variant="body2" color="light" align="center">4/12</Text>
              </Box>
            </Col>
            <Col size={8}>
              <Box padding="sm" background="primary" borderRadius="md">
                <Text variant="body2" color="light" align="center">8/12</Text>
              </Box>
            </Col>
          </Row>
          
          <Spacer size="sm" />
          
          <Row spacing="sm">
            <Col size={3}>
              <Box padding="sm" background="primary" borderRadius="md">
                <Text variant="body2" color="light" align="center">3/12</Text>
              </Box>
            </Col>
            <Col size={6}>
              <Box padding="sm" background="primary" borderRadius="md">
                <Text variant="body2" color="light" align="center">6/12</Text>
              </Box>
            </Col>
            <Col size={3}>
              <Box padding="sm" background="primary" borderRadius="md">
                <Text variant="body2" color="light" align="center">3/12</Text>
              </Box>
            </Col>
          </Row>
        </View>
        
        {/* Section Card améliorée */}
        <View style={styles.section}>
          <Text variant="h5" weight="semibold" style={styles.sectionTitle}>Card</Text>
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Variantes d'élévation</Text>
          <Card padding="md" elevation="none" margin="xs">
            <Text variant="body2">Élévation none</Text>
          </Card>
          <Card padding="md" elevation="sm" margin="xs">
            <Text variant="body2">Élévation sm</Text>
          </Card>
          <Card padding="md" elevation="md" margin="xs">
            <Text variant="body2">Élévation md</Text>
          </Card>
          <Card padding="md" elevation="lg" margin="xs">
            <Text variant="body2">Élévation lg</Text>
          </Card>
          
          <Text variant="body2" color="text-secondary" style={styles.subsectionTitle}>Avec bordure</Text>
          <Card 
            padding="md" 
            borderRadius="lg" 
            borderWidth={1} 
            borderColor="primary" 
            elevation="none"
          >
            <Text variant="body2">Card avec bordure</Text>
          </Card>
        </View>
        
        {/* Bouton de retour */}
        <Button 
          label="Retour" 
          variant="outline"
          icon={<Ionicons name="arrow-back" size={16} color={COLORS.primary} />}
          iconPosition="left"
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    padding: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    marginBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.xs,
  },
  subsectionTitle: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SPACING.xs,
    marginBottom: SPACING.sm,
  },
  column: {
    marginBottom: SPACING.sm,
  },
  button: {
    marginHorizontal: SPACING.xs,
    marginBottom: SPACING.sm,
    minWidth: 120,
  },
  fullWidthButton: {
    marginBottom: SPACING.sm,
  },
  backButton: {
    marginTop: SPACING.lg,
  },
  badge: {
    marginHorizontal: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  avatar: {
    marginHorizontal: SPACING.xs,
    marginBottom: SPACING.sm,
  },
});

export default DesignSystemTestScreen;