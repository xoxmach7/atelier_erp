import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { HomeIcon, ListIcon, WorkIcon, MoreIcon } from '../../src/components/TabIcons';
import { colors } from '../../src/theme/colors';

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
      {label}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconWrap}>
              <HomeIcon focused={focused} />
              <TabLabel label="Главная" focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="work"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconWrap}>
              <WorkIcon focused={focused} />
              <TabLabel label="Работа" focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconWrap}>
              <ListIcon focused={focused} />
              <TabLabel label="Заказы" focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.iconWrap}>
              <MoreIcon focused={focused} />
              <TabLabel label="Ещё" focused={focused} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: Platform.OS === 'android' ? 68 : 80,
    paddingBottom: Platform.OS === 'android' ? 8 : 20,
    paddingTop: 6,
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    width: 72,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
    lineHeight: 13,
    textAlign: 'center',
  },
  labelActive: {
    color: '#60CCED',
  },
});
