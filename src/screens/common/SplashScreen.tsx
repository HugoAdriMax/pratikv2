import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../../utils/theme';

const { width, height } = Dimensions.get('window');

const SplashScreen = ({ onFinish }: { onFinish: () => void }) => {
  // Animation pour le logo
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  
  // Animation pour le sous-titre
  const subtitleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animation de rotation
    const spinAnimation = Animated.timing(spinAnim, {
      toValue: 2, // 2 tours complets
      duration: 3000,
      easing: Easing.bezier(0.45, 0, 0.55, 1),
      useNativeDriver: true,
    });
    
    // Animation d'entrée du logo
    const logoAnimation = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.elastic(1),
        useNativeDriver: true,
      }),
      spinAnimation
    ]);

    // Animation du sous-titre
    const subtitleAnimation = Animated.timing(subtitleAnim, {
      toValue: 1,
      duration: 800,
      delay: 800,
      useNativeDriver: true,
    });

    // Animation de sortie
    const fadeOutAnimation = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 600,
        delay: 1500,
        useNativeDriver: true,
      }),
      Animated.timing(subtitleAnim, {
        toValue: 0,
        duration: 400,
        delay: 1500,
        useNativeDriver: true,
      })
    ]);

    // Exécution séquentielle des animations
    Animated.sequence([
      logoAnimation,
      subtitleAnimation,
      Animated.delay(1200),
      fadeOutAnimation
    ]).start(() => {
      // Appeler onFinish une fois les animations terminées
      onFinish();
    });
  }, []);

  // Interpolation pour la rotation
  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Logo avec animation */}
      <Animated.View 
        style={[
          styles.logoContainer, 
          { 
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { rotate: spin }
            ]
          }
        ]}
      >
        <Image 
          source={require('../../../assets/icon.png')} 
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Animated.View>
      
      {/* Sous-titre */}
      <Animated.Text 
        style={[
          styles.subtitle,
          { opacity: subtitleAnim }
        ]}
      >
        Services à portée de main
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1249b6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 220,
    height: 220,
    marginBottom: 30,
    borderRadius: 110,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  logoImage: {
    width: 200,
    height: 200,
    borderRadius: 0, // Pas de bordure arrondie sur l'image pour éviter d'apercevoir le fond
    backgroundColor: '#1249b6', // Même couleur que le fond pour une intégration parfaite
  },
  subtitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    opacity: 0.9,
    marginTop: 30,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default SplashScreen;