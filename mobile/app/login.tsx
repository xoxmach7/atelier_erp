import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { LogoTitle } from '../src/components/LogoTitle';
import { AppTextInput } from '../src/components/AppTextInput';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { spacing } from '../src/theme/spacing';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';

const FORM_MAX_WIDTH = 326;

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
          <View style={styles.top}>
            <LogoTitle title="Sheber ERP" subtitle="Единая база" />
          </View>

          <View style={styles.form}>
            <AppTextInput
              placeholder="Телефон или email"
              value={phone}
              onChangeText={setPhone}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <AppTextInput
              placeholder="Пароль"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <PrimaryButton title="Вход" onPress={handleLogin} />
            <PrimaryButton title="Демо-вход" onPress={handleDemoLogin} variant="secondary" />
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
    paddingTop: spacing['5xl'],
    paddingBottom: spacing.lg,
  },
  top: {
    alignItems: 'center',
    marginTop: spacing['2xl'],
  },
  form: {
    gap: spacing.base,
    alignSelf: 'center',
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
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
