import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Rect, Polyline } from 'react-native-svg';

export type IconName =
  | 'plus' | 'search' | 'user' | 'filter' | 'tenge' | 'edit' | 'trash'
  | 'dots' | 'calendar' | 'userAdd' | 'doc' | 'chevron' | 'minus' | 'menu'
  | 'eye' | 'eyeOff' | 'check';

/**
 * Иконки на react-native-svg — outline-стиль (24×24 viewBox, stroke-based),
 * рендерятся идентично на всех платформах/устройствах в отличие от
 * самодельных View-примитивов с rotate/absolute (те "плыли" на реальных
 * Android-устройствах, хотя выглядели нормально в Expo Go на симуляторе).
 */
export function Icon({ name, size = 20, color = '#FFFFFF' }: { name: IconName; size?: number; color?: string }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'plus':
      return (
        <Svg {...common}>
          <Line x1="12" y1="5" x2="12" y2="19" />
          <Line x1="5" y1="12" x2="19" y2="12" />
        </Svg>
      );

    case 'minus':
      return (
        <Svg {...common}>
          <Line x1="5" y1="12" x2="19" y2="12" />
        </Svg>
      );

    case 'chevron':
      return (
        <Svg {...common}>
          <Polyline points="9 6 15 12 9 18" />
        </Svg>
      );

    case 'tenge':
      // ₸: две горизонтальные черты сверху + вертикальный стержень вниз от центра.
      return (
        <Svg {...common} strokeWidth={2.2}>
          <Line x1="5" y1="6" x2="19" y2="6" />
          <Line x1="5" y1="10" x2="19" y2="10" />
          <Line x1="12" y1="10" x2="12" y2="20" />
        </Svg>
      );

    case 'search':
      return (
        <Svg {...common}>
          <Circle cx="11" cy="11" r="7" />
          <Line x1="21" y1="21" x2="16.65" y2="16.65" />
        </Svg>
      );

    case 'user':
      return (
        <Svg {...common}>
          <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <Circle cx="12" cy="7" r="4" />
        </Svg>
      );

    case 'userAdd':
      return (
        <Svg {...common}>
          <Path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <Circle cx="8.5" cy="7" r="4" />
          <Line x1="20" y1="8" x2="20" y2="14" />
          <Line x1="17" y1="11" x2="23" y2="11" />
        </Svg>
      );

    case 'filter':
      return (
        <Svg {...common}>
          <Polyline points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </Svg>
      );

    case 'edit':
      return (
        <Svg {...common}>
          <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </Svg>
      );

    case 'trash':
      return (
        <Svg {...common}>
          <Polyline points="3 6 5 6 21 6" />
          <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <Line x1="10" y1="11" x2="10" y2="17" />
          <Line x1="14" y1="11" x2="14" y2="17" />
        </Svg>
      );

    case 'dots':
      return (
        <Svg {...common} fill={color} stroke="none">
          <Circle cx="12" cy="5" r="1.8" />
          <Circle cx="12" cy="12" r="1.8" />
          <Circle cx="12" cy="19" r="1.8" />
        </Svg>
      );

    case 'calendar':
      return (
        <Svg {...common}>
          <Rect x="3" y="4" width="18" height="18" rx="2" />
          <Line x1="16" y1="2" x2="16" y2="6" />
          <Line x1="8" y1="2" x2="8" y2="6" />
          <Line x1="3" y1="10" x2="21" y2="10" />
        </Svg>
      );

    case 'doc':
      return (
        <Svg {...common}>
          <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <Polyline points="14 2 14 8 20 8" />
          <Line x1="9" y1="13" x2="15" y2="13" />
          <Line x1="9" y1="17" x2="15" y2="17" />
        </Svg>
      );

    case 'menu':
      return (
        <Svg {...common}>
          <Line x1="3" y1="6" x2="21" y2="6" />
          <Line x1="3" y1="12" x2="21" y2="12" />
          <Line x1="3" y1="18" x2="21" y2="18" />
        </Svg>
      );

    case 'check':
      return (
        <Svg {...common} strokeWidth={3}>
          <Polyline points="4 12.5 9.5 18 20 6.5" />
        </Svg>
      );

    case 'eye':
      return (
        <Svg {...common}>
          <Path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
          <Circle cx="12" cy="12" r="3" />
        </Svg>
      );

    case 'eyeOff':
      return (
        <Svg {...common}>
          <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <Line x1="1" y1="1" x2="23" y2="23" />
        </Svg>
      );

    default:
      return null;
  }
}

/** Cyan-квадрат с иконкой (как в Figma). */
export function IconButton({
  name, onPress, size = 38, iconSize, color = '#FFFFFF', bg = '#60CCED', radius = 10, disabled,
}: {
  name: IconName; onPress?: () => void; size?: number; iconSize?: number;
  color?: string; bg?: string; radius?: number; disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
      style={[styles.btn, { width: size, height: size, borderRadius: radius, backgroundColor: bg, opacity: disabled ? 0.5 : 1 }]}
    >
      <Icon name={name} size={iconSize ?? size * 0.55} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center' },
});
