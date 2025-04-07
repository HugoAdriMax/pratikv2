import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Alert, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Image
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS, SIZES, SHADOWS } from '../../utils/theme';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Card from '../../components/Card';

const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{email?: string; password?: string}>({});
  const { signIn } = useAuth();

  const validate = () => {
    const newErrors: {email?: string; password?: string} = {};
    let isValid = true;

    if (!email.trim()) {
      newErrors.email = 'L\'email est requis';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email invalide';
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'Le mot de passe est requis';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        Alert.alert('Erreur de connexion', error.message);
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>Client Prestations</Text>
            </View>
            
            <Card style={styles.card}>
              <Text style={styles.title}>Connexion</Text>
              
              <Input
                label="Email"
                placeholder="Votre adresse email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                error={errors.email}
                autoCapitalize="none"
              />
              
              <Input
                label="Mot de passe"
                placeholder="Votre mot de passe"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                error={errors.password}
              />
              
              <Button
                title={loading ? 'Connexion en cours...' : 'Se connecter'}
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
              />
              
              <Button
                title="Pas encore de compte ? S'inscrire"
                onPress={() => navigation.navigate('Register')}
                variant="outline"
                style={styles.registerButton}
              />
            </Card>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: SIZES.padding,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SIZES.padding * 2,
  },
  logoText: {
    ...FONTS.h1,
    color: COLORS.primary,
    marginTop: 10,
  },
  card: {
    ...SHADOWS.medium,
  },
  title: {
    ...FONTS.h2,
    marginBottom: SIZES.padding,
    textAlign: 'center',
    color: COLORS.dark,
  },
  registerButton: {
    marginTop: SIZES.base,
  },
});

export default LoginScreen;