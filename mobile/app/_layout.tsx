import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuthContext } from '../src/context/AuthContext';
import { useFonts } from 'expo-font';

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    'TTNormsPro-Regular': require('../assets/fonts/TTNORMSPRO-REGULAR.TTF'),
    'TTNormsPro-Medium': require('../assets/fonts/ttnormspro-medium.ttf'),
    'TTNormsPro-Bold': require('../assets/fonts/TTNORMSPRO-BOLD.TTF'),
    'TTNormsPro-Light': require('../assets/fonts/TTNORMSPRO-LIGHT.TTF'),
    'TTNormsPro-Thin': require('../assets/fonts/TTNORMSPRO-THIN.TTF'),
    'TTNormsPro-ExtraBold': require('../assets/fonts/TTNORMSPRO-EXTRABOLD.TTF'),
    'TTNormsPro-Black': require('../assets/fonts/TTNORMSPRO-BLACK.TTF'),
    'TTNormsPro-Italic': require('../assets/fonts/TTNORMSPRO-ITALIC.TTF'),
    'TTNormsPro-BoldItalic': require('../assets/fonts/TTNORMSPRO-BOLDITALIC.TTF'),
  });

  useEffect(() => {
    if (isLoading) return;
    const inLoginScreen = segments[0] === 'login';
    if (!isAuthenticated && !inLoginScreen) {
      router.replace('/login');
    } else if (isAuthenticated && inLoginScreen) {
      router.replace('/(tabs)/today');
    }
  }, [isAuthenticated, isLoading, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
