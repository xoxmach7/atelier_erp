import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Alert, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTextInput } from '../src/components/AppTextInput';
import { Icon } from '../src/components/Icon';
import { useAuthContext } from '../src/context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuthContext();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        <View style={[s.inner, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24 }]}>
          {/* Logo */}
          <View style={s.logoBlock}>
            <Image
              source={require('../assets/images/logo.webp')}
              style={s.logo}
              resizeMode="contain"
            />
            <Text style={s.appName}>Sheber Atelier</Text>
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
            <View style={s.passwordRow}>
              <TextInput
                style={s.passwordInput}
                placeholder="Пароль"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(v => !v)}
                style={s.eyeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>
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
    justifyContent: 'flex-start',
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
    fontFamily: 'TTNormsPro-Bold',
    marginTop: 16,
  },
  orgPlaceholder: {
    fontSize: 20,
    color: '#94A3B8',
    fontFamily: 'TTNormsPro-Regular',
    marginTop: 8,
  },
  form: {
    gap: 12,
    marginTop: 72,
    maxWidth: 360,
    alignSelf: 'center',
    width: '100%',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E9E9E9',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 326,
    alignSelf: 'center',
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: '#0F172A',
    fontFamily: 'TTNormsPro-Regular',
    height: '100%',
  },
  eyeBtn: {
    paddingLeft: 12,
    height: '100%',
    justifyContent: 'center',
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
    marginTop: 'auto',
  },
});
