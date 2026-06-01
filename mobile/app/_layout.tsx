import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuthContext } from '../src/context/AuthContext';
// import { useFonts } from 'expo-font';
// Uncomment and add font files to assets/fonts/ to enable TT Norms Pro:
// import TTNormsProRegular from '../assets/fonts/TTNormsPro-Regular.ttf';
// import TTNormsProMedium from '../assets/fonts/TTNormsPro-Medium.ttf';

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();

  // Uncomment to load custom fonts:
  // const [fontsLoaded] = useFonts({
  //   'TTNormsPro-Regular': TTNormsProRegular,
  //   'TTNormsPro-Medium': TTNormsProMedium,
  // });

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
