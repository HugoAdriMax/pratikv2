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
  Easing,
  Switch
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS, SIZES, SHADOWS } from '../../utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text } from '../../components/ui';
import { UserRole } from '../../types';
import supabase from '../../config/supabase';

const { width, height } = Dimensions.get('window');

const RegisterScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.CLIENT);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{email?: string; password?: string; confirmPassword?: string; phone?: string}>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Variables pour le choix des services
  const [registrationStep, setRegistrationStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  
  const { signUp } = useAuth();
  
  // Interface pour les services
  interface Service {
    id: string;
    name: string;
    category: string;
    description: string;
    is_selected: boolean;
  }
  
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
  
  // Charger les services quand on passe à l'étape 2 en tant que prestataire
  useEffect(() => {
    if (role === UserRole.PRESTAIRE && registrationStep === 2) {
      loadServices();
    }
  }, [role, registrationStep]);
  
  // Fonction pour charger la liste des services depuis l'API
  const loadServices = async () => {
    try {
      setServicesLoading(true);
      
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('category')
        .order('name');
        
      if (error) throw error;
      
      const servicesData = data.map(service => ({
        ...service,
        is_selected: false
      }));
      
      setServices(servicesData);
      
      // Extraire les catégories uniques
      const uniqueCategories = [...new Set(servicesData.map(s => s.category))];
      setCategories(uniqueCategories);
      
      // Initialiser toutes les catégories comme étant déployées
      const expandedState = uniqueCategories.reduce((acc, category) => {
        acc[category] = true; // Par défaut, toutes les catégories sont déployées
        return acc;
      }, {});
      setExpandedCategories(expandedState);
      
    } catch (error) {
      console.error('Erreur lors du chargement des services:', error);
      Alert.alert('Erreur', 'Impossible de charger les services disponibles');
    } finally {
      setServicesLoading(false);
    }
  };
  
  // Fonction pour déployer/replier une catégorie
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };
  
  // Fonction pour sélectionner/désélectionner un service
  const toggleService = (serviceId: string) => {
    // Mettre à jour l'état des services
    setServices(prevServices => 
      prevServices.map(service => 
        service.id === serviceId 
          ? { ...service, is_selected: !service.is_selected }
          : service
      )
    );
    
    // Mettre à jour la liste des services sélectionnés
    setSelectedServiceIds(prev => {
      if (prev.includes(serviceId)) {
        return prev.filter(id => id !== serviceId);
      } else {
        return [...prev, serviceId];
      }
    });
  };

  const validate = () => {
    const newErrors: {email?: string; password?: string; confirmPassword?: string; phone?: string} = {};
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

    if (!confirmPassword) {
      newErrors.confirmPassword = 'La confirmation du mot de passe est requise';
      isValid = false;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
      isValid = false;
    }

    if (!phone) {
      newErrors.phone = 'Le numéro de téléphone est requis';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    
    // Si c'est un prestataire et que nous sommes à l'étape 1, passer à l'étape 2
    if (role === UserRole.PRESTAIRE && registrationStep === 1) {
      setRegistrationStep(2);
      return;
    }
    
    setLoading(true);
    try {
      // Pour un prestataire à l'étape 2, passer les services sélectionnés
      let selectedServices = undefined;
      if (role === UserRole.PRESTAIRE && registrationStep === 2) {
        selectedServices = selectedServiceIds;
      }
      
      const { error, user } = await signUp(email, password, phone, role, selectedServices);
      
      if (error) {
        Alert.alert('Erreur', error.message);
      } else {
        Alert.alert(
          'Inscription réussie', 
          role === UserRole.CLIENT
            ? 'Votre compte a été créé avec succès.'
            : 'Votre compte a été créé avec vos services sélectionnés. Un administrateur va vérifier vos informations.',
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
            {/* Formulaire d'inscription - Étape 1 */}
            {registrationStep === 1 && (
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
                      Inscription
                    </Text>
                    <Text variant="body2" color="text-secondary" style={styles.formSubtitle}>
                      Créez votre compte
                    </Text>
                  </View>
                  
                  <View style={styles.inputGroup}>
                    {/* Type de compte - DÉPLACÉ EN HAUT */}
                    <View style={styles.roleContainer}>
                      <Text weight="semibold" variant="body2" style={styles.inputLabel}>
                        Type de compte
                      </Text>
                      <View style={styles.roleButtonsContainer}>
                        <TouchableOpacity
                          style={[
                            styles.roleButton,
                            role === UserRole.CLIENT && styles.roleButtonActive
                          ]}
                          onPress={() => setRole(UserRole.CLIENT)}
                          activeOpacity={0.8}
                        >
                          <Ionicons 
                            name="person-outline" 
                            size={20} 
                            color={role === UserRole.CLIENT ? COLORS.white : COLORS.primary} 
                            style={styles.roleIcon}
                          />
                          <Text 
                            variant="body2" 
                            weight="semibold" 
                            color={role === UserRole.CLIENT ? "light" : "primary"}
                          >
                            Client
                          </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={[
                            styles.roleButton,
                            role === UserRole.PRESTAIRE && styles.roleButtonActive
                          ]}
                          onPress={() => setRole(UserRole.PRESTAIRE)}
                          activeOpacity={0.8}
                        >
                          <Ionicons 
                            name="briefcase-outline" 
                            size={20} 
                            color={role === UserRole.PRESTAIRE ? COLORS.white : COLORS.primary} 
                            style={styles.roleIcon}
                          />
                          <Text 
                            variant="body2" 
                            weight="semibold" 
                            color={role === UserRole.PRESTAIRE ? "light" : "primary"}
                          >
                            Prestataire
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    {role === UserRole.PRESTAIRE && (
                      <View style={styles.infoContainer}>
                        <Ionicons name="information-circle-outline" size={22} color={COLORS.textSecondary} style={styles.infoIcon} />
                        <Text variant="body3" color="text-secondary" style={styles.infoText}>
                          En tant que prestataire, votre compte devra être validé par un administrateur avant d'être activé.
                        </Text>
                      </View>
                    )}
                    
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
                    
                    {/* Phone Input */}
                    <View style={styles.inputContainer}>
                      <Text weight="semibold" variant="body2" style={styles.inputLabel}>
                        Téléphone
                      </Text>
                      <TouchableOpacity 
                        activeOpacity={1}
                        style={[
                          styles.input, 
                          errors.phone ? styles.inputError : null,
                          phone.length > 0 ? styles.inputFilled : null
                        ]}
                        onPress={() => {
                          // Cette fonction permet au composant parent de recevoir les focus
                        }}
                      >
                        <View style={styles.inputIcon}>
                          <Ionicons name="call-outline" size={22} color={COLORS.primary} />
                        </View>
                        <TextInput
                          placeholder="Entrez votre numéro de téléphone"
                          value={phone}
                          onChangeText={setPhone}
                          keyboardType="phone-pad"
                          style={styles.textInput}
                          placeholderTextColor={COLORS.textSecondary}
                        />
                      </TouchableOpacity>
                      {errors.phone && (
                        <Text variant="caption" color="danger" style={styles.errorText}>
                          {errors.phone}
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
                          secureTextEntry={!showPassword}
                          style={styles.textInput}
                          placeholderTextColor={COLORS.textSecondary}
                        />
                        <TouchableOpacity 
                          style={styles.eyeIcon}
                          onPress={() => setShowPassword(!showPassword)}
                        >
                          <Ionicons 
                            name={showPassword ? "eye-off-outline" : "eye-outline"} 
                            size={22} 
                            color={COLORS.textSecondary} 
                          />
                        </TouchableOpacity>
                      </TouchableOpacity>
                      {errors.password && (
                        <Text variant="caption" color="danger" style={styles.errorText}>
                          {errors.password}
                        </Text>
                      )}
                    </View>
                    
                    {/* Confirm Password Input */}
                    <View style={styles.inputContainer}>
                      <Text weight="semibold" variant="body2" style={styles.inputLabel}>
                        Confirmer le mot de passe
                      </Text>
                      <TouchableOpacity 
                        activeOpacity={1}
                        style={[
                          styles.input, 
                          errors.confirmPassword ? styles.inputError : null,
                          confirmPassword.length > 0 ? styles.inputFilled : null
                        ]}
                        onPress={() => {
                          // Cette fonction permet au composant parent de recevoir les focus
                        }}
                      >
                        <View style={styles.inputIcon}>
                          <Ionicons name="lock-closed-outline" size={22} color={COLORS.primary} />
                        </View>
                        <TextInput
                          placeholder="Confirmez votre mot de passe"
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          secureTextEntry={!showConfirmPassword}
                          style={styles.textInput}
                          placeholderTextColor={COLORS.textSecondary}
                        />
                        <TouchableOpacity 
                          style={styles.eyeIcon}
                          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          <Ionicons 
                            name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                            size={22} 
                            color={COLORS.textSecondary} 
                          />
                        </TouchableOpacity>
                      </TouchableOpacity>
                      {errors.confirmPassword && (
                        <Text variant="caption" color="danger" style={styles.errorText}>
                          {errors.confirmPassword}
                        </Text>
                      )}
                    </View>
                  </View>
                  
                  {/* Bouton d'inscription ou Suivant */}
                  <TouchableOpacity
                    style={[styles.registerButton, loading && styles.registerButtonDisabled]}
                    onPress={handleRegister}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator color="white" size="small" />
                        <Text variant="button" weight="bold" color="light" style={styles.buttonText}>
                          {role === UserRole.PRESTAIRE ? "Chargement..." : "Inscription en cours..."}
                        </Text>
                      </View>
                    ) : (
                      <>
                        {role === UserRole.PRESTAIRE ? (
                          <>
                            <Text variant="button" weight="bold" color="light" style={styles.buttonText}>
                              Suivant
                            </Text>
                            <Ionicons name="arrow-forward" size={20} color="white" />
                          </>
                        ) : (
                          <>
                            <Ionicons name="person-add-outline" size={22} color="white" style={styles.buttonIcon} />
                            <Text variant="button" weight="bold" color="light" style={styles.buttonText}>
                              S'inscrire
                            </Text>
                          </>
                        )}
                      </>
                    )}
                  </TouchableOpacity>
                  
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text variant="caption" color="text-secondary" style={styles.dividerText}>ou</Text>
                    <View style={styles.dividerLine} />
                  </View>
                  
                  {/* Bouton de connexion */}
                  <TouchableOpacity
                    style={styles.loginButton}
                    onPress={() => navigation.navigate('Login')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="log-in-outline" size={20} color={COLORS.primary} style={styles.buttonIcon} />
                    <Text variant="button" weight="bold" color="primary" style={styles.buttonText}>
                      Se connecter
                    </Text>
                  </TouchableOpacity>
                  
                  {/* Conditions d'utilisation */}
                  <View style={styles.termsContainer}>
                    <Text variant="caption" color="text-secondary" style={styles.termsText}>
                      En vous inscrivant, vous acceptez nos{' '}
                    </Text>
                    <TouchableOpacity>
                      <Text variant="caption" color="primary" weight="semibold" style={styles.termsLink}>
                        Conditions d'utilisation
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </Animated.View>
            )}
            
            {/* Formulaire de sélection des services - Étape 2 */}
            {registrationStep === 2 && role === UserRole.PRESTAIRE && (
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
                >
                  <View style={styles.formHeader}>
                    <Text variant="h4" weight="bold" color="text" style={styles.formTitle}>
                      Sélection de services
                    </Text>
                    <Text variant="body2" color="text-secondary" style={styles.formSubtitle}>
                      Sélectionnez les services que vous proposez
                    </Text>
                  </View>

                  {servicesLoading ? (
                    <View style={styles.loaderContainer}>
                      <ActivityIndicator size="large" color={COLORS.primary} />
                      <Text style={{ marginTop: 10 }}>Chargement des services...</Text>
                    </View>
                  ) : (
                    <>
                      {categories.map(category => (
                        <View key={category} style={styles.categorySection}>
                          <TouchableOpacity 
                            style={styles.categoryHeader} 
                            onPress={() => toggleCategory(category)}
                          >
                            <Text variant="h4" weight="semibold">{category}</Text>
                            <Ionicons 
                              name={expandedCategories[category] ? "chevron-up" : "chevron-down"} 
                              size={20} 
                              color={COLORS.dark}
                            />
                          </TouchableOpacity>
                          
                          {expandedCategories[category] && (
                            <View style={styles.categoryContent}>
                              {services
                                .filter(service => service.category === category)
                                .map(service => (
                                  <TouchableOpacity
                                    key={service.id}
                                    style={[
                                      styles.serviceItem,
                                      service.is_selected && styles.serviceItemSelected
                                    ]}
                                    onPress={() => toggleService(service.id)}
                                  >
                                    <View style={styles.serviceInfo}>
                                      <Text variant="body1" weight="semibold">{service.name}</Text>
                                      <Text variant="body2" color="text-secondary" numberOfLines={2}>
                                        {service.description}
                                      </Text>
                                    </View>
                                    <Switch
                                      value={service.is_selected}
                                      onValueChange={() => toggleService(service.id)}
                                      trackColor={{ false: COLORS.light, true: COLORS.primary + '50' }}
                                      thumbColor={service.is_selected ? COLORS.primary : COLORS.textSecondary}
                                    />
                                  </TouchableOpacity>
                                ))}
                            </View>
                          )}
                        </View>
                      ))}
                      
                      <View style={styles.buttonRow}>
                        <TouchableOpacity
                          style={styles.backButton}
                          onPress={() => setRegistrationStep(1)}
                        >
                          <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
                          <Text variant="button" weight="semibold" color="primary">
                            Retour
                          </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={[
                            styles.registerButton, 
                            styles.registerButtonCompact,
                            loading && styles.registerButtonDisabled
                          ]}
                          onPress={handleRegister}
                          disabled={loading}
                        >
                          {loading ? (
                            <ActivityIndicator color="white" size="small" />
                          ) : (
                            <>
                              <Text variant="button" weight="bold" color="light">
                                S'inscrire
                              </Text>
                              <Ionicons name="arrow-forward" size={20} color="white" />
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </ScrollView>
              </Animated.View>
            )}
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
  
  // Role selector
  roleContainer: {
    marginBottom: 15,
  },
  roleButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roleButton: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: `${COLORS.primary}30`,
    backgroundColor: `${COLORS.primary}10`,
    marginRight: 8,
  },
  roleButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleIcon: {
    marginRight: 8,
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
  
  // Buttons
  registerButton: {
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
  registerButtonDisabled: {
    opacity: 0.7,
  },
  registerButtonCompact: {
    flex: 1,
    marginLeft: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  loginButton: {
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
  },
  
  // Service selection styles
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  categorySection: {
    marginVertical: 10,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: `${COLORS.primary}10`,
  },
  categoryContent: {
    padding: 10,
  },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.border}50`,
    marginBottom: 5,
  },
  serviceItemSelected: {
    backgroundColor: `${COLORS.primary}05`,
  },
  serviceInfo: {
    flex: 1,
    marginRight: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  }
});

export default RegisterScreen;