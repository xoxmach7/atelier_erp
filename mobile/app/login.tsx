import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { AppTextInput } from '../src/components/AppTextInput';
import { useAuthContext } from '../src/context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuthContext();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Ошибка', 'Введите логин и пароль');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.replace('/(tabs)/today');
    } catch (err) {
      Alert.alert('Не удалось войти', err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.kav}
      >
        <View style={s.inner}>
          {/* Logo */}
          <View style={s.logoBlock}>
            <Image
              source={require('../assets/images/logo.webp')}
              style={s.logo}
              resizeMode="contain"
            />
            <Text style={s.appName}>
              <Text style={s.appNameBold}>Sheber</Text> Atelier
            </Text>
            <Text style={s.orgPlaceholder}>Название организации</Text>
          </View>

          {/* Form */}
          <View style={s.form}>
            <AppTextInput
              placeholder="E-mail/телефон"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <AppTextInput
              placeholder="Пароль"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity
              style={[s.btn, loading && s.btnDisabled]}
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={loading}
            >
              <Text style={s.btnText}>{loading ? 'Вход...' : 'Вход'}</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text style={s.footer}>SheberSolution</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  kav: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 40,
  },
  logoBlock: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    width: 140,
    height: 140,
  },
  appName: {
    fontSize: 28,
    color: '#0F172A',
    fontFamily: 'TTNormsPro-Regular',
    marginTop: 16,
  },
  appNameBold: {
    fontFamily: 'TTNormsPro-Bold',
  },
  orgPlaceholder: {
    fontSize: 20,
    color: '#94A3B8',
    fontFamily: 'TTNormsPro-Regular',
    marginTop: 8,
  },
  form: {
    gap: 12,
    flex: 1,
    justifyContent: 'center',
    maxWidth: 360,
    alignSelf: 'center',
    width: '100%',
  },
  btn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#60CCED',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'TTNormsPro-Bold',
    letterSpacing: 0.3,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: 'TTNormsPro-Regular',
  },
});
