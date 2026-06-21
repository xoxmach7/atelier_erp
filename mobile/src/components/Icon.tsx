import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export type IconName =
  | 'plus' | 'search' | 'user' | 'filter' | 'tenge' | 'edit' | 'trash'
  | 'dots' | 'calendar' | 'userAdd' | 'doc' | 'chevron' | 'minus';

/**
 * Лёгкие иконки на чистых View/Text — без сторонних библиотек.
 * Рисуются в условном боксе 24×24, масштабируются через size.
 */
export function Icon({ name, size = 20, color = '#FFFFFF' }: { name: IconName; size?: number; color?: string }) {
  const u = size / 24;
  const box = { width: size, height: size, alignItems: 'center' as const, justifyContent: 'center' as const };

  switch (name) {
    case 'plus':
      return <View style={box}><Text style={{ color, fontSize: size * 1.15, lineHeight: size * 1.2, fontWeight: '400' }}>+</Text></View>;
    case 'minus':
      return <View style={box}><View style={{ width: 12 * u, height: 2 * u, backgroundColor: color, borderRadius: 1 }} /></View>;
    case 'chevron':
      return <View style={box}><Text style={{ color, fontSize: size * 1.1, lineHeight: size * 1.15 }}>›</Text></View>;
    case 'tenge':
      return <View style={box}><Text style={{ color, fontSize: size * 0.95, lineHeight: size, fontWeight: '500' }}>₸</Text></View>;

    case 'search':
      return (
        <View style={box}>
          <View style={{ width: 12 * u, height: 12 * u, borderRadius: 6 * u, borderWidth: 2 * u, borderColor: color, position: 'absolute', top: 3 * u, left: 3 * u }} />
          <View style={{ width: 2 * u, height: 7 * u, backgroundColor: color, borderRadius: u, position: 'absolute', bottom: 2.5 * u, right: 4 * u, transform: [{ rotate: '45deg' }] }} />
        </View>
      );

    case 'user':
      return (
        <View style={box}>
          <View style={{ width: 8.5 * u, height: 8.5 * u, borderRadius: 4.25 * u, backgroundColor: color, position: 'absolute', top: 3 * u }} />
          <View style={{ width: 16 * u, height: 9 * u, borderTopLeftRadius: 8 * u, borderTopRightRadius: 8 * u, backgroundColor: color, position: 'absolute', bottom: 2.5 * u }} />
        </View>
      );

    case 'userAdd':
      return (
        <View style={box}>
          <View style={{ width: 7.5 * u, height: 7.5 * u, borderRadius: 3.75 * u, backgroundColor: color, position: 'absolute', top: 3.5 * u, left: 4 * u }} />
          <View style={{ width: 13 * u, height: 7.5 * u, borderTopLeftRadius: 6.5 * u, borderTopRightRadius: 6.5 * u, backgroundColor: color, position: 'absolute', bottom: 3 * u, left: 2.5 * u }} />
          <Text style={{ color, fontSize: size * 0.6, fontWeight: '700', position: 'absolute', top: 0, right: 0 }}>+</Text>
        </View>
      );

    case 'filter':
      return (
        <View style={box}>
          <View style={{ width: 0, height: 0, borderLeftWidth: 8 * u, borderRightWidth: 8 * u, borderTopWidth: 9 * u, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: color, position: 'absolute', top: 4 * u }} />
          <View style={{ width: 2.5 * u, height: 6 * u, backgroundColor: color, position: 'absolute', bottom: 4 * u, borderRadius: u }} />
        </View>
      );

    case 'edit':
      return (
        <View style={box}>
          <View style={{ width: 4.5 * u, height: 15 * u, backgroundColor: color, borderRadius: 1.2 * u, transform: [{ rotate: '45deg' }] }} />
          <View style={{ width: 4.5 * u, height: 3 * u, backgroundColor: color, position: 'absolute', bottom: 3 * u, left: 4 * u, transform: [{ rotate: '45deg' }] }} />
        </View>
      );

    case 'trash':
      return (
        <View style={box}>
          <View style={{ width: 6 * u, height: 2 * u, backgroundColor: color, borderRadius: u, position: 'absolute', top: 3 * u }} />
          <View style={{ width: 15 * u, height: 2 * u, backgroundColor: color, borderRadius: u, position: 'absolute', top: 5.5 * u }} />
          <View style={{ width: 11 * u, height: 12 * u, borderWidth: 2 * u, borderColor: color, borderBottomLeftRadius: 2 * u, borderBottomRightRadius: 2 * u, borderTopWidth: 0, position: 'absolute', top: 8 * u }} />
        </View>
      );

    case 'dots':
      return (
        <View style={[box, { justifyContent: 'space-between', paddingVertical: 4 * u }]}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: 3.4 * u, height: 3.4 * u, borderRadius: 1.7 * u, backgroundColor: color }} />
          ))}
        </View>
      );

    case 'calendar':
      return (
        <View style={box}>
          <View style={{ width: 16 * u, height: 15 * u, borderWidth: 2 * u, borderColor: color, borderRadius: 2.5 * u, position: 'absolute', top: 4 * u }} />
          <View style={{ width: 16 * u, height: 4 * u, backgroundColor: color, position: 'absolute', top: 4 * u, borderTopLeftRadius: 1.5 * u, borderTopRightRadius: 1.5 * u }} />
          <View style={{ width: 2 * u, height: 4 * u, backgroundColor: color, position: 'absolute', top: 1.5 * u, left: 7 * u, borderRadius: u }} />
          <View style={{ width: 2 * u, height: 4 * u, backgroundColor: color, position: 'absolute', top: 1.5 * u, right: 7 * u, borderRadius: u }} />
        </View>
      );

    case 'doc':
      return (
        <View style={box}>
          <View style={{ width: 14 * u, height: 17 * u, borderWidth: 2 * u, borderColor: color, borderRadius: 2 * u }} />
          <View style={{ width: 7 * u, height: 2 * u, backgroundColor: color, position: 'absolute', top: 8 * u, borderRadius: u }} />
          <View style={{ width: 7 * u, height: 2 * u, backgroundColor: color, position: 'absolute', top: 12 * u, borderRadius: u }} />
        </View>
      );

    default:
      return <View style={box} />;
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
