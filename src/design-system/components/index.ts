/**
 * Design System Components
 * 
 * Point d'entrée pour tous les composants du design system.
 * Expose une API cohérente pour toute l'application.
 */

// Composants de mise en page
export { default as Box } from './Box';
export { default as Container } from './Container';
export { default as Divider } from './Divider';
export { default as Spacer } from './Spacer';
export { default as Grid } from './Grid';
export { Row, Col } from './Grid';

// Composants de base
export { default as Text } from './Text';
export { default as Card } from './Card';
export { default as Input } from './Input';
export { default as Button } from './Button';
export { default as Avatar } from './Avatar';

// Réexporter les composants UI existants pour compatibilité pendant la transition
export { default as Badge } from '../../components/ui/Badge';
export { default as BottomSheet } from '../../components/ui/BottomSheet';