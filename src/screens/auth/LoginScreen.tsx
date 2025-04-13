import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Alert, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Keyboard,
  Image,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Dimensions,
  Animated,
  Easing
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS, SIZES, SHADOWS, SPACING, BORDER_RADIUS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text, Input } from '../../components/ui';

const { width, height } = Dimensions.get('window');

const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{email?: string; password?: string}>({});
  const { signIn } = useAuth();
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0)).current;

  // Démarrer les animations au chargement
  useEffect(() => {
    // Animation séquentielle pour un effet d'entrée élégant
    Animated.sequence([
      // D'abord, faire apparaître et animer le logo
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 700,
        easing: Easing.elastic(1),
        useNativeDriver: true
      }),
      
      // Ensuite, faire apparaître le formulaire
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true
        })
      ])
    ]).start();
  }, []);
  
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
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          style={styles.keyboardAvoid}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.container}>
              {/* En-tête avec logo et titre */}
              <View style={styles.headerContainer}>
                <Animated.View 
                  style={[
                    styles.logoContainer,
                    {
                      transform: [
                        { scale: logoScale }
                      ]
                    }
                  ]}
                >
                  <Image 
                    source={{ uri: 'https://i.imgur.com/VhfSTEy.png' }}
                    style={styles.logo} 
                    resizeMode="cover"
                  />
                </Animated.View>
                
                <Animated.View
                  style={[
                    styles.titleContainer,
                    {
                      opacity: logoScale,
                      transform: [
                        { translateY: logoScale.interpolate({
                          inputRange: [0, 1],
                          outputRange: [20, 0]
                        })}
                      ]
                    }
                  ]}
                >
                  <Text variant="h1" weight="bold" color="primary" style={styles.title}>
                    PRATIK
                  </Text>
                  <Text variant="body2" color="text-secondary" style={styles.subtitle}>
                    Services à domicile professionnels
                  </Text>
                </Animated.View>
              </View>
              
              {/* Formulaire */}
              <Animated.View 
                style={[
                  styles.formContainer,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }]
                  }
                ]}
              >
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.formHeader}>
                    <Text variant="h4" weight="bold" color="text" style={styles.formTitle}>
                      Connexion
                    </Text>
                    <Text variant="body2" color="text-secondary" style={styles.formSubtitle}>
                      Accédez à votre compte
                    </Text>
                  </View>
                  
                  <View style={styles.inputGroup}>
                    {/* Email Input */}
                    <View style={styles.inputContainer}>
                      <Text weight="semibold" variant="body2" style={styles.inputLabel}>
                        Adresse email
                      </Text>
                      <TouchableOpacity 
                        activeOpacity={1}
                        style={[
                          styles.input, 
                          errors.email ? styles.inputError : null,
                          email.length > 0 ? styles.inputFilled : null
                        ]}
                        onPress={() => {
                          // Cette fonction permet au composant parent de recevoir les focus
                        }}
                      >
                        <View style={styles.inputIcon}>
                          <Ionicons name="mail-outline" size={22} color={COLORS.primary} />
                        </View>
                        <TextInput
                          placeholder="Entrez votre adresse email"
                          value={email}
                          onChangeText={setEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          style={styles.textInput}
                          placeholderTextColor={COLORS.textSecondary}
                        />
                      </TouchableOpacity>
                      {errors.email && (
                        <Text variant="caption" color="danger" style={styles.errorText}>
                          {errors.email}
                        </Text>
                      )}
                    </View>
                    
                    {/* Password Input */}
                    <View style={styles.inputContainer}>
                      <Text weight="semibold" variant="body2" style={styles.inputLabel}>
                        Mot de passe
                      </Text>
                      <TouchableOpacity 
                        activeOpacity={1}
                        style={[
                          styles.input, 
                          errors.password ? styles.inputError : null,
                          password.length > 0 ? styles.inputFilled : null
                        ]}
                        onPress={() => {
                          // Cette fonction permet au composant parent de recevoir les focus
                        }}
                      >
                        <View style={styles.inputIcon}>
                          <Ionicons name="lock-closed-outline" size={22} color={COLORS.primary} />
                        </View>
                        <TextInput
                          placeholder="Entrez votre mot de passe"
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry
                          style={styles.textInput}
                          placeholderTextColor={COLORS.textSecondary}
                        />
                        <TouchableOpacity style={styles.eyeIcon}>
                          <Ionicons name="eye-outline" size={22} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                      {errors.password && (
                        <Text variant="caption" color="danger" style={styles.errorText}>
                          {errors.password}
                        </Text>
                      )}
                    </View>
                    
                    <TouchableOpacity
                      style={styles.forgotPasswordContainer}
                      onPress={() => navigation.navigate('ForgotPassword')}
                      activeOpacity={0.7}
                    >
                      <Text variant="body2" color="primary" weight="semibold" style={styles.forgotPasswordText}>
                        Mot de passe oublié ?
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Bouton de connexion */}
                  <TouchableOpacity
                    style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator color="white" size="small" />
                        <Text variant="button" weight="bold" color="light" style={styles.buttonText}>
                          Connexion en cours...
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Ionicons name="log-in-outline" size={22} color="white" style={styles.buttonIcon} />
                        <Text variant="button" weight="bold" color="light" style={styles.buttonText}>
                          Se connecter
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text variant="caption" color="text-secondary" style={styles.dividerText}>ou</Text>
                    <View style={styles.dividerLine} />
                  </View>
                  
                  {/* Bouton d'inscription */}
                  <TouchableOpacity
                    style={styles.registerButton}
                    onPress={() => navigation.navigate('Register')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="person-add-outline" size={20} color={COLORS.primary} style={styles.buttonIcon} />
                    <Text variant="button" weight="bold" color="primary" style={styles.buttonText}>
                      Créer un compte
                    </Text>
                  </TouchableOpacity>
                  
                  {/* Conditions d'utilisation */}
                  <View style={styles.termsContainer}>
                    <Text variant="caption" color="text-secondary" style={styles.termsText}>
                      En vous connectant, vous acceptez nos{' '}
                    </Text>
                    <TouchableOpacity>
                      <Text variant="caption" color="primary" weight="semibold" style={styles.termsLink}>
                        Conditions d'utilisation
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </Animated.View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  keyboardAvoid: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 20 : 30,
    paddingBottom: 10,
    backgroundColor: COLORS.white,
  },
  
  // Header
  headerContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  logoContainer: {
    width: 70,
    height: 70,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    ...SHADOWS.small,
    overflow: 'hidden',
  },
  logo: {
    width: 70,
    height: 70,
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    letterSpacing: 3,
    marginBottom: 3,
    fontWeight: '800',
  },
  subtitle: {
    opacity: 0.7,
    textAlign: 'center',
  },
  
  // Form
  formContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 30,
    ...SHADOWS.medium,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: Platform.OS === 'ios' ? 10 : 0,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingVertical: 20,
    paddingHorizontal: 25,
  },
  formHeader: {
    marginBottom: 15,
    alignItems: 'center',
  },
  formTitle: {
    marginBottom: 5,
  },
  formSubtitle: {
    opacity: 0.6,
  },
  
  // Inputs
  inputGroup: {
    marginBottom: 15,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    marginBottom: 5,
    marginLeft: 2,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.backgroundDark}50`,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...SHADOWS.small,
  },
  inputFilled: {
    borderColor: `${COLORS.primary}30`,
    backgroundColor: `${COLORS.primary}05`,
  },
  inputError: {
    borderColor: `${COLORS.danger}50`,
    backgroundColor: `${COLORS.danger}05`,
  },
  inputIcon: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}10`,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
    height: 46,
    paddingLeft: 8,
  },
  eyeIcon: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    marginTop: 4,
    marginLeft: 2,
  },
  
  // Forgot Password
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: 5,
    marginBottom: 5,
  },
  forgotPasswordText: {
    fontWeight: '600',
  },
  
  // Buttons
  loginButton: {
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
    marginBottom: 15,
    // Gradient effect with borderWidth
    borderWidth: 1.5,
    borderColor: `${COLORS.primary}80`,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  registerButton: {
    height: 50,
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: `${COLORS.primary}30`,
  },
  buttonIcon: {
    marginRight: 10,
  },
  buttonText: {
    fontSize: 15,
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    paddingHorizontal: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: `${COLORS.border}80`,
  },
  dividerText: {
    marginHorizontal: 15,
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 1,
  },
  
  // Terms
  termsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsText: {
    textAlign: 'center',
  },
  termsLink: {
    textDecorationLine: 'underline',
  }
});

export default LoginScreen;