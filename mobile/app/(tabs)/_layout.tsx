import React from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { BottomTabBar } from '../../components/navigation/BottomTabBar';
import { TAB_ITEMS } from '../../components/navigation/tabs';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTabBar {...props} />}
    >
      {TAB_ITEMS.map((item) => (
        <Tabs.Screen key={item.name} name={item.name} options={{ title: item.label }} />
      ))}
    </Tabs>
  );
}
