declare module '@ptomasroos/react-native-multi-slider' {
  import * as React from 'react';
  import { StyleProp, ViewStyle } from 'react-native';

  export interface MultiSliderProps {
    values?: number[];
    min?: number;
    max?: number;
    step?: number;
    sliderLength?: number;
    allowOverlap?: boolean;
    snapped?: boolean;
    enabledOne?: boolean;
    enabledTwo?: boolean;
    onValuesChange?: (values: number[]) => void;
    onValuesChangeStart?: (values: number[]) => void;
    onValuesChangeFinish?: (values: number[]) => void;
    containerStyle?: StyleProp<ViewStyle>;
    trackStyle?: StyleProp<ViewStyle>;
    selectedStyle?: StyleProp<ViewStyle>;
    unselectedStyle?: StyleProp<ViewStyle>;
    markerStyle?: StyleProp<ViewStyle>;
    pressedMarkerStyle?: StyleProp<ViewStyle>;
    touchDimensions?: {
      height: number;
      width: number;
      borderRadius: number;
      slipDisplacement: number;
    };
    markerOffsetX?: number;
    markerOffsetY?: number;
    customMarker?: (props: { currentValue: number }) => React.ReactNode;
  }

  const MultiSlider: React.ComponentType<MultiSliderProps>;

  export default MultiSlider;
}
