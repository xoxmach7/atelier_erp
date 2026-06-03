import { View, StyleSheet } from 'react-native';

const C = '#60CCED';
const G = '#94A3B8';

// ─── Home icon ───────────────────────────────────────────────────────────────
export function HomeIcon({ focused }: { focused: boolean }) {
  const c = focused ? C : G;
  return (
    <View style={[s.wrap]}>
      {/* roof triangle */}
      <View style={[s.roof, { borderBottomColor: c }]} />
      {/* walls */}
      <View style={[s.walls, { borderColor: c }]}>
        {/* door */}
        <View style={[s.door, { borderColor: c }]} />
      </View>
    </View>
  );
}

// ─── List icon (orders) ──────────────────────────────────────────────────────
export function ListIcon({ focused }: { focused: boolean }) {
  const c = focused ? C : G;
  return (
    <View style={s.wrap}>
      <View style={[s.line, { backgroundColor: c, width: 18 }]} />
      <View style={[s.line, { backgroundColor: c, width: 14 }]} />
      <View style={[s.line, { backgroundColor: c, width: 18 }]} />
    </View>
  );
}

// ─── Work icon (hammer + tasks) ─────────────────────────────────────────────
export function WorkIcon({ focused }: { focused: boolean }) {
  const c = focused ? C : G;
  return (
    <View style={s.wrap}>
      {/* grid 2x2 */}
      <View style={s.grid}>
        <View style={[s.cell, { backgroundColor: c }]} />
        <View style={[s.cell, { backgroundColor: c, opacity: 0.5 }]} />
        <View style={[s.cell, { backgroundColor: c, opacity: 0.5 }]} />
        <View style={[s.cell, { backgroundColor: c }]} />
      </View>
    </View>
  );
}

// ─── More icon (three dots) ──────────────────────────────────────────────────
export function MoreIcon({ focused }: { focused: boolean }) {
  const c = focused ? C : G;
  return (
    <View style={[s.wrap, { flexDirection: 'row', gap: 4 }]}>
      <View style={[s.dot, { backgroundColor: c }]} />
      <View style={[s.dot, { backgroundColor: c }]} />
      <View style={[s.dot, { backgroundColor: c }]} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  // home
  roof: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: G,
  },
  walls: {
    width: 14,
    height: 9,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: G,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  door: {
    width: 4,
    height: 6,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: G,
  },
  // list
  line: {
    height: 2,
    borderRadius: 1,
  },
  // work grid
  grid: {
    width: 16,
    height: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  cell: {
    width: 6,
    height: 6,
    borderRadius: 1.5,
  },
  // more dots
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
