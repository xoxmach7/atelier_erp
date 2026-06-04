import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { radius } from '../theme/spacing';

export interface BarData {
  label: string;
  value: number;
}

interface SimpleBarChartProps {
  data: BarData[];
  maxValue?: number;
  minValue?: number;
  height?: number;
}

const CHART_MAX = 10;
const CHART_MIN = -1;
const PLOT_H = 170;
const ZERO_FROM_BOTTOM = (Math.abs(CHART_MIN) / (CHART_MAX - CHART_MIN)) * PLOT_H;

export function SimpleBarChart({
  data,
  maxValue = CHART_MAX,
  minValue = CHART_MIN,
}: SimpleBarChartProps) {
  const range = maxValue - minValue;

  return (
    <View style={styles.container}>
      <View style={styles.yAxis}>
        {['10,00', '7,25', '4,50', '1,75', '-1,00'].map((label) => (
          <Text key={label} style={styles.yLabel}>{label}</Text>
        ))}
      </View>

      <View style={styles.plot}>
        {/* Grid lines */}
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[styles.gridLine, { bottom: (i / 4) * PLOT_H + 20 }]}
          />
        ))}

        {/* Zero line */}
        <View style={[styles.zeroLine, { bottom: ZERO_FROM_BOTTOM + 20 }]} />

        {/* Bars */}
        <View style={styles.barsRow}>
          {data.map((item, index) => {
            const barHeight = (Math.abs(item.value) / range) * PLOT_H;
            const isPositive = item.value >= 0;
            return (
              <View key={index} style={styles.col}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        bottom: isPositive ? ZERO_FROM_BOTTOM : ZERO_FROM_BOTTOM - barHeight,
                        backgroundColor: item.value < 0 ? colors.danger.DEFAULT : colors.primary[400],
                      },
                    ]}
                  />
                </View>
                <Text style={styles.xLabel}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    width: '100%',
    maxWidth: 382,
    alignSelf: 'center',
    flexDirection: 'row',
    height: 240,
  },
  yAxis: {
    width: 36,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 20,
    paddingTop: 4,
  },
  yLabel: {
    fontSize: 9,
    color: colors.textMuted,
  },
  plot: {
    flex: 1,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.neutral[100],
  },
  zeroLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.neutral[300],
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 20,
    top: 4,
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    width: '100%',
    height: PLOT_H,
    position: 'relative',
  },
  bar: {
    width: 24,
    borderRadius: 4,
    position: 'absolute',
    alignSelf: 'center',
  },
  xLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
});
