module.exports = {
  name: "Pratikk",
  slug: "pratikk",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/roro.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  updates: {
    fallbackToCacheTimeout: 0
  },
  assetBundlePatterns: [
    "**/*"
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.pratikv2.app",
    buildNumber: "1.0.0",
    infoPlist: {
      NSCameraUsageDescription: "Cette application utilise la caméra pour prendre des photos des problèmes à résoudre et pour les documents KYC.",
      NSLocationWhenInUseUsageDescription: "Cette application utilise votre localisation pour trouver des prestataires à proximité.",
      NSPhotoLibraryUsageDescription: "Cette application nécessite l'accès à vos photos pour télécharger des images."
    }
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#FFFFFF"
    },
    package: "com.pratikv2.app",
    versionCode: 1,
    permissions: [
      "android.permission.CAMERA",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.RECORD_AUDIO"
    ]
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  extra: {
    eas: {
      projectId: "79ad3771-1092-4b48-975e-4c3b5e1252b3"
    },
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "pk_test_51RBfQBGCiyrDqa9RuKVHhXGHQaB7TmZtNJSbuuv3uAD1S2yNtFRb8yLX6Lpvm0fi45d3FnBtXVyAtwcTE2T5jmOm00uB96WoLs",
    stripeMerchantId: process.env.STRIPE_MERCHANT_ID || "merchant.com.pratikv2.app",
    stripeBackendUrl: process.env.STRIPE_BACKEND_URL || "https://mkexcgwxenvzhbbopnko.supabase.co/functions/v1/stripe-api",
    openaiApiKey: process.env.OPENAI_API_KEY
  },
  plugins: [
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission: "Cette application utilise votre localisation pour trouver des prestataires à proximité."
      }
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Cette application nécessite l'accès à vos photos pour télécharger des images."
      }
    ],
    [
      "expo-camera",
      {
        cameraPermission: "Cette application utilise la caméra pour prendre des photos des problèmes à résoudre et pour les documents KYC."
      }
    ],
    "expo-notifications"
  ]
};