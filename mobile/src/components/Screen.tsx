import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  withPadding?: boolean;
  variant?: 'gray' | 'white';
}

export function Screen({ children, scrollable = true, withPadding = true, variant = 'gray' }: ScreenProps) {
  const contentStyle = [
    styles.content,
    withPadding && styles.padding,
  ];
  const containerBg = variant === 'white' ? colors.white : colors.background;

  if (scrollable) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: containerBg }]} edges={['top']}>
        <ScrollView style={styles.scroll} contentContainerStyle={contentStyle}>
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: containerBg }]} edges={['top']}>
      <View style={contentStyle}>
        {children}
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
  content: {
    flexGrow: 1,
  },
  padding: {
    padding: spacing.base,
  },
});
