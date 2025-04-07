import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

const RegisterScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.CLIENT);
  const [loading, setLoading] = useState(false);
  
  const { signUp } = useAuth();

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword || !phone) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      const { error } = await signUp(email, password, phone, role);
      
      if (error) {
        Alert.alert('Erreur', error.message);
      } else {
        Alert.alert(
          'Inscription réussie', 
          role === UserRole.CLIENT
            ? 'Votre compte a été créé avec succès.'
            : 'Votre compte a été créé. Un administrateur va vérifier vos informations.',
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
        );
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Inscription</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      <TextInput
        style={styles.input}
        placeholder="Confirmer le mot de passe"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      
      <TextInput
        style={styles.input}
        placeholder="Téléphone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      
      <Text style={styles.label}>Type de compte:</Text>
      <View style={styles.roleContainer}>
        <TouchableOpacity
          style={[
            styles.roleButton,
            role === UserRole.CLIENT && styles.roleButtonActive
          ]}
          onPress={() => setRole(UserRole.CLIENT)}
        >
          <Text style={role === UserRole.CLIENT ? styles.roleTextActive : styles.roleText}>
            Client
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.roleButton,
            role === UserRole.PRESTAIRE && styles.roleButtonActive
          ]}
          onPress={() => setRole(UserRole.PRESTAIRE)}
        >
          <Text style={role === UserRole.PRESTAIRE ? styles.roleTextActive : styles.roleText}>
            Prestataire
          </Text>
        </TouchableOpacity>
      </View>
      
      {role === UserRole.PRESTAIRE && (
        <Text style={styles.infoText}>
          En tant que prestataire, votre compte devra être validé par un administrateur avant d'être activé.
        </Text>
      )}
      
      <TouchableOpacity 
        style={styles.button}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Inscription en cours...' : 'S\'inscrire'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.linkContainer}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.link}>Déjà un compte ? Se connecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 16,
    marginBottom: 10,
  },
  roleContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  roleButton: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 10,
    borderRadius: 8,
  },
  roleButtonActive: {
    backgroundColor: '#007BFF',
    borderColor: '#007BFF',
  },
  roleText: {
    color: '#333',
  },
  roleTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  infoText: {
    marginBottom: 20,
    color: '#666',
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: '#007BFF',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  link: {
    color: '#007BFF',
    fontSize: 16,
  },
});

export default RegisterScreen;