import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { radius } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';

export default function LoginScreen() {
  const router = useRouter();

  const handleLogin = () => {
    router.replace('/(tabs)/today');
  };

  const handleDemoLogin = () => {
    router.replace('/(tabs)/today');
  };

  return (
    <Screen scrollable={false} withPadding>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.logo}>Sheber</Text>
          <Text style={styles.subtitle}>Atelier Management</Text>
        </View>

        <View style={styles.form}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Войти</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.demoButton}
            onPress={handleDemoLogin}
            activeOpacity={0.8}
          >
            <Text style={styles.demoButtonText}>Демо-режим</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>v1.0.0</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  logo: {
    fontSize: typography.sizes['4xl'],
    fontWeight: typography.weights.bold,
    color: colors.primary[500],
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  form: {
    gap: spacing.base,
    marginBottom: spacing['2xl'],
  },
  button: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  demoButton: {
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  demoButtonText: {
    color: colors.text,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  version: {
    textAlign: 'center',
    fontSize: typography.sizes.xs,
    color: colors.textMuted,
  },
});
