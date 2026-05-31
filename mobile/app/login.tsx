import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { radius } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    router.replace('/today');
  };

  const handleDemoLogin = () => {
    router.replace('/today');
  };

  return (
    <Screen scrollable={false} withPadding variant="white">
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoLetter}>S</Text>
          </View>
          <Text style={styles.title}>Единая база</Text>
          <Text style={styles.subtitle}>Sheber ERP</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Телефон или email"
            placeholderTextColor={colors.textMuted}
            value={phone}
            onChangeText={setPhone}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Пароль"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Вход</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.demoButton}
            onPress={handleDemoLogin}
            activeOpacity={0.8}
          >
            <Text style={styles.demoButtonText}>Демо-вход</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>SheberSolution</Text>
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
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoLetter: {
    fontSize: typography.sizes['3xl'],
    fontWeight: typography.weights.bold,
    color: colors.white,
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
  form: {
    gap: spacing.base,
    marginBottom: spacing['2xl'],
  },
  input: {
    backgroundColor: colors.neutral[100],
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.base,
    fontSize: typography.sizes.base,
    color: colors.text,
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
  },
  demoButtonText: {
    color: colors.text,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  footer: {
    textAlign: 'center',
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
});
