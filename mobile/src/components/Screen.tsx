import React from 'react';
import { View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { SCREEN_MAX_WIDTH } from '../theme/layout';

interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  withPadding?: boolean;
  variant?: 'gray' | 'white';
  avoidKeyboard?: boolean;
}

export function Screen({ children, scrollable = true, withPadding = true, variant = 'gray', avoidKeyboard = false }: ScreenProps) {
  const { width } = useWindowDimensions();
  const isWide = width > SCREEN_MAX_WIDTH;
  const containerBg = variant === 'white' ? colors.white : colors.background;

  const inner = (
    <View style={[styles.inner, isWide && styles.innerWide, withPadding && styles.padding]}>
      {children}
    </View>
  );

  if (scrollable) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: containerBg }]} edges={['top']}>
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, isWide && styles.scrollContentWide]}>
          {inner}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: containerBg }]} edges={['top']}>
      <View style={[styles.staticContent, isWide && styles.staticContentWide]}>
        {inner}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentWide: {
    alignItems: 'center',
  },
  staticContent: {
    flex: 1,
  },
  staticContentWide: {
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    flexGrow: 1,
  },
  innerWide: {
    maxWidth: SCREEN_MAX_WIDTH,
    width: SCREEN_MAX_WIDTH,
    alignSelf: 'center',
  },
  padding: {
    padding: spacing.base,
  },
});
