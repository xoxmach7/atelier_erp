import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

const HEADER_MAX_WIDTH = 272;

interface LogoTitleProps {
  title?: string;
  subtitle?: string;
}

export function LogoTitle({ title = 'Sheber ERP', subtitle = 'Единая база' }: LogoTitleProps) {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/images/logo.webp')}
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: spacing.lg,
  },
  textBlock: {
    alignItems: 'center',
    maxWidth: HEADER_MAX_WIDTH,
    width: '100%',
  },
  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
