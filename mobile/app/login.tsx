import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { radius } from '../src/theme/spacing';
import { typography } from '../src/theme/typography';

const MAX_FORM_WIDTH = 325;
const BUTTON_HEIGHT = 43;
const BUTTON_RADIUS = 10;

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
    <Screen scrollable={false} withPadding={false} variant="white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
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

          <View style={styles.footerWrap}>
            <Text style={styles.footer}>SheberSolution</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['4xl'],
    paddingBottom: spacing.lg,
  },
  header: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary[200],
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
    alignSelf: 'center',
    width: '100%',
    maxWidth: MAX_FORM_WIDTH,
  },
  input: {
    backgroundColor: colors.neutral[100],
    borderRadius: BUTTON_RADIUS,
    height: BUTTON_HEIGHT,
    paddingHorizontal: spacing.base,
    fontSize: typography.sizes.base,
    color: colors.text,
    width: '100%',
  },
  button: {
    backgroundColor: colors.primary[500],
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  demoButton: {
    backgroundColor: colors.neutral[100],
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  demoButtonText: {
    color: colors.text,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  footerWrap: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  footer: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
});
