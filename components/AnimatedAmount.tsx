// Balance number that animates smoothly when the value changes.
import React, { useEffect, useRef } from 'react';
import { Text, TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, interpolateColor, Easing } from 'react-native-reanimated';

interface Props {
  value: number;                 // minor units
  format: (v: number) => string;
  style?: TextStyle;
  hidden?: boolean;
}

export function AnimatedAmount({ value, format, style, hidden }: Props) {
  const sv = useSharedValue(value);
  const shown = React.useRef(value);
  const [, force] = React.useReducer((x) => x + 1, 0);

  useEffect(() => {
    sv.value = withTiming(value, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [value, sv]);

  // Re-render text while the shared value is interpolating (JS-driven label update).
  useEffect(() => {
    let raf: number;
    const step = () => {
      const cur = Math.round(sv.value as number);
      if (cur !== shown.current) { shown.current = cur; force(); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [sv]);

  const animStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      sv.value < 0 ? -1 : 0, [-1, 0], ['#B84C43', '#20231F']
    ) as unknown as string,
  }));

  return <Animated.Text style={[style, value < 0 ? { color: '#B84C43' } : undefined]}>{hidden ? '••••••' : format(shown.current)}</Animated.Text>;
}
