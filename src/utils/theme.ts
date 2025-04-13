import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const COLORS = {
  primary: '#006AFF',  // Bleu Uber/Lemonade
  primaryLight: '#4D96FF',
  secondary: '#00CCBB', // TooGoodToGo teal
  secondaryLight: '#4DD2C8',
  accent: '#FC642D',    // Orange like Uber Eats
  success: '#34C759',
  danger: '#FF3B30',
  warning: '#FFD60A',
  info: '#32ADE6',
  text: '#1A1A1A',
  textSecondary: '#757575',
  textLight: '#FFFFFF',
  background: '#F8F8F8',
  backgroundDark: '#EEEEEE',
  border: '#E0E0E0',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  gray: '#9E9E9E',
  light: '#F8F8F8',
  dark: '#1A1A1A',
  input: '#F2F2F2',
  card: '#FFFFFF',
  green: '#34C759',
  red: '#FF3B30',
  lightRed: '#FFEEEE',
};

export const SIZES = {
  // global sizes
  base: 8,
  font: 14,
  radius: 12,
  padding: 16,
  margin: 16,

  // font sizes
  h1: 30,
  h2: 24,
  h3: 20,
  h4: 18,
  h5: 16,
  body1: 16,
  body2: 14,
  body3: 12,
  caption: 10,

  // app dimensions
  width,
  height
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40
};

export const BORDER_RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 9999
};

export const FONTS = {
  h1: { fontFamily: 'System', fontSize: SIZES.h1, fontWeight: 'bold' },
  h2: { fontFamily: 'System', fontSize: SIZES.h2, fontWeight: 'bold' },
  h3: { fontFamily: 'System', fontSize: SIZES.h3, fontWeight: 'bold' },
  h4: { fontFamily: 'System', fontSize: SIZES.h4, fontWeight: 'bold' },
  h5: { fontFamily: 'System', fontSize: SIZES.h5, fontWeight: 'bold' },
  body1: { fontFamily: 'System', fontSize: SIZES.body1, lineHeight: 24 },
  body2: { fontFamily: 'System', fontSize: SIZES.body2, lineHeight: 22 },
  body3: { fontFamily: 'System', fontSize: SIZES.body3, lineHeight: 18 },
  body4: { fontFamily: 'System', fontSize: SIZES.body2 - 2, lineHeight: 20 },
  body5: { fontFamily: 'System', fontSize: SIZES.body3 - 2, lineHeight: 16 },
  caption: { fontFamily: 'System', fontSize: SIZES.caption, lineHeight: 14 }
};

export const SHADOWS = {
  small: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1
  },
  medium: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3
  },
  large: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6
  }
};

const appTheme = { COLORS, SIZES, FONTS, SHADOWS, BORDER_RADIUS, SPACING };

export default appTheme;