import React, { useState, useRef, useEffect } from 'react';
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
import { COLORS, FONTS, SIZES, SHADOWS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text } from '../../components/ui';

const { width, height } = Dimensions.get('window');

const ForgotPasswordScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{email?: string}>({});
  const [emailSent, setEmailSent] = useState(false);
  const { forgotPassword } = useAuth();
  
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
    const newErrors: {email?: string} = {};
    let isValid = true;

    if (!email.trim()) {
      newErrors.email = 'L\'email est requis';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email invalide';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleResetPassword = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const { error } = await forgotPassword(email);
      if (error) {
        Alert.alert('Erreur', error.message);
      } else {
        setEmailSent(true);
        Alert.alert(
          'Email envoyé', 
          'Un email contenant les instructions pour réinitialiser votre mot de passe a été envoyé à votre adresse email.'
        );
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
                    Mot de passe oublié
                  </Text>
                  <Text variant="body2" color="text-secondary" style={styles.formSubtitle}>
                    Récupérez l'accès à votre compte
                  </Text>
                </View>
                
                {!emailSent ? (
                  <View style={styles.inputGroup}>
                    <View style={styles.infoContainer}>
                      <Ionicons name="information-circle-outline" size={22} color={COLORS.textSecondary} style={styles.infoIcon} />
                      <Text variant="body3" color="text-secondary" style={styles.infoText}>
                        Veuillez entrer votre adresse e-mail. Vous recevrez un lien pour créer un nouveau mot de passe.
                      </Text>
                    </View>
                    
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
                    
                    {/* Bouton de réinitialisation */}
                    <TouchableOpacity
                      style={[styles.resetButton, loading && styles.resetButtonDisabled]}
                      onPress={handleResetPassword}
                      disabled={loading}
                      activeOpacity={0.8}
                    >
                      {loading ? (
                        <View style={styles.loadingContainer}>
                          <ActivityIndicator color="white" size="small" />
                          <Text variant="button" weight="bold" color="light" style={styles.buttonText}>
                            Envoi en cours...
                          </Text>
                        </View>
                      ) : (
                        <>
                          <Ionicons name="send-outline" size={22} color="white" style={styles.buttonIcon} />
                          <Text variant="button" weight="bold" color="light" style={styles.buttonText}>
                            Réinitialiser le mot de passe
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.successContainer}>
                    <View style={styles.successIconContainer}>
                      <Ionicons name="checkmark-circle" size={60} color={COLORS.success} />
                    </View>
                    <Text variant="h5" weight="bold" color="success" style={styles.successTitle}>
                      Email envoyé !
                    </Text>
                    <Text variant="body2" color="text-secondary" style={styles.successText}>
                      Un email contenant les instructions pour réinitialiser votre mot de passe a été envoyé à votre adresse email.
                    </Text>
                    <Text variant="body3" color="text-secondary" style={styles.instructionText}>
                      Veuillez vérifier votre boîte de réception et suivre les instructions pour réinitialiser votre mot de passe.
                    </Text>
                  </View>
                )}
                
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text variant="caption" color="text-secondary" style={styles.dividerText}>ou</Text>
                  <View style={styles.dividerLine} />
                </View>
                
                {/* Bouton de retour à la connexion */}
                <TouchableOpacity
                  style={styles.loginButton}
                  onPress={() => navigation.navigate('Login')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="log-in-outline" size={20} color={COLORS.primary} style={styles.buttonIcon} />
                  <Text variant="button" weight="bold" color="primary" style={styles.buttonText}>
                    Retour à la connexion
                  </Text>
                </TouchableOpacity>
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
  
  // Info message
  infoContainer: {
    flexDirection: 'row',
    backgroundColor: `${COLORS.info}15`,
    padding: 12,
    borderRadius: 12,
    marginBottom: 15,
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: 10,
  },
  infoText: {
    flex: 1,
    lineHeight: 18,
  },
  
  // Inputs
  inputGroup: {
    marginBottom: 15,
  },
  inputContainer: {
    marginBottom: 20,
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
  errorText: {
    marginTop: 4,
    marginLeft: 2,
  },
  
  // Success container
  successContainer: {
    alignItems: 'center',
    padding: 15,
    marginBottom: 15,
  },
  successIconContainer: {
    marginBottom: 15,
  },
  successTitle: {
    marginBottom: 10,
  },
  successText: {
    textAlign: 'center',
    marginBottom: 10,
  },
  instructionText: {
    textAlign: 'center',
    opacity: 0.8,
  },
  
  // Buttons
  resetButton: {
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
    marginBottom: 15,
    borderWidth: 1.5,
    borderColor: `${COLORS.primary}80`,
  },
  resetButtonDisabled: {
    opacity: 0.7,
  },
  loginButton: {
    height: 50,
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
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
    marginVertical: 15,
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
});

export default ForgotPasswordScreen;