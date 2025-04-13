import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '../../utils/theme';

interface DividerProps {
  color?: string;
  thickness?: number;
  margin?: number;
  style?: ViewStyle;
  vertical?: boolean;
}

/**
 * Composant Divider pour afficher une ligne de séparation
 * @param color - Couleur du séparateur (par défaut: COLORS.border)
 * @param thickness - Épaisseur du séparateur (par défaut: 1px)
 * @param margin - Marge verticale ou horizontale (par défaut: 8px)
 * @param style - Styles supplémentaires
 * @param vertical - Si true, le séparateur est vertical (par défaut: false)
 */
const Divider: React.FC<DividerProps> = ({
  color = COLORS.border,
  thickness = 1,
  margin = 8,
  style = {},
  vertical = false
}) => {
  return (
    <View
      style={[
        vertical 
          ? {
              width: thickness,
              height: '100%',
              marginHorizontal: margin,
              backgroundColor: color
            }
          : {
              height: thickness,
              width: '100%',
              marginVertical: margin,
              backgroundColor: color
            },
        style
      ]}
    />
  );
};

export default Divider;