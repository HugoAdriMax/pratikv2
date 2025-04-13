/**
 * Design System Tokens
 * 
 * Cette fichier centralise toutes les valeurs de design (couleurs, espacements, etc.)
 * et sert de source unique de vérité pour l'application.
 */

import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../utils/theme';

// Exporter les tokens existants pour assurer la compatibilité
export { COLORS, SPACING, BORDER_RADIUS, SHADOWS };

// Types pour le système de design
export type ColorVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'text' | 'text-secondary' | 'light';
export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type TextVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'body1' | 'body2' | 'caption' | 'button';
export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';
export type LayoutSpacing = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Mapping des valeurs
export const SPACING_VALUES = {
  xs: SPACING.xs,
  sm: SPACING.sm,
  md: SPACING.md,
  lg: SPACING.lg,
  xl: SPACING.xl,
};

// Valeurs standardisées pour l'élévation
export const ELEVATION = {
  none: SHADOWS.none,
  xs: SHADOWS.small,
  sm: SHADOWS.small,
  md: SHADOWS.medium,
  lg: SHADOWS.large,
  xl: SHADOWS.extra,
};

// Breakpoints pour la conception responsive
export const BREAKPOINTS = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1080,
  xl: 1280,
};